import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { resumeDelayedFlow } from "@/lib/flow-engine/engine";
import type { Json } from "@/lib/types/database";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;
type ScheduledJob = {
  id: string;
  type: string;
  payload: Json;
  attempts: number;
};

/**
 * Cron job handler that processes scheduled jobs.
 * Call via Vercel Cron or external cron every minute.
 * GET /api/cron/jobs?key=CRON_SECRET
 */
export async function GET(request: NextRequest) {
  // Simple auth via query param or header
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();

  const { jobs, usesLocks, error } = await claimDueScheduledJobs(supabase);

  if (error) {
    console.error("Failed to fetch jobs:", error);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }

  let processed = 0;
  let failed = 0;

  for (const job of jobs) {
    try {
      await processJob(supabase, job);
      await supabase.from("scheduled_jobs").update({
        status: "completed",
        ...(usesLocks ? { locked_at: null } : {}),
      }).eq("id", job.id);
      processed++;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      const maxAttempts = 3;

      if (job.attempts >= maxAttempts) {
        await supabase
          .from("scheduled_jobs")
          .update({
            status: "failed",
            last_error: errorMessage,
            ...(usesLocks ? { locked_at: null } : {}),
          })
          .eq("id", job.id);
      } else {
        // Retry with backoff
        const backoffMs = Math.pow(2, job.attempts) * 5000;
        const retryAt = new Date(Date.now() + backoffMs).toISOString();
        await supabase
          .from("scheduled_jobs")
          .update({
            status: "pending",
            run_at: retryAt,
            last_error: errorMessage,
            ...(usesLocks ? { locked_at: null } : {}),
          })
          .eq("id", job.id);
      }
      failed++;
    }
  }

  return NextResponse.json({ processed, failed, total: jobs.length });
}

async function claimDueScheduledJobs(supabase: ServiceClient): Promise<{
  jobs: ScheduledJob[];
  usesLocks: boolean;
  error: unknown;
}> {
  const { data, error } = await supabase.rpc("claim_due_scheduled_jobs", {
    batch_size: 20,
  });

  if (!error && data) {
    return { jobs: data, usesLocks: true, error: null };
  }

  if (!isMissingRpcError(error)) {
    return { jobs: [], usesLocks: true, error };
  }

  console.warn(
    "claim_due_scheduled_jobs RPC is missing; falling back to legacy job claim"
  );

  const { data: dueJobs, error: fallbackError } = await supabase
    .from("scheduled_jobs")
    .select("id, type, payload, attempts")
    .eq("status", "pending")
    .lte("run_at", new Date().toISOString())
    .order("run_at", { ascending: true })
    .limit(20);

  if (fallbackError || !dueJobs) {
    return { jobs: [], usesLocks: false, error: fallbackError };
  }

  const claimed: ScheduledJob[] = [];

  for (const job of dueJobs) {
    const attempts = job.attempts + 1;
    const { data: updated, error: updateError } = await supabase
      .from("scheduled_jobs")
      .update({ status: "processing", attempts })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id, type, payload, attempts")
      .maybeSingle();

    if (updateError) {
      return { jobs: claimed, usesLocks: false, error: updateError };
    }

    if (updated) {
      claimed.push(updated);
    }
  }

  return { jobs: claimed, usesLocks: false, error: null };
}

function isMissingRpcError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  return code === "PGRST202" || message?.includes("Could not find the function");
}

async function processJob(
  supabase: ServiceClient,
  job: { type: string; payload: Json }
) {
  switch (job.type) {
    case "resume_flow": {
      const payload = job.payload as {
        sessionId: string;
        flowId: string;
        channelId: string;
        contactId: string;
        conversationId: string;
        workspaceId: string;
        nodeId: string;
        lateConversationId?: string | null;
        lateAccountId?: string | null;
      };

      await resumeDelayedFlow(supabase, payload);
      break;
    }

    case "send_broadcast": {
      const payload = job.payload as {
        broadcastId: string;
        recipientId: string;
      };

      // Process individual broadcast recipient
      const { data: recipient } = await supabase
        .from("broadcast_recipients")
        .select("*, contacts(*), channels(*), broadcasts(*)")
        .eq("id", payload.recipientId)
        .single();

      if (!recipient || recipient.status !== "pending") return;

      // Get workspace API key
      const broadcast = recipient.broadcasts as { workspace_id: string } | null;
      if (!broadcast) return;

      const { data: workspace } = await supabase
        .from("workspaces")
        .select("late_api_key_encrypted")
        .eq("id", broadcast.workspace_id)
        .single();

      if (!workspace?.late_api_key_encrypted) return;

      const { createZernioClient } = await import("@/lib/zernio-client");
      const zernio = createZernioClient(workspace.late_api_key_encrypted);

      const channel = recipient.channels as { late_account_id: string } | null;
      if (!channel) return;

      // Get the conversation for this contact+channel (need late_conversation_id)
      const { data: conv } = await supabase
        .from("conversations")
        .select("late_conversation_id")
        .eq("contact_id", recipient.contact_id)
        .eq("channel_id", recipient.channel_id)
        .single();

      if (!conv?.late_conversation_id) return;

      const broadcastData = recipient.broadcasts as { message_content: { text?: string } } | null;
      const messageContent = broadcastData?.message_content;

      try {
        await zernio.messages.sendInboxMessage({
          path: { conversationId: conv.late_conversation_id },
          body: { accountId: channel.late_account_id, message: messageContent?.text || "" },
        });

        await supabase
          .from("broadcast_recipients")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", payload.recipientId);

        // Increment broadcast sent count
        await supabase.rpc("increment_broadcast_sent", {
          b_id: payload.broadcastId,
        });
      } catch (err) {
        await supabase
          .from("broadcast_recipients")
          .update({
            status: "failed",
            error_message: err instanceof Error ? err.message : String(err),
          })
          .eq("id", payload.recipientId);

        await supabase.rpc("increment_broadcast_failed", {
          b_id: payload.broadcastId,
        });
      }

      // Check if all recipients are done (no more "pending")
      const { count } = await supabase
        .from("broadcast_recipients")
        .select("id", { count: "exact", head: true })
        .eq("broadcast_id", payload.broadcastId)
        .eq("status", "pending");

      if (count === 0) {
        await supabase
          .from("broadcasts")
          .update({ status: "completed" })
          .eq("id", payload.broadcastId)
          .eq("status", "sending");
      }
      break;
    }

    default:
      console.warn(`Unknown job type: ${job.type}`);
  }
}
