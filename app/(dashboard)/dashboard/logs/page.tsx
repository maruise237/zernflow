import { LiveLogsConsole } from "@/components/live-logs-console";
import { getWorkspace } from "@/lib/workspace";

export default async function LogsPage() {
  const { workspace, supabase } = await getWorkspace();

  const [{ data: events }, { data: appLogs }] = await Promise.all([
    supabase
      .from("automation_events")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(120),
    supabase
      .from("app_logs")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(120),
  ]);

  return (
    <div className="h-full overflow-auto px-8 py-6">
      <LiveLogsConsole
        workspaceId={workspace.id}
        initialEvents={events ?? []}
        initialAppLogs={appLogs ?? []}
      />
    </div>
  );
}
