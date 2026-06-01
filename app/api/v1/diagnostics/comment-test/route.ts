import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { executeFlow } from "@/lib/flow-engine/engine";
import { recordAutomationEvent } from "@/lib/automation-events";
import { recordAppLog } from "@/lib/app-logs";
import type { Database } from "@/lib/types/database";

type SupabaseService = Awaited<ReturnType<typeof createServiceClient>>;
type TriggerRow = Database["public"]["Tables"]["triggers"]["Row"];
type Trigger = Pick<TriggerRow, "id" | "flow_id" | "channel_id" | "type" | "priority" | "config"> & {
  flows?: { name?: string | null; status?: string | null } | null;
};

type CommentTestBody = {
  channelId?: string;
  text?: string;
  postId?: string;
  commentId?: string;
  flowId?: string;
};

function keywordMatches(text: string, keywords: Array<string | { value: string; matchType?: string }> | undefined) {
  if (!keywords?.length) return true;

  const normalizedText = text.toLowerCase().trim();
  return keywords.some((kw) => {
    const keyword = (typeof kw === "string" ? kw : kw.value).toLowerCase().trim();
    const matchType = (typeof kw === "object" && kw.matchType) || "contains";

    if (!keyword) return false;
    if (matchType === "exact") return normalizedText === keyword;
    if (matchType === "startsWith") return normalizedText.startsWith(keyword);
    return normalizedText.includes(keyword);
  });
}

async function getCommentTriggerDiagnostics({
  supabase,
  workspaceId,
  channelId,
  text,
  postId,
  flowId,
}: {
  supabase: SupabaseService;
  workspaceId: string;
  channelId: string;
  text: string;
  postId?: string;
  flowId?: string;
}) {
  let candidateQuery = supabase
    .from("triggers")
    .select("id, flow_id, channel_id, type, priority, config, flows!inner(name, status, workspace_id)")
    .or(`channel_id.eq.${channelId},channel_id.is.null`)
    .eq("type", "comment_keyword")
    .eq("is_active", true)
    .eq("flows.status", "published")
    .eq("flows.workspace_id", workspaceId);

  let workspaceQuery = supabase
    .from("triggers")
    .select("id, flow_id, channel_id, type, priority, config, flows!inner(name, status, workspace_id)")
    .eq("type", "comment_keyword")
    .eq("is_active", true)
    .eq("flows.workspace_id", workspaceId);

  if (flowId) {
    candidateQuery = candidateQuery.eq("flow_id", flowId);
    workspaceQuery = workspaceQuery.eq("flow_id", flowId);
  }

  const [{ data: candidates }, { data: workspaceTriggers }] = await Promise.all([
    candidateQuery.order("priority", { ascending: false }),
    workspaceQuery.order("created_at", { ascending: false }).limit(40),
  ]);

  const detailed = ((candidates ?? []) as Trigger[]).map((trigger) => {
    const config = trigger.config as {
      keywords?: Array<string | { value: string; matchType?: string }>;
      postIds?: string[];
    };
    const postIds = config.postIds?.filter(Boolean) ?? [];
    const postMatches = postIds.length === 0 || (postId ? postIds.includes(postId) : false);
    const keywordsMatch = keywordMatches(text, config.keywords);

    return {
      id: trigger.id,
      flowId: trigger.flow_id,
      flowName: trigger.flows?.name,
      flowStatus: trigger.flows?.status,
      channelId: trigger.channel_id,
      type: trigger.type,
      priority: trigger.priority,
      config: trigger.config,
      checks: { postMatches, keywordsMatch },
    };
  });

  const matched = detailed.find((trigger) => trigger.checks.postMatches && trigger.checks.keywordsMatch);

  let reason = "unknown";
  if (detailed.length === 0) {
    reason = (workspaceTriggers ?? []).length === 0
      ? "no_comment_triggers_in_workspace"
      : "no_comment_triggers_for_channel";
  } else if (!matched && detailed.every((trigger) => !trigger.checks.postMatches)) {
    reason = "post_id_did_not_match_trigger_scope";
  } else if (!matched) {
    reason = "comment_keywords_did_not_match_text";
  } else {
    reason = "comment_trigger_matched";
  }

  return {
    reason,
    matchedTriggerId: matched?.id ?? null,
    candidateCount: detailed.length,
    candidates: detailed,
    workspaceTriggerCount: workspaceTriggers?.length ?? 0,
    workspaceTriggers: workspaceTriggers ?? [],
  };
}

