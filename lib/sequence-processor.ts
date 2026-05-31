import { createServiceClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import type { SequenceStep } from "@/lib/types/database";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;
type ClaimedEnrollment = {
  id: string;
  sequence_id: string;
  contact_id: string;
  channel_id: string;
  current_step_index: number;
  sequence_workspace_id: string;
  sequence_steps: unknown;
  sequence_status: string;
};

/**
 * Process all sequence enrollments that are due.
 * Called by the cron endpoint every 30-60 seconds.
 */
export async function processSequenceSteps() {
  const supabase = await createServiceClient();

  const { enrollments, usesLocks, error } = await claimDueSequenceEnrollments(
    supabase
  );

  if (error) {
    console.error("Failed to fetch sequence enrollments:", error);
    return { processed: 0, failed: 0 };
  }

  let processed = 0;
  let failed = 0;

  for (const enrollment of enrollments) {
    try {
      await processEnrollment(supabase, enrollment, usesLocks);
      processed++;
    } catch (err) {
      console.error(
        `Failed to process enrollment ${enrollment.id}:`,
        err instanceof Error ? err.message : err
      );
      await supabase.from("sequence_enrollments").update({
        status: "active",
        ...(usesLocks ? { locked_at: null } : {}),
      }).eq("id", enrollment.id).eq("status", "processing");
      failed++;
    }
  }

  return { processed, failed, total: enrollments.length };
}

async function claimDueSequenceEnrollments(
  supabase: ServiceClient
): Promise<{
  enrollments: ClaimedEnrollment[];
  usesLocks: boolean;
  error: unknown;
}> {
  const { data, error } = await supabase.rpc(
    "claim_due_sequence_enrollments",
    { batch_size: 50 }
  );

  if (!error && data) {
    return { enrollments: data, usesLocks: true, error: null };
  }

  if (!isMissingRpcError(error)) {
    return { enrollments: [], usesLocks: true, error };
  }

  console.warn(
    "claim_due_sequence_enrollments RPC is missing; falling back to legacy enrollment claim"
  );

  const { data: dueEnrollments, error: fallbackError } = await supabase
    .from("sequence_enrollments")
    .select(
      "id, sequence_id, contact_id, channel_id, current_step_index, sequences!inner(workspace_id, steps, status)"
    )
    .eq("status", "active")
    .lte("next_step_at", new Date().toISOString())
    .order("next_step_at", { ascending: true })
    .limit(50);

  if (fallbackError || !dueEnrollments) {
    return { enrollments: [], usesLocks: false, error: fallbackError };
  }

  const claimed: ClaimedEnrollment[] = [];

  for (const enrollment of dueEnrollments) {
    const { data: updated, error: updateError } = await supabase
      .from("sequence_enrollments")
      .update({ status: "processing" })
      .eq("id", enrollment.id)
      .eq("status", "active")
      .select("id")
      .maybeSingle();

    if (updateError) {
      return { enrollments: claimed, usesLocks: false, error: updateError };
    }

    if (updated) {
      const sequence = Array.isArray(enrollment.sequences)
        ? enrollment.sequences[0]
        : enrollment.sequences;

      claimed.push({
        id: enrollment.id,
        sequence_id: enrollment.sequence_id,
        contact_id: enrollment.contact_id,
        channel_id: enrollment.channel_id,
        current_step_index: enrollment.current_step_index,
        sequence_workspace_id: sequence.workspace_id,
        sequence_steps: sequence.steps,
        sequence_status: sequence.status,
      });
    }
  }

  return { enrollments: claimed, usesLocks: false, error: null };
}

function isMissingRpcError(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const { code, message } = error as { code?: string; message?: string };
  return code === "PGRST202" || message?.includes("Could not find the function");
}

async function processEnrollment(
  supabase: ServiceClient,
  enrollment: ClaimedEnrollment,
  usesLocks: boolean
) {
  if (enrollment.sequence_status !== "active") {
    // Sequence was paused/deleted, cancel enrollment
    await supabase.from("sequence_enrollments").update({
      status: "cancelled",
      ...(usesLocks ? { locked_at: null } : {}),
    }).eq("id", enrollment.id);
    return;
  }

  const steps = (enrollment.sequence_steps as SequenceStep[]) || [];
  const stepIndex = enrollment.current_step_index;

  if (stepIndex >= steps.length) {
    // No more steps, complete the enrollment
    await supabase
      .from("sequence_enrollments")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        ...(usesLocks ? { locked_at: null } : {}),
      })
      .eq("id", enrollment.id);
    return;
  }

  const currentStep = steps[stepIndex];

  if (currentStep.type === "message") {
    await sendSequenceMessage(
      supabase,
      enrollment.sequence_workspace_id,
      enrollment.contact_id,
      enrollment.channel_id,
      currentStep.content || ""
    );
  }
  // Delay steps don't need action; they just waited until next_step_at

  // Advance to next step
  const nextIndex = stepIndex + 1;

  if (nextIndex >= steps.length) {
    // Completed
    await supabase
      .from("sequence_enrollments")
      .update({
        current_step_index: nextIndex,
        status: "completed",
        completed_at: new Date().toISOString(),
        next_step_at: null,
        ...(usesLocks ? { locked_at: null } : {}),
      })
      .eq("id", enrollment.id);
    return;
  }

  // Calculate next_step_at based on the next step
  const nextStep = steps[nextIndex];
  let nextStepAt: string;

  if (nextStep.type === "delay" && nextStep.delayMinutes) {
    nextStepAt = new Date(
      Date.now() + nextStep.delayMinutes * 60 * 1000
    ).toISOString();
  } else {
    // Next step is a message, execute it on the next cron tick
    nextStepAt = new Date().toISOString();
  }

  await supabase
    .from("sequence_enrollments")
    .update({
      current_step_index: nextIndex,
      status: "active",
      next_step_at: nextStepAt,
      ...(usesLocks ? { locked_at: null } : {}),
    })
    .eq("id", enrollment.id);
}

async function sendSequenceMessage(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  workspaceId: string,
  contactId: string,
  channelId: string,
  text: string
) {
  // Get workspace API key
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("late_api_key_encrypted")
    .eq("id", workspaceId)
    .single();

  if (!workspace?.late_api_key_encrypted) {
    console.error("No Zernio API key for workspace:", workspaceId);
    return;
  }

  const zernio = createZernioClient(workspace.late_api_key_encrypted);

  // Get channel's late_account_id
  const { data: channel } = await supabase
    .from("channels")
    .select("late_account_id")
    .eq("id", channelId)
    .single();

  if (!channel?.late_account_id) {
    console.error("No late_account_id for channel:", channelId);
    return;
  }

  // Get conversation for this contact + channel
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id, late_conversation_id")
    .eq("contact_id", contactId)
    .eq("channel_id", channelId)
    .single();

  if (!conversation?.late_conversation_id) {
    console.error(
      "No conversation found for contact:",
      contactId,
      "channel:",
      channelId
    );
    return;
  }

  try {
    const response = await zernio.messages.sendInboxMessage({
      path: { conversationId: conversation.late_conversation_id },
      body: { accountId: channel.late_account_id, message: text },
    });

    // Store outbound message
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      text,
      status: "sent",
      platform_message_id: response.data?.data?.messageId || null,
    });
  } catch (err) {
    console.error("Failed to send sequence message:", err);

    // Store failed message
    await supabase.from("messages").insert({
      conversation_id: conversation.id,
      direction: "outbound",
      text,
      status: "failed",
    });
  }
}
