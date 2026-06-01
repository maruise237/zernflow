import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { matchTrigger } from "@/lib/flow-engine/trigger-matcher";
import { executeFlow } from "@/lib/flow-engine/engine";
import { recordAutomationEvent } from "@/lib/automation-events";
import { recordAppLog } from "@/lib/app-logs";

type LiveTestBody = {
  channelId?: string;
  conversationId?: string;
  text?: string;
  flowId?: string;
};

type TriggerDiagnostic = {
  id: string;
  flowId: string;
  flowName?: string;
  flowStatus?: string;
  channelId: string | null;
  type: string;
  priority: number;
  config: unknown;
};

function summarizeTrigger(trigger: {
  id: string;
  flow_id: string;
  channel_id: string | null;
  type: string;
  priority: number;
  config: unknown;
  flows?: { name?: string | null; status?: string | null } | null;
}): TriggerDiagnostic {
  return {
    id: trigger.id,
    flowId: trigger.flow_id,
    flowName: trigger.flows?.name || undefined,
    flowStatus: trigger.flows?.status || undefined,
    channelId: trigger.channel_id,
    type: trigger.type,
    priority: trigger.priority,
    config: trigger.config,
  };
}

async function getTriggerDiagnostics({
  supabase,
  workspaceId,
  channelId,
  flowId,
  conversationId,
}: {
  supabase: ReturnType<typeof createServiceClient> extends Promise<infer T> ? T : never;
  workspaceId: string;
  channelId: string;
  flowId?: string;
  conversationId?: string;
}) {
  let candidateQuery = supabase
    .from("triggers")
    .select("id, flow_id, channel_id, type, priority, config, flows!inner(name, status, workspace_id)")
    .or(`channel_id.eq.${channelId},channel_id.is.null`)
    .eq("is_active", true)
    .eq("flows.status", "published")
    .eq("flows.workspace_id", workspaceId);

  let workspaceQuery = supabase
    .from("triggers")
    .select("id, flow_id, channel_id, type, priority, config, flows!inner(name, status, workspace_id)")
    .eq("is_active", true)
    .eq("flows.workspace_id", workspaceId);

  if (flowId) {
    candidateQuery = candidateQuery.eq("flow_id", flowId);
    workspaceQuery = workspaceQuery.eq("flow_id", flowId);
  }

  const [{ data: candidateTriggers }, { data: workspaceTriggers }, { count: inboundMessageCount }] = await Promise.all([
    candidateQuery.order("priority", { ascending: false }),
    workspaceQuery.order("created_at", { ascending: false }).limit(40),
    conversationId
      ? supabase
          .from("messages")
          .select("*", { count: "exact", head: true })
          .eq("conversation_id", conversationId)
          .eq("direction", "inbound")
      : Promise.resolve({ count: null }),
  ]);

  const candidates = (candidateTriggers ?? []).map(summarizeTrigger);
  const allWorkspaceTriggers = (workspaceTriggers ?? []).map(summarizeTrigger);

  let reason = "unknown";
  if (candidates.length === 0) {
    reason = allWorkspaceTriggers.length === 0
      ? "no_published_triggers_in_workspace"
      : "no_active_published_triggers_for_channel";
  } else if (candidates.every((trigger) => trigger.type === "comment_keyword")) {
    reason = "only_comment_triggers_found_for_dm_test";
  } else if (
    candidates.every((trigger) => trigger.type === "welcome") &&
    (inboundMessageCount ?? 0) > 1
  ) {
    reason = "welcome_trigger_requires_first_inbound_message";
  } else {
    reason = "candidate_triggers_found_but_no_rule_matched_text";
  }

  return {
    reason,
    candidateCount: candidates.length,
    candidates,
    inboundMessageCount,
    workspaceTriggerCount: allWorkspaceTriggers.length,
    workspaceTriggers: allWorkspaceTriggers,
  };
}

