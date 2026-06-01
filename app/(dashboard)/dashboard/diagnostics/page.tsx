import { getWorkspace } from "@/lib/workspace";
import type { Database, Json } from "@/lib/types/database";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MessageSquareWarning,
  RadioTower,
} from "lucide-react";

type AutomationEvent = Database["public"]["Tables"]["automation_events"]["Row"];

const statusStyles: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  error: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  skipped: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  info: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
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
  node_executed: "Node execute",
  node_failed: "Node erreur",
  flow_execution_failed: "Execution erreur",
  ai_response_failed: "IA erreur",
  flow_completed: "Flow termine",
};

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleString("fr-FR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function stringifyMetadata(metadata: Json) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return null;
  }

  const entries = Object.entries(metadata)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 6);

  if (entries.length === 0) return null;

  return entries
    .map(([key, value]) => `${key}: ${typeof value === "object" ? JSON.stringify(value) : String(value)}`)
    .join(" | ");
}

function countByStatus(events: AutomationEvent[], status: string) {
  return events.filter((event) => event.status === status).length;
}

export default async function DiagnosticsPage() {
  const { workspace, supabase } = await getWorkspace();

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: events }, { count: webhookCount }, { count: errorCount }] =
    await Promise.all([
      supabase
        .from("automation_events")
        .select("*")
        .eq("workspace_id", workspace.id)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("automation_events")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
        .eq("event_type", "webhook_received")
        .gte("created_at", since),
      supabase
        .from("automation_events")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
        .eq("status", "error")
        .gte("created_at", since),
    ]);

  const recentEvents = events ?? [];
  const matchedCount = recentEvents.filter((event) => event.event_type === "trigger_matched").length;
  const skippedCount = countByStatus(recentEvents, "skipped");

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-8 py-6">
        <div>
          <h1 className="text-2xl font-bold">Automation Diagnostics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Suivez les webhooks, triggers, executions de flows et erreurs IA en production.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-8 py-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            icon={RadioTower}
            label="Webhooks 24h"
            value={webhookCount ?? 0}
            tone="text-blue-600 bg-blue-50 dark:bg-blue-950 dark:text-blue-300"
          />
          <StatCard
            icon={CheckCircle2}
            label="Triggers recents"
            value={matchedCount}
            tone="text-emerald-600 bg-emerald-50 dark:bg-emerald-950 dark:text-emerald-300"
          />
          <StatCard
            icon={Clock}
            label="Evenements ignores"
            value={skippedCount}
            tone="text-amber-600 bg-amber-50 dark:bg-amber-950 dark:text-amber-300"
          />
          <StatCard
            icon={AlertTriangle}
            label="Erreurs 24h"
            value={errorCount ?? 0}
            tone="text-red-600 bg-red-50 dark:bg-red-950 dark:text-red-300"
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold">Derniers evenements</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Les 100 derniers evenements d'automation du workspace.
            </p>
          </div>

          {recentEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
              <MessageSquareWarning className="h-10 w-10 text-muted-foreground" />
              <h3 className="mt-4 text-sm font-semibold">Aucun evenement pour le moment</h3>
              <p className="mt-1 max-w-md text-sm text-muted-foreground">
                Quand un DM, commentaire ou flow reel sera traite, il apparaitra ici.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentEvents.map((event) => (
                <div key={event.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[11rem_9rem_1fr]">
                  <div className="text-xs text-muted-foreground">
                    {formatDate(event.created_at)}
                  </div>
                  <div>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        statusStyles[event.status] ?? statusStyles.info
                      }`}
                    >
                      {event.status}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">
                        {eventLabels[event.event_type] ?? event.event_type}
                      </p>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {event.source}
                      </span>
                    </div>
                    {event.message && (
                      <p className="mt-1 text-sm text-muted-foreground">{event.message}</p>
                    )}
                    {stringifyMetadata(event.metadata) && (
                      <p className="mt-2 break-words font-mono text-[11px] text-muted-foreground/80">
                        {stringifyMetadata(event.metadata)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Activity;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${tone}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-2xl font-semibold">{value}</p>
        </div>
      </div>
    </div>
  );
}
