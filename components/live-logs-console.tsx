"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Circle, Download, Pause, Play, Search, ShieldAlert, Wifi } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Database, Json } from "@/lib/types/database";
import { cn } from "@/lib/utils";

type AutomationEvent = Database["public"]["Tables"]["automation_events"]["Row"];
type AppLog = Database["public"]["Tables"]["app_logs"]["Row"];

type StreamItem =
  | {
      id: string;
      kind: "automation";
      created_at: string;
      level: string;
      source: string;
      title: string;
      message: string | null;
      metadata: Json;
      flow_id: string | null;
      channel_id: string | null;
      session_id: string | null;
    }
  | {
      id: string;
      kind: "app";
      created_at: string;
      level: string;
      source: string;
      title: string;
      message: string;
      metadata: Json;
      flow_id: null;
      channel_id: null;
      session_id: null;
    };

const levelStyles: Record<string, string> = {
  error: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300",
  warn: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  warning: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  skipped: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  success: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  info: "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
};

const eventLabels: Record<string, string> = {
  webhook_received: "Webhook recu",
  webhook_skipped: "Webhook ignore",
  trigger_matched: "Trigger trouve",
  trigger_not_matched: "Aucun trigger",
  automation_paused: "Automation pausee",
  conversation_upsert_failed: "Conversation erreur",
  flow_not_found: "Flow introuvable",
  flow_started: "Flow demarre",
  node_executed: "Bloc execute",
  node_failed: "Bloc en erreur",
  flow_execution_failed: "Execution en erreur",
  ai_response_failed: "IA en erreur",
  flow_completed: "Flow termine",
};

function toStreamItem(event: AutomationEvent): StreamItem {
  return {
    id: event.id,
    kind: "automation",
    created_at: event.created_at,
    level: event.status,
    source: event.source,
    title: eventLabels[event.event_type] ?? event.event_type,
    message: event.message,
    metadata: event.metadata,
    flow_id: event.flow_id,
    channel_id: event.channel_id,
    session_id: event.session_id,
  };
}

function toAppStreamItem(log: AppLog): StreamItem {
  return {
    id: log.id,
    kind: "app",
    created_at: log.created_at,
    level: log.level,
    source: log.source,
    title: log.message,
    message: log.message,
    metadata: log.metadata,
    flow_id: null,
    channel_id: null,
    session_id: null,
  };
}

function formatDate(dateString: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(dateString));
}

function metadataPreview(metadata: Json) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;

  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 5);

  if (entries.length === 0) return null;

  return entries
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" | ");
}

function levelIcon(level: string) {
  if (level === "error") return ShieldAlert;
  if (level === "success") return CheckCircle2;
  if (level === "warn" || level === "warning" || level === "skipped") return AlertTriangle;
  return Circle;
}

