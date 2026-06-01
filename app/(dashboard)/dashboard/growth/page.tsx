import { getWorkspace } from "@/lib/workspace";
import { GrowthView } from "./growth-view";

export default async function GrowthPage() {
  const { workspace, supabase } = await getWorkspace();

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Run ALL queries in parallel - no waterfalls
  const [
    channelsResult,
    triggersResult,
    flowsResult,
    totalCommentsResult,
    matchedCommentsResult,
    dmsSentResult,
    recentLogsResult,
  ] = await Promise.all([
    supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false }),
    // Fetch all comment_keyword triggers for this workspace's flows in one query
    supabase
      .from("triggers")
      .select("*, flows!inner(id, name, status, workspace_id)")
      .eq("type", "comment_keyword")
      .eq("flows.workspace_id", workspace.id),
    supabase
      .from("flows")
      .select("id, name")
      .eq("workspace_id", workspace.id)
      .eq("status", "published")
      .order("name", { ascending: true }),
    supabase
      .from("comment_logs")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("comment_logs")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .not("matched_trigger_id", "is", null)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("comment_logs")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspace.id)
      .eq("dm_sent", true)
      .gte("created_at", thirtyDaysAgo),
    supabase
      .from("comment_logs")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const loadErrors = [
    channelsResult.error && `Canaux: ${channelsResult.error.message}`,
    triggersResult.error && `Regles: ${triggersResult.error.message}`,
    flowsResult.error && `Flows: ${flowsResult.error.message}`,
    totalCommentsResult.error &&
      `Commentaires traites: ${totalCommentsResult.error.message}`,
    matchedCommentsResult.error &&
      `Correspondances: ${matchedCommentsResult.error.message}`,
    dmsSentResult.error && `DM envoyes: ${dmsSentResult.error.message}`,
    recentLogsResult.error && `Activite recente: ${recentLogsResult.error.message}`,
  ].filter((error): error is string => Boolean(error));

  return (
    <GrowthView
      channels={channelsResult.data ?? []}
      triggers={triggersResult.data ?? []}
      flows={flowsResult.data ?? []}
      stats={{
        totalComments: totalCommentsResult.count ?? 0,
        matchedComments: matchedCommentsResult.count ?? 0,
        dmsSent: dmsSentResult.count ?? 0,
      }}
      recentLogs={recentLogsResult.data ?? []}
      loadErrors={loadErrors}
    />
  );
}
