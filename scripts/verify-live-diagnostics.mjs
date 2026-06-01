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

const migration = read("supabase/migrations/00016_app_logs.sql");
const types = read("lib/types/database.ts");
const helper = read("lib/app-logs.ts");
const liveRoute = read("app/api/v1/diagnostics/live-test/route.ts");
const commentRoute = read("app/api/v1/diagnostics/comment-test/route.ts");
const livePanel = read("app/(dashboard)/dashboard/diagnostics/live-test-panel.tsx");
const diagnosticsPage = read("app/(dashboard)/dashboard/diagnostics/page.tsx");
const triggerMatcher = read("lib/flow-engine/trigger-matcher.ts");

assertContains(migration, "create table if not exists app_logs", "app logs migration");
assertContains(types, "app_logs", "database types");
assertContains(helper, "recordAppLog", "app log helper");
assertContains(liveRoute, "matchTrigger", "live test route");
assertContains(liveRoute, "executeFlow", "live test route");
assertContains(liveRoute, "late_conversation_id", "live test route");
assertContains(liveRoute, "Live DM test matched", "live test route");
assertContains(liveRoute, "triggerDiagnostics", "live test route");
assertContains(liveRoute, "workspaceTriggers", "live test route");
assertContains(liveRoute, "no_active_published_triggers_for_channel", "live test route");
assertContains(liveRoute, "flowId?: string", "live test route");
assertContains(liveRoute, "{ flowId, workspaceId: membership.workspace_id }", "live test route");
assertContains(commentRoute, "comment_keyword", "comment test route");
assertContains(commentRoute, "post_id_and_comment_id_required_to_execute_private_reply", "comment test route");
assertContains(commentRoute, "executeFlow", "comment test route");
assertContains(commentRoute, "flowId?: string", "comment test route");
assertContains(commentRoute, ".eq(\"flow_id\", flowId)", "comment test route");
assertContains(livePanel, "Test live DM", "live test panel");
assertContains(livePanel, "Test live Commentaire", "live test panel");
assertContains(livePanel, "Flow attendu", "live test panel");
assertContains(livePanel, "/api/v1/diagnostics/live-test", "live test panel");
assertContains(livePanel, "/api/v1/diagnostics/comment-test", "live test panel");
assertContains(livePanel, "diagnostics", "live test panel");
assertContains(diagnosticsPage, "App logs temporaires", "diagnostics page");
assertContains(diagnosticsPage, "LiveTestPanel", "diagnostics page");
assertContains(diagnosticsPage, "flows={liveTestFlows}", "diagnostics page");
assertContains(triggerMatcher, "options?: { flowId?: string; workspaceId?: string }", "trigger matcher");
assertContains(triggerMatcher, ".eq(\"flow_id\", options.flowId)", "trigger matcher");

console.log("live diagnostics verification passed");