function sortItems(items: StreamItem[]) {
  return [...items].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

function uniqueItems(items: StreamItem[]) {
  return Array.from(new Map(items.map((item) => [`${item.kind}:${item.id}`, item])).values());
}

export function LiveLogsConsole({
  workspaceId,
  initialEvents,
  initialAppLogs,
}: {
  workspaceId: string;
  initialEvents: AutomationEvent[];
  initialAppLogs: AppLog[];
}) {
  const [items, setItems] = useState<StreamItem[]>(() =>
    sortItems([...initialEvents.map(toStreamItem), ...initialAppLogs.map(toAppStreamItem)]).slice(0, 240)
  );
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<"all" | "automation" | "app">("all");
  const [level, setLevel] = useState("all");
  const [source, setSource] = useState("all");
  const [paused, setPaused] = useState(false);
  const [connected, setConnected] = useState(false);
  const pausedRef = useRef(paused);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    const supabase = createClient();

    const appendItem = (item: StreamItem) => {
      if (pausedRef.current) return;
      setItems((current) => sortItems(uniqueItems([item, ...current])).slice(0, 240));
    };

    const channel = supabase
      .channel(`live-logs-${workspaceId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "automation_events",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => appendItem(toStreamItem(payload.new as AutomationEvent))
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "app_logs",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => appendItem(toAppStreamItem(payload.new as AppLog))
      )
      .subscribe((status) => setConnected(status === "SUBSCRIBED"));

    const poll = window.setInterval(async () => {
      if (pausedRef.current) return;

      const [events, logs] = await Promise.all([
        supabase
          .from("automation_events")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(80),
        supabase
          .from("app_logs")
          .select("*")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: false })
          .limit(80),
      ]);

      setItems((current) =>
        sortItems(
          uniqueItems([
            ...((events.data ?? []) as AutomationEvent[]).map(toStreamItem),
            ...((logs.data ?? []) as AppLog[]).map(toAppStreamItem),
            ...current,
          ])
        ).slice(0, 240)
      );
    }, 12_000);

    return () => {
      window.clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);

  const sources = useMemo(() => ["all", ...Array.from(new Set(items.map((item) => item.source))).sort()], [items]);

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return items.filter((item) => {
      if (kind !== "all" && item.kind !== kind) return false;
      if (level !== "all" && item.level !== level) return false;
      if (source !== "all" && item.source !== source) return false;
      if (!normalizedQuery) return true;

      return [
        item.title,
        item.message,
        item.source,
        item.level,
        item.flow_id,
        item.channel_id,
        item.session_id,
        metadataPreview(item.metadata),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery);
    });
  }, [items, kind, level, query, source]);

  const errorCount = items.filter((item) => item.level === "error").length;
  const automationCount = items.filter((item) => item.kind === "automation").length;
  const appCount = items.filter((item) => item.kind === "app").length;

  function exportVisibleLogs() {
    const blob = new Blob([JSON.stringify(filtered, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `zernflow-live-logs-${new Date().toISOString()}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className={cn("flex h-2.5 w-2.5 rounded-full", connected ? "bg-emerald-500" : "bg-amber-500")} />
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Live console</p>
            </div>
            <h1 className="mt-2 text-2xl font-bold">Logs internes en temps reel</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Webhooks, triggers, blocs de workflows, erreurs IA et logs systeme dans une timeline unique.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              className="inline-flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2 text-sm font-semibold hover:bg-muted"
            >
              {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
              {paused ? "Reprendre" : "Pause"}
            </button>
            <button
              type="button"
              onClick={exportVisibleLogs}
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
            >
              <Download className="h-4 w-4" />
              Export JSON
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Evenements workflows" value={automationCount} />
          <Metric label="Logs systeme" value={appCount} />
          <Metric label="Erreurs visibles" value={errorCount} tone={errorCount > 0 ? "text-red-600 dark:text-red-300" : undefined} />
          <Metric label="Etat realtime" value={connected ? "Connecte" : "Polling"} icon={Wifi} />
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[1fr_11rem_11rem_13rem]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="h-11 w-full rounded-xl border border-border bg-background pl-10 pr-3 text-sm outline-none ring-primary/20 placeholder:text-muted-foreground focus:ring-4"
              placeholder="Chercher erreur, flow, source, session..."
            />
          </label>

          <select
            value={kind}
            onChange={(event) => setKind(event.target.value as "all" | "automation" | "app")}
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="all">Tout</option>
            <option value="automation">Workflows</option>
            <option value="app">Systeme</option>
          </select>

          <select
            value={level}
            onChange={(event) => setLevel(event.target.value)}
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="all">Tous niveaux</option>
            <option value="error">Erreurs</option>
            <option value="warn">Warnings</option>
            <option value="skipped">Ignores</option>
            <option value="success">Succes</option>
            <option value="info">Info</option>
          </select>

          <select
            value={source}
            onChange={(event) => setSource(event.target.value)}
            className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
          >
            {sources.map((item) => (
              <option key={item} value={item}>
                {item === "all" ? "Toutes sources" : item}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <p className="text-sm font-semibold">{filtered.length} logs visibles</p>
          <p className="text-xs text-muted-foreground">Auto-refresh 12s + realtime Supabase</p>
        </div>

        {filtered.length === 0 ? (
          <div className="px-6 py-16 text-center text-sm text-muted-foreground">
            Aucun log ne correspond aux filtres actuels.
          </div>
        ) : (
          <div className="max-h-[calc(100dvh-24rem)] min-h-[24rem] overflow-auto">
            {filtered.map((item) => {
              const Icon = levelIcon(item.level);
              const preview = metadataPreview(item.metadata);

              return (
                <article
                  key={`${item.kind}:${item.id}`}
                  className="grid gap-3 border-b border-border px-5 py-4 last:border-b-0 lg:grid-cols-[9rem_8rem_1fr]"
                >
                  <div className="text-xs text-muted-foreground">{formatDate(item.created_at)}</div>
                  <div className="flex flex-wrap items-start gap-2">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                        levelStyles[item.level] ?? levelStyles.info
                      )}
                    >
                      <Icon className="h-3 w-3" />
                      {item.level}
                    </span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {item.kind === "automation" ? "workflow" : "systeme"}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-sm font-semibold">{item.title}</h2>
                      <span className="rounded-md border border-border bg-background px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {item.source}
                      </span>
                    </div>
                    {item.message && item.message !== item.title && (
                      <p className="mt-1 text-sm text-muted-foreground">{item.message}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                      {item.flow_id && <span>flow: {item.flow_id}</span>}
                      {item.channel_id && <span>channel: {item.channel_id}</span>}
                      {item.session_id && <span>session: {item.session_id}</span>}
                    </div>
                    {preview && (
                      <p className="mt-2 break-words rounded-lg bg-muted/50 px-3 py-2 font-mono text-[11px] text-muted-foreground">
                        {preview}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number | string;
  tone?: string;
  icon?: typeof Wifi;
}) {
  return (
    <div className="rounded-xl border border-border bg-background px-4 py-3">
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </p>
      <p className={cn("mt-1 text-xl font-bold", tone)}>{value}</p>
    </div>
  );
}
