import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import type { FlowExecutionContext, AiResponseNodeData } from "../types";
import { createZernioClient } from "@/lib/zernio-client";
import { generateText, createGateway } from "ai";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { recordAutomationEvent } from "@/lib/automation-events";

const DEFAULT_AI_MODEL = "deepseek/deepseek-v4-flash";
const DEFAULT_SUPPORT_PROMPT =
  "You are a helpful customer support agent.";
const LATEST_MESSAGE_GUARDRAILS = [
  "Important conversation rule:",
  "- The last inbound message marked as CURRENT_USER_MESSAGE is the only message you must answer now.",
  "- Use conversation history only for background context, tone, names, and unresolved details.",
  "- Do not answer an older question unless the current message explicitly asks to continue it.",
  "- If the current message is short or ambiguous, ask one concise clarification question.",
].join("\n");

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

  // Fetch recent messages for secondary context. The current inbound message is
  // added again as a final explicit prompt so it stays the model's focus.
  const contextMessages = data.contextMessages || 10;
  const { data: recentMessages } = await supabase
    .from("messages")
    .select("direction, text, created_at")
    .eq("conversation_id", context.conversationId)
    .order("created_at", { ascending: false })
    .limit(contextMessages);

  const currentMessage = getCurrentUserMessage(
    context.incomingMessage.text,
    recentMessages ?? []
  );

  if (!currentMessage) {
    await recordAutomationEvent(supabase, {
      workspace_id: context.workspaceId,
      flow_id: context.flowId,
      trigger_id: context.triggerId || null,
      channel_id: context.channelId,
      contact_id: context.contactId,
      conversation_id: context.conversationId,
      source: "flow",
      event_type: "ai_response_failed",
      status: "skipped",
      message: "AI response skipped because there is no current inbound message",
      metadata: { model: data.model || DEFAULT_AI_MODEL },
    });
    return;
  }

  const aiMessages = buildAiMessages({
    recentMessages: recentMessages ?? [],
    currentMessage,
    contextLimit: contextMessages,
  });

  try {
    const model = data.model || DEFAULT_AI_MODEL;
    const result = await generateText({
      model: resolveAiModel(model, workspace.ai_api_key),
      system: buildSystemPrompt(data.systemPrompt),
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
      metadata: { model: data.model || DEFAULT_AI_MODEL, currentMessage },
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

function buildSystemPrompt(systemPrompt?: string) {
  const basePrompt = systemPrompt?.trim() || DEFAULT_SUPPORT_PROMPT;
  return `${basePrompt}\n\n${LATEST_MESSAGE_GUARDRAILS}`;
}

function getCurrentUserMessage(
  incomingText: string | undefined,
  recentMessages: Array<{ direction: string; text: string | null; created_at?: string }>
) {
  const directMessage = incomingText?.trim();
  if (directMessage) return directMessage;

  return [...recentMessages]
    .sort((a, b) => String(b.created_at || "").localeCompare(String(a.created_at || "")))
    .find((message) => message.direction === "inbound" && message.text?.trim())
    ?.text?.trim();
}

function buildAiMessages({
  recentMessages,
  currentMessage,
  contextLimit,
}: {
  recentMessages: Array<{ direction: string; text: string | null; created_at?: string }>;
  currentMessage: string;
  contextLimit: number;
}): Array<{ role: "user" | "assistant"; content: string }> {
  const normalizedCurrent = currentMessage.trim();
  const chronological = [...recentMessages]
    .filter((message) => message.text?.trim())
    .sort((a, b) => String(a.created_at || "").localeCompare(String(b.created_at || "")));

  const history = chronological.map((message) => ({
    role: message.direction === "inbound" ? "user" as const : "assistant" as const,
    content: message.text!.trim(),
  }));

  const latest = history.at(-1);
  if (latest?.role === "user" && latest.content === normalizedCurrent) {
    history.pop();
  }

  const historyLimit = Math.max(contextLimit - 1, 0);
  const boundedHistory = historyLimit > 0 ? history.slice(-historyLimit) : [];
  return [
    ...boundedHistory,
    {
      role: "user",
      content: `CURRENT_USER_MESSAGE:\n${normalizedCurrent}\n\nAnswer this current message now. Do not answer older messages unless this message asks for that.`,
    },
  ];
}
