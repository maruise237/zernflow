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

export function LiveTestPanel({
  channels,
  conversations,
}: {
  channels: LiveTestChannel[];
  conversations: LiveTestConversation[];
}) {
  const [channelId, setChannelId] = useState(channels[0]?.id || "");
  const [conversationId, setConversationId] = useState("");
  const [text, setText] = useState("test");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const availableConversations = useMemo(
    () => conversations.filter((conversation) => conversation.channel_id === channelId),
    [channelId, conversations]
  );

  async function runLiveTest() {
    setRunning(true);
    setResult(null);

    try {
      const res = await fetch("/api/v1/diagnostics/live-test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, conversationId, text }),
      });
      const data = await res.json();

      if (!res.ok || data.error) {
        setResult(data.error || "Test live échoué");
        return;
      }

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

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
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

      {availableConversations.length === 0 && (
        <p className="mt-3 text-xs text-amber-600">
          Aucune conversation synchronisée pour ce canal. Va dans Canaux, clique Synchroniser, puis reviens ici.
        </p>
      )}
    </section>
  );
}