export async function POST(request: NextRequest) {
  const authSupabase = await createClient();
  const serviceSupabase = await createServiceClient();

  const {
    data: { user },
  } = await authSupabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: membership } = await authSupabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return NextResponse.json({ error: "Aucun workspace" }, { status: 404 });

  const body = (await request.json()) as CommentTestBody;
  const text = body.text?.trim() || "test";
  const flowId = body.flowId?.trim() || undefined;

  if (!body.channelId) {
    return NextResponse.json({ error: "Choisissez un canal." }, { status: 400 });
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

  const diagnostics = await getCommentTriggerDiagnostics({
    supabase: serviceSupabase,
    workspaceId: membership.workspace_id,
    channelId: channel.id,
    text,
    postId: body.postId?.trim() || undefined,
    flowId,
  });

  const matched = diagnostics.candidates.find(
    (trigger) => trigger.id === diagnostics.matchedTriggerId
  );

  await recordAppLog(serviceSupabase, {
    workspace_id: membership.workspace_id,
    level: matched ? "info" : "warn",
    source: "comment_live_test",
    message: matched ? "Comment live test matched a trigger" : "Comment live test did not match a trigger",
    metadata: { text, postId: body.postId || null, flowId: flowId ?? null, diagnostics },
  });

  if (!matched) {
    await recordAutomationEvent(serviceSupabase, {
      workspace_id: membership.workspace_id,
      channel_id: channel.id,
      source: "comment_live_test",
      event_type: "trigger_not_matched",
      status: "skipped",
      message: "Comment live test did not match any published comment trigger",
      metadata: { text, flowId: flowId ?? null, diagnostics },
    });

    return NextResponse.json({ ok: true, matched: false, diagnostics });
  }

  await recordAutomationEvent(serviceSupabase, {
    workspace_id: membership.workspace_id,
    flow_id: matched.flowId,
    trigger_id: matched.id,
    channel_id: channel.id,
    source: "comment_live_test",
    event_type: "trigger_matched",
    status: "success",
    message: "Comment live test matched a published trigger",
    metadata: { text, flowId: flowId ?? null, diagnostics },
  });

  const postId = body.postId?.trim();
  const commentId = body.commentId?.trim();
  if (!postId || !commentId) {
    return NextResponse.json({
      ok: true,
      matched: true,
      executed: false,
      reason: "post_id_and_comment_id_required_to_execute_private_reply",
      flowId: matched.flowId,
      triggerId: matched.id,
      diagnostics,
    });
  }

  const senderId = `comment-live-test-${user.id}`;
  const { data: existingContactChannel } = await serviceSupabase
    .from("contact_channels")
    .select("contact_id")
    .eq("channel_id", channel.id)
    .eq("platform_sender_id", senderId)
    .maybeSingle();

  let contactId = existingContactChannel?.contact_id ?? null;
  if (!contactId) {
    const { data: contact } = await serviceSupabase
      .from("contacts")
      .insert({
        workspace_id: membership.workspace_id,
        display_name: "Comment Live Test",
        last_interaction_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    contactId = contact?.id ?? null;
    if (contactId) {
      await serviceSupabase.from("contact_channels").insert({
        contact_id: contactId,
        channel_id: channel.id,
        platform_sender_id: senderId,
        platform_username: "comment-live-test",
      });
    }
  }

  if (!contactId) {
    return NextResponse.json({ error: "Impossible de créer le contact de test" }, { status: 500 });
  }

  const { data: existingConversation } = await serviceSupabase
    .from("conversations")
    .select("id")
    .eq("channel_id", channel.id)
    .eq("contact_id", contactId)
    .maybeSingle();

  let conversationId = existingConversation?.id ?? null;
  if (!conversationId) {
    const { data: conversation } = await serviceSupabase
      .from("conversations")
      .insert({
        workspace_id: membership.workspace_id,
        channel_id: channel.id,
        contact_id: contactId,
        platform: channel.platform,
        status: "open",
        last_message_at: new Date().toISOString(),
        last_message_preview: text.slice(0, 100),
      })
      .select("id")
      .single();
    conversationId = conversation?.id ?? null;
  }

  if (!conversationId) {
    return NextResponse.json({ error: "Impossible de créer la conversation de test" }, { status: 500 });
  }

  await executeFlow(serviceSupabase, {
    triggerId: matched.id,
    flowId: matched.flowId,
    channelId: channel.id,
    contactId,
    conversationId,
    workspaceId: membership.workspace_id,
    lateAccountId: channel.late_account_id,
    incomingMessage: {
      text,
      sender: { id: senderId, name: "Comment Live Test", username: "comment-live-test" },
    },
    variables: {
      comment_id: commentId,
      post_id: postId,
      comment_text: text,
      commenter_id: senderId,
      commenter_name: "Comment Live Test",
      commenter_username: "comment-live-test",
    },
  });

  return NextResponse.json({
    ok: true,
    matched: true,
    executed: true,
    flowId: matched.flowId,
    triggerId: matched.id,
    diagnostics,
  });
}
