import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { executeFlow } from "@/lib/flow-engine/engine";
import { matchTrigger } from "@/lib/flow-engine/trigger-matcher";
import { createZernioClient } from "@/lib/zernio-client";
import type { Database } from "@/lib/types/database";
import { recordAutomationEvent } from "@/lib/automation-events";
import crypto from "crypto";

// ── Zernio API webhook payload ───────────────────────────────────────────────

interface WebhookPayload {
  event: string;
  message: {
    id: string;
    conversationId: string;
    platform: string;
    platformMessageId: string;
    direction: string;
    text: string | null;
    attachments: Array<{ type: string; url: string; payload?: string }>;
    sender: {
      id: string;
      name: string;
      username: string | null;
      picture: string | null;
    };
    sentAt: string;
    isRead: boolean;
  };
  conversation: {
    id: string;
    platformConversationId: string | null;
    participantId: string;
    participantName: string;
    participantUsername: string | null;
    participantPicture: string | null;
    status: string;
  };
  account: {
    id: string;
    platform: string;
    username: string;
    displayName: string;
  };
  metadata?: {
    quickReplyPayload?: string;
    callbackData?: string;
    postbackPayload?: string;
    postbackTitle?: string;
  };
  timestamp: string;
}

interface CommentWebhookPayload {
  id?: string;
  event: "comment.received";
  comment: {
    id: string;
    postId: string | null;
    platformPostId: string;
    platform: string;
    text: string;
    author: {
      id: string;
      username?: string;
      name?: string;
      picture?: string | null;
    };
    createdAt: string;
    isReply: boolean;
    parentCommentId: string | null;
  };
  post: {
    id: string | null;
    platformPostId: string;
  };
  account: {
    id: string;
    platform: string;
    username: string;
  };
  timestamp: string;
}

type SupabaseService = Awaited<ReturnType<typeof createServiceClient>>;
type Channel = Database["public"]["Tables"]["channels"]["Row"];
type Trigger = Database["public"]["Tables"]["triggers"]["Row"];

type CommentTriggerConfig = {
  keywords?: Array<string | { value: string; matchType?: "exact" | "contains" | "startsWith" }>;
  postIds?: string[];
  replyText?: string;
};

// ── Webhook handler ─────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    return await handleWebhook(request);
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}

