"use client";

import { useMemo, useState } from "react";
import { Loader2, Play, RefreshCw } from "lucide-react";

export interface LiveTestChannel {
  id: string;
  platform: string;
  username: string | null;
  display_name: string | null;
}

export interface LiveTestConversation {
  id: string;
  channel_id: string;
  late_conversation_id: string | null;
  last_message_preview: string | null;
  contact_name: string | null;
}

export interface LiveTestFlow {
  id: string;
  name: string;
}

export function LiveTestPanel({
  channels,
  conversations,
  flows,
}: {
  channels: LiveTestChannel[];
  conversations: LiveTestConversation[];
  flows: LiveTestFlow[];
}) {
  const [flowId, setFlowId] = useState("");
  const [channelId, setChannelId] = useState(channels[0]?.id || "");
  const [conversationId, setConversationId] = useState("");
  const [text, setText] = useState("test");
  const [commentText, setCommentText] = useState("prompt");
  const [postId, setPostId] = useState("");
  const [commentId, setCommentId] = useState("");
  const [running, setRunning] = useState(false);
  const [runningComment, setRunningComment] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [commentResult, setCommentResult] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<Record<string, unknown> | null>(null);
  const [commentDiagnostics, setCommentDiagnostics] = useState<Record<string, unknown> | null>(null);

  const availableConversations = useMemo(
    () => conversations.filter((conversation) => conversation.channel_id === channelId),
    [channelId, conversations]
  );

  async function runLiveTest() {
    setRunning(true);
    setResult(null);
    setDiagnostics(null);

    try {
      const res = await fetch("/api/v1/diagnostics/live-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, conversationId, text, flowId: flowId || undefined }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setResult(data.error || "Test live échoué");
        setDiagnostics(data.diagnostics || null);
        return;
      }

      setDiagnostics(data.diagnostics || null);
      if (data.matched) {
        setResult(`Trigger trouvé. Flow exécuté: ${data.flowId}`);
      } else {
        setResult(data.reason === "automation_paused"
          ? "Automation pausée pour cette conversation."
          : "Aucun trigger publié ne correspond à ce texte.");
      }
    } catch {
      setResult("Impossible de lancer le test live.");
    } finally {
      setRunning(false);
    }
  }

  async function runCommentTest() {
    setRunningComment(true);
    setCommentResult(null);
    setCommentDiagnostics(null);

    try {
      const res = await fetch("/api/v1/diagnostics/comment-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, text: commentText, postId, commentId, flowId: flowId || undefined }),
      });
      const data = await res.json();

      setCommentDiagnostics(data.diagnostics || null);
      if (!res.ok || data.error) {
        setCommentResult(data.error || "Test commentaire échoué");
        return;
      }

      if (!data.matched) {
        setCommentResult("Aucun trigger commentaire publié ne correspond.");
      } else if (!data.executed) {
        setCommentResult("Trigger commentaire trouvé. Ajoutez un vrai post_id + comment_id pour exécuter le private reply.");
      } else {
        setCommentResult(`Trigger trouvé. Flow exécuté: ${data.flowId}`);
      }
    } catch {
      setCommentResult("Impossible de lancer le test commentaire.");
    } finally {
      setRunningComment(false);
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-sm font-semibold">Test live DM</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Injecte un message entrant dans une vraie conversation synchronisée, puis exécute le même matcher et le même moteur que la prod.
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Rafraîchir
        </button>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Flow attendu</span>
          <select
            value={flowId}
            onChange={(event) => setFlowId(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Tous les flows publies</option>
            {flows.map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Canal</span>
          <select
            value={channelId}
            onChange={(event) => {
              setChannelId(event.target.value);
              setConversationId("");
            }}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            {channels.map((channel) => (
              <option key={channel.id} value={channel.id}>
                {channel.display_name || channel.username || channel.platform} ({channel.platform})
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Conversation réelle</span>
          <select
            value={conversationId}
            onChange={(event) => setConversationId(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="">Choisir...</option>
            {availableConversations.map((conversation) => (
              <option key={conversation.id} value={conversation.id}>
                {conversation.contact_name || conversation.late_conversation_id || conversation.id}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Texte entrant</span>
          <input
            value={text}
            onChange={(event) => setText(event.target.value)}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="ex: prix"
          />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={runLiveTest}
          disabled={running || !channelId || !conversationId || !text.trim()}
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Lancer le test live
        </button>
        {result && <p className="text-sm text-muted-foreground">{result}</p>}
      </div>

      {diagnostics && (
        <details className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
          <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
            Voir diagnostics triggers
          </summary>
          <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
            {JSON.stringify(diagnostics, null, 2)}
          </pre>
        </details>
      )}

      {availableConversations.length === 0 && (
        <p className="mt-3 text-xs text-amber-600">
          Aucune conversation synchronisée pour ce canal. Va dans Canaux, clique Synchroniser, puis reviens ici.
        </p>
      )}

      <div className="mt-6 border-t border-border pt-5">
        <h3 className="text-sm font-semibold">Test live Commentaire</h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Teste les triggers comment_keyword. Avec un vrai post_id + comment_id, le flow peut exécuter un Private Reply réel.
        </p>

        <div className="mt-4 grid gap-3 lg:grid-cols-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Texte du commentaire</span>
            <input
              value={commentText}
              onChange={(event) => setCommentText(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="ex: prompt"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">post_id réel (optionnel)</span>
            <input
              value={postId}
              onChange={(event) => setPostId(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="post id"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">comment_id réel (optionnel)</span>
            <input
              value={commentId}
              onChange={(event) => setCommentId(event.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              placeholder="comment id"
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={runCommentTest}
            disabled={runningComment || !channelId || !commentText.trim()}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
          >
            {runningComment ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Lancer le test commentaire
          </button>
          {commentResult && <p className="text-sm text-muted-foreground">{commentResult}</p>}
        </div>

        {commentDiagnostics && (
          <details className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
            <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
              Voir diagnostics triggers commentaire
            </summary>
            <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words text-[11px] text-muted-foreground">
              {JSON.stringify(commentDiagnostics, null, 2)}
            </pre>
          </details>
        )}
      </div>
    </section>
  );
}
