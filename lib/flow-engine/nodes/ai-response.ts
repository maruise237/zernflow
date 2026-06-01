import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { FlowExecutionContext, AiResponseNodeData } from "../types";
import { createZernioClient } from "@/lib/zernio-client";
import { generateText, createGateway } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { recordAutomationEvent } from "@/lib/automation-events";

const DEFAULT_AI_MODEL = "deepseek/deepseek-v4-flash";

function resolveAiModel(modelId: string, workspaceAiKey?: string | null) {
  const normalizedModel = modelId.trim() || DEFAULT_AI_MODEL;

  if (normalizedModel.startsWith("deepseek/")) {
    const deepseekModel = normalizedModel.replace(/^deepseek\//, "") || "deepseek-v4-flash";
    const apiKey = process.env.DEEPSEEK_API_KEY || workspaceAiKey;

    if (!apiKey) {
      throw new Error("DeepSeek API key missing. Configure DEEPSEEK_API_KEY or add an AI key in Settings.");
    }

    const deepseek = createDeepSeek({ apiKey });
    return deepseek(deepseekModel);
  }

  const aiGatewayKey = workspaceAiKey || process.env.AI_GATEWAY_API_KEY;
  const gateway = createGateway({ apiKey: aiGatewayKey || undefined });
  return gateway(normalizedModel);
}

export async function executeAiResponse(
  supabase: SupabaseClient<Database>,
  data: AiResponseNodeData,
  context: FlowExecutionContext
) {
  // Get workspace for Zernio API key + AI provider key
  const { data: workspace } = await supabase
    .from("workspaces")
    .select("late_api_key_encrypted, ai_api_key")
    .eq("id", context.workspaceId)
    .single();

  if (!workspace?.late_api_key_encrypted) return;

  const zernio = createZernioClient(workspace.late_api_key_encrypted);

  // Resolve late_account_id from channel if not in context
  let lateAccountId = context.lateAccountId;
  if (!lateAccountId) {
    const { data: channel } = await supabase
      .from("channels")
      .select("late_account_id, platform")
      .eq("id", context.channelId)
      .single();

    if (!channel) return;
    lateAccountId = channel.late_account_id;
    if (!context.platform) {
      context.platform = channel.platform as FlowExecutionContext["platform"];
    }
  }

  // Resolve late_conversation_id from conversation if not in context
  let lateConversationId = context.lateConversationId;
  if (!lateConversationId) {
    const { data: conversation } = await supabase
      .from("conversations")
      .select("late_conversation_id")
      .eq("id", context.conversationId)
      .single();

    if (!conversation?.late_conversation_id) {
      console.error("No late_conversation_id found for conversation:", context.conversationId);
      return;
    }
    lateConversationId = conversation.late_conversation_id;
  }

  // Fetch last N messages from the conversation for context
  const contextMessages = data.contextMessages || 10;
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("direction, text")
    .eq("conversation_id", context.conversationId)
    .order("created_at", { ascending: false })
    .limit(contextMessages);

  // Build messages array for the AI
  const aiMessages: Array<{ role: "user" | "assistant"; content: string }> = [];

  if (recentMessages && recentMessages.length > 0) {
    // Reverse to get chronological order (oldest first)
    const chronological = [...recentMessages].reverse();
    for (const msg of chronological) {
      if (!msg.text) continue;
      aiMessages.push({
        role: msg.direction === "inbound" ? "user" : "assistant",
        content: msg.text,
      });
    }
  }

  try {
    const model = data.model || DEFAULT_AI_MODEL;
    const result = await generateText({
      model: resolveAiModel(model, workspace.ai_api_key),
      system: data.systemPrompt || "You are a helpful customer support agent.",
      messages: aiMessages,
      temperature: data.temperature ?? 0.7,
      maxOutputTokens: data.maxTokens ?? 500,
    });

    const text = result.text.trim();
    if (!text) {
      await recordAutomationEvent(supabase, {
        workspace_id: context.workspaceId,
        flow_id: context.flowId,
        trigger_id: context.triggerId || null,
        channel_id: context.channelId,
        contact_id: context.contactId,
        conversation_id: context.conversationId,
        source: "flow",
        event_type: "ai_response_failed",
        status: "error",
        message: "AI provider returned an empty response",
        metadata: { model },
      });
      return;
    }

    // Send via Zernio REST API (same pattern as executeSendMessage)
    const response = await zernio.messages.sendInboxMessage({
      path: { conversationId: lateConversationId },
      body: { accountId: lateAccountId, message: text },
    });

    // Store outbound message
    await supabase.from("messages").insert({
      conversation_id: context.conversationId,
      direction: "outbound",
      text,
      attachments: null,
      sent_by_flow_id: context.flowId,
      sent_by_node_id: null,
      platform_message_id: response.data?.data?.messageId || null,
      status: "sent",
    });

    // Update conversation metadata so the inbox refreshes in real-time
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        last_message_preview: text.slice(0, 100),
      })
      .eq("id", context.conversationId);

    await supabase.from("analytics_events").insert({
      workspace_id: context.workspaceId,
      flow_id: context.flowId,
      contact_id: context.contactId,
      event_type: "message_sent",
    });
  } catch (error) {
    console.error("Failed to generate or send AI response:", error);

    await recordAutomationEvent(supabase, {
      workspace_id: context.workspaceId,
      flow_id: context.flowId,
      trigger_id: context.triggerId || null,
      channel_id: context.channelId,
      contact_id: context.contactId,
      conversation_id: context.conversationId,
      source: "flow",
      event_type: "ai_response_failed",
      status: "error",
      message: error instanceof Error ? error.message : "Unknown AI response error",
      metadata: { model: data.model || DEFAULT_AI_MODEL },
    });

    await supabase.from("messages").insert({
      conversation_id: context.conversationId,
      direction: "outbound",
      text: "[AI response failed]",
      sent_by_flow_id: context.flowId,
      status: "failed",
    });

    await supabase.from("analytics_events").insert({
      workspace_id: context.workspaceId,
      flow_id: context.flowId,
      contact_id: context.contactId,
      event_type: "message_failed",
      metadata: { error: error instanceof Error ? error.message : "Unknown error" },
    });
  }
}