async function handleWebhook(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("x-late-signature");

  let payload: WebhookPayload | CommentWebhookPayload | { event?: string };
  try {
    payload = JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (payload.event === "comment.received") {
    return handleCommentWebhook(payload as CommentWebhookPayload, body, signature);
  }

  // Only handle message.received events
  if (payload.event !== "message.received") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const { message: msg, conversation: conv, account, metadata } =
    payload as WebhookPayload;

  // Ignore outbound messages (sent by the bot itself) to prevent loops
  if (msg.direction === "outbound") {
    return NextResponse.json({ ok: true, skipped: true });
  }

  const supabase = await createServiceClient();

  // Look up channel by late_account_id
  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("late_account_id", account.id)
    .eq("is_active", true)
    .single();

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  await recordAutomationEvent(supabase, {
    workspace_id: channel.workspace_id,
    channel_id: channel.id,
    source: "webhook",
    event_type: "webhook_received",
    status: "info",
    message: "Incoming DM webhook received",
    metadata: {
      providerEvent: payload.event,
      accountId: account.id,
      conversationId: conv.id,
      platformMessageId: msg.platformMessageId,
      senderId: msg.sender.id,
      hasText: Boolean(msg.text),
    },
  });

  // Prevent loops: if the sender is another connected account in this
  // workspace, skip. This happens when both sides of a DM conversation
  // are connected (e.g. during testing).
  if (msg.sender.username) {
    const { data: senderChannel } = await supabase
      .from("channels")
      .select("id")
      .eq("workspace_id", channel.workspace_id)
      .eq("username", msg.sender.username)
      .eq("is_active", true)
      .maybeSingle();

    if (senderChannel) {
      await recordAutomationEvent(supabase, {
        workspace_id: channel.workspace_id,
        channel_id: channel.id,
        source: "webhook",
        event_type: "webhook_skipped",
        status: "skipped",
        message: "Sender is another connected account in this workspace",
        metadata: { reason: "sender_is_own_account", senderUsername: msg.sender.username },
      });
      return NextResponse.json({ ok: true, skipped: true, reason: "sender_is_own_account" });
    }
  }

  const signatureError = verifyWebhookSignature(channel, body, signature);
  if (signatureError) {
    return signatureError;
  }

  // ── Upsert contact ───────────────────────────────────────────────────────

  const senderId = msg.sender.id;
  const senderName = msg.sender.name || msg.sender.username || senderId;

  let contactId: string;
  const { data: existingContactChannel } = await supabase
    .from("contact_channels")
    .select("contact_id")
    .eq("channel_id", channel.id)
    .eq("platform_sender_id", senderId)
    .single();

  if (existingContactChannel) {
    contactId = existingContactChannel.contact_id;
    await supabase
      .from("contacts")
      .update({ last_interaction_at: new Date().toISOString() })
      .eq("id", contactId);
  } else {
    const { data: newContact } = await supabase
      .from("contacts")
      .insert({
        workspace_id: channel.workspace_id,
        display_name: senderName,
        avatar_url: msg.sender.picture || null,
        last_interaction_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (!newContact) {
      return NextResponse.json(
        { error: "Failed to create contact" },
        { status: 500 }
      );
    }

    contactId = newContact.id;

    await supabase.from("contact_channels").insert({
      contact_id: contactId,
      channel_id: channel.id,
      platform_sender_id: senderId,
      platform_username: msg.sender.username || null,
    });

    await supabase.from("analytics_events").insert({
      workspace_id: channel.workspace_id,
      contact_id: contactId,
      event_type: "contact_created",
    });
  }

  // ── Upsert conversation ──────────────────────────────────────────────────

  const messagePreview = (msg.text || "").slice(0, 100);

  // Check if conversation already exists for this channel+contact
  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id, is_automation_paused, status")
    .eq("channel_id", channel.id)
    .eq("contact_id", contactId)
    .maybeSingle();

  let conversation: { id: string; is_automation_paused: boolean } | null = null;

  if (existingConversation) {
    // Update existing conversation — only update metadata, preserve status if snoozed
    const { data: updated } = await supabase
      .from("conversations")
      .update({
        late_conversation_id: conv.id,
        last_message_at: new Date().toISOString(),
        last_message_preview: messagePreview,
        // Only reopen if currently closed; preserve snoozed status
        ...(existingConversation.status === "closed" ? { status: "open" as const } : {}),
      })
      .eq("id", existingConversation.id)
      .select("id, is_automation_paused")
      .single();

    conversation = updated;

    // Increment unread count for existing conversations
    if (conversation) {
      await supabase.rpc("increment_unread", {
        conv_id: conversation.id,
        preview: messagePreview,
      });
    }
  } else {
    // Create new conversation
    const { data: inserted } = await supabase
      .from("conversations")
      .insert({
        workspace_id: channel.workspace_id,
        channel_id: channel.id,
        contact_id: contactId,
        platform: channel.platform,
        late_conversation_id: conv.id,
        status: "open",
        last_message_at: new Date().toISOString(),
        last_message_preview: messagePreview,
        unread_count: 1,
      })
      .select("id, is_automation_paused")
      .single();

    conversation = inserted;
  }

  if (!conversation) {
    await recordAutomationEvent(supabase, {
      workspace_id: channel.workspace_id,
      channel_id: channel.id,
      contact_id: contactId,
      source: "webhook",
      event_type: "conversation_upsert_failed",
      status: "error",
      message: "Failed to upsert conversation for incoming DM",
      metadata: { lateConversationId: conv.id },
    });
    return NextResponse.json(
      { error: "Failed to upsert conversation" },
      { status: 500 }
    );
  }

  // ── Store inbound message locally ──────────────────────────────────────
  // Both Zernio and local DB store messages for consistency.
  // This is critical for: AI context, welcome trigger detection, message history, bot attribution.
  await supabase.from("messages").insert({
    conversation_id: conversation.id,
    direction: "inbound",
    text: msg.text || null,
    attachments: msg.attachments?.length ? msg.attachments : null,
    quick_reply_payload: metadata?.quickReplyPayload || null,
    postback_payload: metadata?.postbackPayload || null,
    callback_data: metadata?.callbackData || null,
    platform_message_id: msg.platformMessageId || null,
    status: "sent",
  });

  // ── Flow engine ───────────────────────────────────────────────────────────

  if (!conversation.is_automation_paused) {
    const incomingMessage = {
      text: msg.text || undefined,
      postbackPayload: metadata?.postbackPayload || undefined,
      quickReplyPayload: metadata?.quickReplyPayload || undefined,
      callbackData: metadata?.callbackData || undefined,
      sender: {
        id: msg.sender.id,
        name: msg.sender.name,
        username: msg.sender.username || undefined,
      },
    };

    const handled = await handleGlobalKeywords(
      supabase,
      channel.workspace_id,
      contactId,
      msg.text || undefined
    );

    if (!handled) {
      const trigger = await matchTrigger(
        supabase,
        channel.id,
        conversation.id,
        incomingMessage,
        { workspaceId: channel.workspace_id }
      );
      if (trigger) {
        await recordAutomationEvent(supabase, {
          workspace_id: channel.workspace_id,
          flow_id: trigger.flow_id,
          trigger_id: trigger.id,
          channel_id: channel.id,
          contact_id: contactId,
          conversation_id: conversation.id,
          source: "webhook",
          event_type: "trigger_matched",
          status: "success",
          message: "Incoming DM matched a published trigger",
          metadata: { triggerType: trigger.type, messageText: msg.text || null },
        });

        try {
          await executeFlow(supabase, {
            triggerId: trigger.id,
            flowId: trigger.flow_id,
            channelId: channel.id,
            contactId,
            conversationId: conversation.id,
            workspaceId: channel.workspace_id,
            incomingMessage,
            lateConversationId: conv.id,
            lateAccountId: account.id,
          });
        } catch (err) {
          console.error("Flow execution error:", err);
          await recordAutomationEvent(supabase, {
            workspace_id: channel.workspace_id,
            flow_id: trigger.flow_id,
            trigger_id: trigger.id,
            channel_id: channel.id,
            contact_id: contactId,
            conversation_id: conversation.id,
            source: "flow",
            event_type: "flow_execution_failed",
            status: "error",
            message: err instanceof Error ? err.message : "Unknown flow execution error",
          });
        }
      } else {
        await recordAutomationEvent(supabase, {
          workspace_id: channel.workspace_id,
          channel_id: channel.id,
          contact_id: contactId,
          conversation_id: conversation.id,
          source: "webhook",
          event_type: "trigger_not_matched",
          status: "skipped",
          message: "Incoming DM did not match any published trigger",
          metadata: { messageText: msg.text || null },
        });
      }
    }
  } else {
    await recordAutomationEvent(supabase, {
      workspace_id: channel.workspace_id,
      channel_id: channel.id,
      contact_id: contactId,
      conversation_id: conversation.id,
      source: "webhook",
      event_type: "automation_paused",
      status: "skipped",
      message: "Automation is paused for this conversation",
    });
  }

  return NextResponse.json({ ok: true });
}

async function handleCommentWebhook(
  payload: CommentWebhookPayload,
  body: string,
  signature: string | null
) {
  const supabase = await createServiceClient();
  const { comment, post, account } = payload;

  const { data: channel } = await supabase
    .from("channels")
    .select("*")
    .eq("late_account_id", account.id)
    .eq("is_active", true)
    .single();

  if (!channel) {
    return NextResponse.json({ error: "Channel not found" }, { status: 404 });
  }

  await recordAutomationEvent(supabase, {
    workspace_id: channel.workspace_id,
    channel_id: channel.id,
    source: "webhook",
    event_type: "webhook_received",
    status: "info",
    message: "Comment webhook received",
    metadata: {
      providerEvent: payload.event,
      accountId: account.id,
      commentId: comment.id,
      postId: comment.postId || post.id || comment.platformPostId || post.platformPostId,
      authorId: comment.author.id,
      hasText: Boolean(comment.text),
    },
  });

  const signatureError = verifyWebhookSignature(channel, body, signature);
  if (signatureError) {
    return signatureError;
  }

  if (comment.author.username) {
    const { data: authorChannel } = await supabase
      .from("channels")
      .select("id")
      .eq("workspace_id", channel.workspace_id)
      .eq("username", comment.author.username)
      .eq("is_active", true)
      .maybeSingle();

    if (authorChannel) {
      await recordAutomationEvent(supabase, {
        workspace_id: channel.workspace_id,
        channel_id: channel.id,
        source: "webhook",
        event_type: "webhook_skipped",
        status: "skipped",
        message: "Comment author is another connected account in this workspace",
        metadata: { reason: "comment_author_is_own_account", authorUsername: comment.author.username },
      });
      return NextResponse.json({ ok: true, skipped: true, reason: "comment_author_is_own_account" });
    }
  }

  const { data: existingLog } = await supabase
    .from("comment_logs")
    .select("id")
    .eq("channel_id", channel.id)
    .eq("platform_comment_id", comment.id)
    .maybeSingle();

  if (existingLog) {
    await recordAutomationEvent(supabase, {
      workspace_id: channel.workspace_id,
      channel_id: channel.id,
      source: "webhook",
      event_type: "webhook_skipped",
      status: "skipped",
      message: "Duplicate comment webhook skipped",
      metadata: { reason: "duplicate_comment", commentId: comment.id },
    });
    return NextResponse.json({ ok: true, skipped: true, reason: "duplicate_comment" });
  }

  const matchedTrigger = await matchCommentTrigger(supabase, channel.id, {
    text: comment.text,
    postIds: [comment.postId, post.id, comment.platformPostId, post.platformPostId],
  });

  const postId = comment.postId || post.id || comment.platformPostId || post.platformPostId;

  const { data: insertedLog } = await supabase
    .from("comment_logs")
    .insert({
      channel_id: channel.id,
      workspace_id: channel.workspace_id,
      post_id: postId,
      platform_comment_id: comment.id,
      author_id: comment.author.id,
      author_name: comment.author.name || null,
      author_username: comment.author.username || null,
      comment_text: comment.text,
      matched_trigger_id: matchedTrigger?.id ?? null,
      dm_sent: false,
      reply_sent: false,
    })
    .select("id")
    .single();

  if (!matchedTrigger) {
    await recordAutomationEvent(supabase, {
      workspace_id: channel.workspace_id,
      channel_id: channel.id,
      source: "webhook",
      event_type: "trigger_not_matched",
      status: "skipped",
      message: "Comment did not match any published comment trigger",
      metadata: { commentId: comment.id, postId, commentText: comment.text },
    });
    return NextResponse.json({ ok: true, matched: false });
  }

  await recordAutomationEvent(supabase, {
    workspace_id: channel.workspace_id,
    flow_id: matchedTrigger.flow_id,
    trigger_id: matchedTrigger.id,
    channel_id: channel.id,
    source: "webhook",
    event_type: "trigger_matched",
    status: "success",
    message: "Comment matched a published trigger",
    metadata: { triggerType: matchedTrigger.type, commentId: comment.id, postId },
  });

  const publicReplyText = getCommentTriggerReplyText(matchedTrigger);
  let publicReplySent = false;
  let publicReplyError: string | null = null;
  if (publicReplyText) {
    const replyResult = await sendCommentTriggerPublicReply({
      supabase,
      channel,
      trigger: matchedTrigger,
      postId,
      commentId: comment.id,
      replyText: publicReplyText,
    });
    publicReplySent = replyResult.sent;
    publicReplyError = replyResult.error;
  }

  const { contactId, conversation } = await upsertCommentContactAndConversation(
    supabase,
    channel,
    payload
  );

  if (!contactId || !conversation) {
    await recordAutomationEvent(supabase, {
      workspace_id: channel.workspace_id,
      flow_id: matchedTrigger.flow_id,
      trigger_id: matchedTrigger.id,
      channel_id: channel.id,
      source: "webhook",
      event_type: "conversation_upsert_failed",
      status: "error",
      message: "Failed to upsert comment contact or conversation",
      metadata: { commentId: comment.id, postId },
    });
    if (insertedLog) {
      await supabase
        .from("comment_logs")
        .update({
          reply_sent: publicReplySent,
          error: publicReplyError || "Failed to upsert comment contact or conversation",
        })
        .eq("id", insertedLog.id);
    }
    return NextResponse.json(
      { error: "Failed to upsert comment contact or conversation" },
      { status: 500 }
    );
  }

  if (conversation.is_automation_paused) {
    await recordAutomationEvent(supabase, {
      workspace_id: channel.workspace_id,
      flow_id: matchedTrigger.flow_id,
      trigger_id: matchedTrigger.id,
      channel_id: channel.id,
      contact_id: contactId,
      conversation_id: conversation.id,
      source: "webhook",
      event_type: "automation_paused",
      status: "skipped",
      message: "Automation is paused for this comment conversation",
      metadata: { commentId: comment.id, postId },
    });
    if (insertedLog) {
      await supabase
        .from("comment_logs")
        .update({
          reply_sent: publicReplySent,
          error: publicReplyError || "Automation paused for this contact conversation",
        })
        .eq("id", insertedLog.id);
    }
    return NextResponse.json({ ok: true, skipped: true, reason: "automation_paused" });
  }

  try {
    await executeFlow(supabase, {
      triggerId: matchedTrigger.id,
      flowId: matchedTrigger.flow_id,
      channelId: channel.id,
      contactId,
      conversationId: conversation.id,
      workspaceId: channel.workspace_id,
      lateAccountId: account.id,
      incomingMessage: {
        text: comment.text,
        sender: {
          id: comment.author.id,
          name: comment.author.name,
          username: comment.author.username,
        },
      },
      variables: {
        comment_id: comment.id,
        post_id: postId,
        platform_post_id: comment.platformPostId || post.platformPostId,
        comment_created_at: comment.createdAt,
        comment_text: comment.text,
        commenter_id: comment.author.id,
        commenter_name: comment.author.name || "",
        commenter_username: comment.author.username || "",
      },
    });

    if (insertedLog) {
      const { data: sentMessage } = await supabase
        .from("messages")
        .select("id")
        .eq("conversation_id", conversation.id)
        .eq("sent_by_flow_id", matchedTrigger.flow_id)
        .eq("direction", "outbound")
        .eq("status", "sent")
        .limit(1)
        .maybeSingle();

      await supabase
        .from("comment_logs")
        .update({
          dm_sent: Boolean(sentMessage),
          reply_sent: publicReplySent,
          error: publicReplyError,
        })
        .eq("id", insertedLog.id);
    }
  } catch (error) {
    console.error("Comment flow execution error:", error);
    await recordAutomationEvent(supabase, {
      workspace_id: channel.workspace_id,
      flow_id: matchedTrigger.flow_id,
      trigger_id: matchedTrigger.id,
      channel_id: channel.id,
      contact_id: contactId,
      conversation_id: conversation.id,
      source: "flow",
      event_type: "flow_execution_failed",
      status: "error",
      message: error instanceof Error ? error.message : "Unknown comment flow execution error",
      metadata: { commentId: comment.id, postId },
    });
    if (insertedLog) {
      await supabase
        .from("comment_logs")
        .update({
          reply_sent: publicReplySent,
          error: [
            publicReplyError,
            error instanceof Error ? error.message : "Unknown error",
          ].filter(Boolean).join(" | "),
        })
        .eq("id", insertedLog.id);
    }
  }

  return NextResponse.json({ ok: true, matched: true });
}

function getCommentTriggerReplyText(trigger: Trigger) {
  const config = trigger.config as CommentTriggerConfig;
  return typeof config.replyText === "string" && config.replyText.trim()
    ? config.replyText.trim()
    : null;
}

async function sendCommentTriggerPublicReply({
  supabase,
  channel,
  trigger,
  postId,
  commentId,
  replyText,
}: {
  supabase: SupabaseService;
  channel: Channel;
  trigger: Trigger;
  postId: string;
  commentId: string;
  replyText: string;
}) {
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("late_api_key_encrypted")
    .eq("id", channel.workspace_id)
    .single();

  if (!workspace?.late_api_key_encrypted) {
    return { sent: false, error: "Zernio API key missing for public comment reply" };
  }

  try {
    const zernio = createZernioClient(workspace.late_api_key_encrypted);
    await zernio.comments.replyToInboxPost({
      path: { postId },
      body: {
        accountId: channel.late_account_id,
        message: replyText,
        commentId,
      },
    });

    await recordAutomationEvent(supabase, {
      workspace_id: channel.workspace_id,
      flow_id: trigger.flow_id,
      trigger_id: trigger.id,
      channel_id: channel.id,
      source: "webhook",
      event_type: "node_executed",
      status: "success",
      message: "Comment trigger public reply sent",
      metadata: { postId, commentId, replyText },
    });

    return { sent: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown public reply error";
    await recordAutomationEvent(supabase, {
      workspace_id: channel.workspace_id,
      flow_id: trigger.flow_id,
      trigger_id: trigger.id,
      channel_id: channel.id,
      source: "webhook",
      event_type: "node_failed",
      status: "error",
      message,
      metadata: { postId, commentId, replyText },
    });

    return { sent: false, error: message };
  }
}

function verifyWebhookSignature(
  channel: Pick<Channel, "webhook_secret">,
  body: string,
  signature: string | null
) {
  if (!channel.webhook_secret) return null;
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const expected = crypto
    .createHmac("sha256", channel.webhook_secret)
    .update(body)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== signatureBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  return null;
}

async function matchCommentTrigger(
  supabase: SupabaseService,
  channelId: string,
  comment: { text: string; postIds: Array<string | null | undefined> }
): Promise<Trigger | null> {
  const { data: triggers } = await supabase
    .from("triggers")
    .select("*, flows!inner(status)")
    .or(`channel_id.eq.${channelId},channel_id.is.null`)
    .eq("type", "comment_keyword")
    .eq("is_active", true)
    .eq("flows.status", "published")
    .order("priority", { ascending: false });

  if (!triggers?.length) return null;

  const normalizedText = comment.text.toLowerCase().trim();
  const postIds = new Set(
    comment.postIds.filter((id): id is string => Boolean(id))
  );

  for (const trigger of triggers) {
    const config = trigger.config as CommentTriggerConfig;
    const configuredPostIds = config.postIds?.filter(Boolean) ?? [];
    const postMatches =
      configuredPostIds.length === 0 ||
      configuredPostIds.some((id) => postIds.has(id));

    if (!postMatches) continue;
    if (commentKeywordsMatch(normalizedText, config.keywords)) return trigger;
  }

  return null;
}

function commentKeywordsMatch(
  normalizedText: string,
  keywords: CommentTriggerConfig["keywords"]
) {
  if (!keywords?.length) return true;

  return keywords.some((kw) => {
    const keyword = (typeof kw === "string" ? kw : kw.value).toLowerCase().trim();
    if (!keyword) return false;

    const matchType =
      (typeof kw === "object" && kw.matchType) || "contains";

    if (matchType === "exact") return normalizedText === keyword;
    if (matchType === "startsWith") return normalizedText.startsWith(keyword);
    return normalizedText.includes(keyword);
  });
}

async function upsertCommentContactAndConversation(
  supabase: SupabaseService,
  channel: Channel,
  payload: CommentWebhookPayload
) {
  const { comment } = payload;
  const authorName =
    comment.author.name || comment.author.username || comment.author.id;

  const { data: existingContactChannel } = await supabase
    .from("contact_channels")
    .select("contact_id")
    .eq("channel_id", channel.id)
    .eq("platform_sender_id", comment.author.id)
    .maybeSingle();

  let contactId = existingContactChannel?.contact_id ?? null;

  if (contactId) {
    await supabase
      .from("contacts")
      .update({
        display_name: authorName,
        avatar_url: comment.author.picture || null,
        last_interaction_at: new Date().toISOString(),
      })
      .eq("id", contactId);
  } else {
    const { data: newContact } = await supabase
      .from("contacts")
      .insert({
        workspace_id: channel.workspace_id,
        display_name: authorName,
        avatar_url: comment.author.picture || null,
        last_interaction_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    contactId = newContact?.id ?? null;
    if (contactId) {
      await supabase.from("contact_channels").insert({
        contact_id: contactId,
        channel_id: channel.id,
        platform_sender_id: comment.author.id,
        platform_username: comment.author.username || null,
      });
    }
  }

  if (!contactId) return { contactId: null, conversation: null };

  const { data: existingConversation } = await supabase
    .from("conversations")
    .select("id, is_automation_paused, status")
    .eq("channel_id", channel.id)
    .eq("contact_id", contactId)
    .maybeSingle();

  const preview = comment.text.slice(0, 100);
  if (existingConversation) {
    const { data: conversation } = await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: preview,
        ...(existingConversation.status === "closed" ? { status: "open" as const } : {}),
      })
      .eq("id", existingConversation.id)
      .select("id, is_automation_paused")
      .single();

    return { contactId, conversation };
  }

  const { data: conversation } = await supabase
    .from("conversations")
    .insert({
      workspace_id: channel.workspace_id,
      channel_id: channel.id,
      contact_id: contactId,
      platform: channel.platform,
      late_conversation_id: null,
      status: "open",
      last_message_at: new Date().toISOString(),
      last_message_preview: preview,
      unread_count: 0,
    })
    .select("id, is_automation_paused")
    .single();

  return { contactId, conversation };
}

// ── Global keywords ─────────────────────────────────────────────────────────

async function handleGlobalKeywords(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  workspaceId: string,
  contactId: string,
  text: string | undefined
): Promise<boolean> {
  if (!text) return false;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("global_keywords")
    .eq("id", workspaceId)
    .single();

  if (!workspace?.global_keywords) return false;

  // global_keywords is stored as string[] (simple keyword strings)
  // The Settings UI saves them as plain strings like ["stop", "unsubscribe"]
  const keywords = workspace.global_keywords as string[];
  const normalizedText = text.toLowerCase().trim();

  for (const kw of keywords) {
    const keyword = typeof kw === "string" ? kw : (kw as { keyword: string }).keyword;
    if (normalizedText === keyword.toLowerCase()) {
      // Default action for global keywords is unsubscribe
      await supabase
        .from("contacts")
        .update({ is_subscribed: false })
        .eq("id", contactId);
      return true;
    }
  }

  return false;
}
