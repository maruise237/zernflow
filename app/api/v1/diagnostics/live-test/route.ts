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
};

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
    metadata: { text },
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
    incomingMessage
  );

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
      metadata: { text },
    });

    return NextResponse.json({ ok: true, matched: false });
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
    metadata: { triggerType: trigger.type, text },
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
