import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`${label} is missing ${JSON.stringify(needle)}`);
  }
}

const migration = read("supabase/migrations/00015_automation_diagnostics.sql");
const types = read("lib/types/database.ts");
const helper = read("lib/automation-events.ts");
const webhookRoute = read("app/api/webhooks/late/route.ts");
const engine = read("lib/flow-engine/engine.ts");
const aiResponse = read("lib/flow-engine/nodes/ai-response.ts");
const diagnosticsPage = read("app/(dashboard)/dashboard/diagnostics/page.tsx");
const growthView = read("app/(dashboard)/dashboard/growth/growth-view.tsx");
const growthError = read("app/(dashboard)/dashboard/growth/error.tsx");
const buildInfoRoute = read("app/api/v1/build-info/route.ts");
const channelsView = read("app/(dashboard)/dashboard/channels/channels-view.tsx");
const sidebar = read("components/sidebar.tsx");

assertContains(migration, "create table if not exists automation_events", "diagnostics migration");
assertContains(migration, "idx_automation_events_workspace_created", "diagnostics migration");
assertContains(types, "automation_events", "database types");
assertContains(helper, "recordAutomationEvent", "automation event helper");
assertContains(webhookRoute, "webhook_received", "webhook route diagnostics");
assertContains(webhookRoute, "trigger_matched", "webhook route diagnostics");
assertContains(webhookRoute, "trigger_not_matched", "webhook route diagnostics");
assertContains(engine, "flow_started", "flow engine diagnostics");
assertContains(engine, "node_executed", "flow engine diagnostics");
assertContains(engine, "flow_completed", "flow engine diagnostics");
assertContains(engine, "normalizeSendMessages", "send message resilience");
assertContains(engine, "Send message node skipped because it has no sendable content", "send message resilience");
assertContains(aiResponse, "ai_response_failed", "AI node diagnostics");
assertContains(aiResponse, "AI provider returned an empty response", "AI empty response guard");
assertContains(diagnosticsPage, "Automation Diagnostics", "diagnostics page");
assertContains(growthView, "Réponse publique", "growth comment diagnostics");
assertContains(growthView, "DM privé", "growth comment diagnostics");
assertContains(growthView, "friendlyCommentError", "growth comment diagnostics");
assertContains(growthView, "commentaire a plus de 7 jours", "growth comment diagnostics");
assertContains(growthView, "safeTriggerConfig", "growth page resilience");
assertContains(growthView, "getPlatformLabel", "growth page resilience");
assertContains(growthView, "Certaines donnees Growth", "growth page resilience");
assertContains(growthError, "La page Growth n'a pas pu charger", "growth error boundary");
assertContains(buildInfoRoute, "growth-error-boundary-2026-06-01", "build info marker");
assertContains(channelsView, "Webhook Zernio", "channels webhook status");
assertContains(channelsView, "message.received", "channels webhook status");
assertContains(channelsView, "comment.received", "channels webhook status");
assertContains(sidebar, "/dashboard/diagnostics", "sidebar diagnostics link");

console.log("automation diagnostics verification passed");