export async function POST(request: NextRequest) {
  const authSupabase = await createClient();
  const serviceSupabase = await createServiceClient();

  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { data: membership } = await authSupabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Aucun workspace" }, { status: 404 });
  }

  const body = (await request.json()) as LiveTestBody;
  const text = body.text?.trim() || "test";
  const flowId = body.flowId?.trim() || undefined;

  if (!body.channelId || !body.conversationId) {
    return NextResponse.json(
      { error: "Choisissez un canal et une conversation réelle." },
      { status: 400 }
    );
  }

  const { data: channel } = await serviceSupabase
    .from("channels")
    .select("*")
    .eq("id", body.channelId)
    .eq("workspace_id", membership.workspace_id)
    .eq("is_active", true)
    .single();

  if (!channel) {
    return NextResponse.json({ error: "Canal actif introuvable" }, { status: 404 });
  }

  const { data: conversation } = await serviceSupabase
    .from("conversations")
    .select("id, contact_id, late_conversation_id, is_automation_paused")
    .eq("id", body.conversationId)
    .eq("workspace_id", membership.workspace_id)
    .eq("channel_id", channel.id)
    .single();

  if (!conversation?.late_conversation_id) {
    return NextResponse.json(
      { error: "Cette conversation n'a pas de late_conversation_id. Synchronisez l'inbox ou choisissez une vraie conversation." },
      { status: 400 }
    );
  }

  await recordAppLog(serviceSupabase, {
    workspace_id: membership.workspace_id,
    level: "info",
    source: "live_test",
    message: "Live DM test started",
    metadata: {
      channelId: channel.id,
      conversationId: conversation.id,
      flowId: flowId ?? null,
      text,
      userId: user.id,
    },
  });

  await serviceSupabase.from("messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    text,
    platform_message_id: `live-test-${Date.now()}`,
    status: "sent",
  });

  await recordAutomationEvent(serviceSupabase, {
    workspace_id: membership.workspace_id,
    channel_id: channel.id,
    contact_id: conversation.contact_id,
    conversation_id: conversation.id,
    source: "live_test",
    event_type: "webhook_received",
    status: "info",
    message: "Live test injected an inbound DM into a real conversation",
    metadata: { text, flowId: flowId ?? null },
  });

  if (conversation.is_automation_paused) {
    await recordAutomationEvent(serviceSupabase, {
      workspace_id: membership.workspace_id,
      channel_id: channel.id,
      contact_id: conversation.contact_id,
      conversation_id: conversation.id,
      source: "live_test",
      event_type: "automation_paused",
      status: "skipped",
      message: "Live test stopped because automation is paused for this conversation",
    });

    return NextResponse.json({
      ok: true,
      matched: false,
      reason: "automation_paused",
    });
  }

  const incomingMessage = {
    text,
    sender: {
      id: `live-test-${user.id}`,
      name: "Live Test",
      username: "live-test",
    },
  };

  const trigger = await matchTrigger(
    serviceSupabase,
    channel.id,
    conversation.id,
    incomingMessage,
    { flowId, workspaceId: membership.workspace_id }
  );
  const triggerDiagnostics = await getTriggerDiagnostics({
    supabase: serviceSupabase,
    workspaceId: membership.workspace_id,
    channelId: channel.id,
    flowId,
    conversationId: conversation.id,
  });

  if (!trigger) {
    await recordAutomationEvent(serviceSupabase, {
      workspace_id: membership.workspace_id,
      channel_id: channel.id,
      contact_id: conversation.contact_id,
      conversation_id: conversation.id,
      source: "live_test",
      event_type: "trigger_not_matched",
      status: "skipped",
      message: "Live DM test did not match any published trigger",
      metadata: { text, flowId: flowId ?? null, triggerDiagnostics },
    });

    await recordAppLog(serviceSupabase, {
      workspace_id: membership.workspace_id,
      level: "info",
      source: "live_test",
      message: "Live DM test did not match a trigger",
      metadata: { text, flowId: flowId ?? null, triggerDiagnostics },
    });

    return NextResponse.json({ ok: true, matched: false, diagnostics: triggerDiagnostics });
  }

  await recordAutomationEvent(serviceSupabase, {
    workspace_id: membership.workspace_id,
    flow_id: trigger.flow_id,
    trigger_id: trigger.id,
    channel_id: channel.id,
    contact_id: conversation.contact_id,
    conversation_id: conversation.id,
    source: "live_test",
    event_type: "trigger_matched",
    status: "success",
    message: "Live DM test matched a published trigger",
      metadata: { triggerType: trigger.type, text, flowId: flowId ?? null, triggerDiagnostics },
  });

  try {
    await executeFlow(serviceSupabase, {
      triggerId: trigger.id,
      flowId: trigger.flow_id,
      channelId: channel.id,
      contactId: conversation.contact_id,
      conversationId: conversation.id,
      workspaceId: membership.workspace_id,
      lateConversationId: conversation.late_conversation_id,
      lateAccountId: channel.late_account_id,
      incomingMessage,
    });

    await recordAppLog(serviceSupabase, {
      workspace_id: membership.workspace_id,
      level: "info",
      source: "live_test",
      message: "Live DM test executed flow",
      metadata: { flowId: trigger.flow_id, triggerId: trigger.id },
    });

    return NextResponse.json({
      ok: true,
      matched: true,
      flowId: trigger.flow_id,
      triggerId: trigger.id,
      diagnostics: triggerDiagnostics,
    });
  } catch (error) {
    await recordAppLog(serviceSupabase, {
      workspace_id: membership.workspace_id,
      level: "error",
      source: "live_test",
      message: error instanceof Error ? error.message : "Unknown live test error",
      metadata: { flowId: trigger.flow_id, triggerId: trigger.id },
    });

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Live test failed" },
      { status: 500 }
    );
  }
}
