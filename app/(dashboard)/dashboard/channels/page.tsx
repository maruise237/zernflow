import { getWorkspace } from "@/lib/workspace";
import { ChannelsView } from "./channels-view";

export default async function ChannelsPage() {
  const { workspace, supabase } = await getWorkspace();

  const { data: channels } = await supabase
    .from("channels")
    .select("*")
    .eq("workspace_id", workspace.id)
    .order("created_at", { ascending: false });

  return (
    <ChannelsView
      channels={channels ?? []}
      workspaceId={workspace.id}
      webhookUrl={`${(process.env.NEXT_PUBLIC_APP_URL || process.env.CRON_BASE_URL || "").replace(/\/$/, "")}/api/webhooks/late`}
    />
  );
}
