import { getWorkspace } from "@/lib/workspace";
import { notFound } from "next/navigation";
import { FlowCanvas } from "@/components/flow-builder/flow-canvas";

export default async function FlowEditorPage({
  params,
}: {
  params: Promise<{ flowId: string }>;
}) {
  const { flowId } = await params;
  const { workspace, supabase } = await getWorkspace();

  const [{ data: flow }, { data: channels }] = await Promise.all([
    supabase
      .from("flows")
      .select("*")
      .eq("id", flowId)
      .eq("workspace_id", workspace.id)
      .single(),
    supabase
      .from("channels")
      .select("id, platform, username, display_name, is_active")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true)
      .order("platform", { ascending: true }),
  ]);

  if (!flow) {
    notFound();
  }

  return (
    <div className="flex h-full flex-col">
      <FlowCanvas flow={flow} channels={channels ?? []} />
    </div>
  );
}
