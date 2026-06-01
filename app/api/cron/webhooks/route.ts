import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { recordAppLog } from "@/lib/app-logs";
import { createZernioClient } from "@/lib/zernio-client";
import { ensureZernflowWebhook } from "@/lib/zernio-webhook";

type ServiceClient = Awaited<ReturnType<typeof createServiceClient>>;

type WorkspaceWithKey = {
  id: string;
  late_api_key_encrypted: string | null;
};

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret =
    request.nextUrl.searchParams.get("key") ||
    request.headers.get("authorization")?.replace("Bearer ", "");

  if (!cronSecret || providedSecret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createServiceClient();
  const { data: workspaces, error } = await supabase
    .from("workspaces")
    .select("id, late_api_key_encrypted")
    .not("late_api_key_encrypted", "is", null);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let checked = 0;
  let ensured = 0;
  let skipped = 0;
  let failed = 0;

  for (const workspace of (workspaces ?? []) as WorkspaceWithKey[]) {
    checked++;

    try {
      const hasPublishedTriggers = await workspaceHasPublishedTriggers(
        supabase,
        workspace.id
      );

      if (!hasPublishedTriggers || !workspace.late_api_key_encrypted) {
        skipped++;
        continue;
      }

      const webhook = await ensureZernflowWebhook(
        createZernioClient(workspace.late_api_key_encrypted)
      );

      if (webhook.skipped) {
        skipped++;
      } else {
        ensured++;
      }

      await recordAppLog(supabase, {
        workspace_id: workspace.id,
        level: webhook.skipped ? "warn" : "info",
        source: "webhook_watchdog",
        message: webhook.skipped
          ? "Webhook watchdog could not confirm Zernio webhook"
          : "Webhook watchdog confirmed Zernio webhook",
        metadata: { webhook },
      });
    } catch (err) {
      failed++;
      await recordAppLog(supabase, {
        workspace_id: workspace.id,
        level: "error",
        source: "webhook_watchdog",
        message: err instanceof Error ? err.message : "Unknown webhook watchdog error",
      });
    }
  }

  return NextResponse.json({ checked, ensured, skipped, failed });
}

async function workspaceHasPublishedTriggers(
  supabase: ServiceClient,
  workspaceId: string
) {
  const { data, error } = await supabase
    .from("triggers")
    .select("id, flows!inner(workspace_id, status)")
    .eq("is_active", true)
    .eq("flows.workspace_id", workspaceId)
    .eq("flows.status", "published")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return Boolean(data);
}
