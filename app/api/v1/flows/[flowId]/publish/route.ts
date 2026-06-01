import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json, Platform, TriggerType } from "@/lib/types/database";

type FlowNode = {
  id: string;
  type: string;
  data?: {
    triggerType?: TriggerType;
    keywords?: Array<string | { value: string; matchType?: string }>;
    payload?: string;
    activationScope?: "all" | "platforms" | "channels";
    platforms?: Platform[];
    channelIds?: string[];
    [key: string]: unknown;
  };
};

type ActiveChannel = Pick<
  Database["public"]["Tables"]["channels"]["Row"],
  "id" | "platform"
>;

function buildTriggerConfig(node: FlowNode): Json {
  const data = node.data || {};
  const baseConfig = {
    source: "flow_builder",
    nodeId: node.id,
    activationScope: data.activationScope || "all",
    platforms: data.platforms || [],
    channelIds: data.channelIds || [],
  };

  if (data.triggerType === "postback" || data.triggerType === "quick_reply") {
    return { ...baseConfig, payload: data.payload || "" };
  }

  if (data.triggerType === "keyword" || data.triggerType === "comment_keyword") {
    return { ...baseConfig, keywords: data.keywords || [] } as Json;
  }

  return baseConfig;
}

async function syncFlowTriggers({
  supabase,
  flowId,
  workspaceId,
  nodes,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  flowId: string;
  workspaceId: string;
  nodes: Json;
}): Promise<number> {
  const flowNodes = Array.isArray(nodes) ? (nodes as unknown as FlowNode[]) : [];
  const triggerNodes = flowNodes.filter((node) => node.type === "trigger");

  const { data: existingTriggers } = await supabase
    .from("triggers")
    .select("id, config")
    .eq("flow_id", flowId);

  const builderTriggerIds = (existingTriggers ?? [])
    .filter((trigger) => {
      const config = trigger.config;
      return (
        config &&
        typeof config === "object" &&
        !Array.isArray(config) &&
        config.source === "flow_builder"
      );
    })
    .map((trigger) => trigger.id);

  if (builderTriggerIds.length > 0) {
    await supabase.from("triggers").delete().in("id", builderTriggerIds);
  }

  if (triggerNodes.length === 0) return 0;

  const { data: activeChannels } = await supabase
    .from("channels")
    .select("id, platform")
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);

  const inserts = triggerNodes.flatMap((node, index) =>
    buildTriggerInserts({
      flowId,
      node,
      index,
      activeChannels: activeChannels ?? [],
    })
  );

  if (inserts.length === 0) return 0;

  const { error } = await supabase.from("triggers").insert(inserts);
  if (error) throw new Error(error.message);
  return inserts.length;
}

function buildTriggerInserts({
  flowId,
  node,
  index,
  activeChannels,
}: {
  flowId: string;
  node: FlowNode;
  index: number;
  activeChannels: ActiveChannel[];
}): Database["public"]["Tables"]["triggers"]["Insert"][] {
  const scope = node.data?.activationScope || "all";
  const baseInsert = {
    flow_id: flowId,
    type: node.data?.triggerType || "keyword",
    config: buildTriggerConfig(node),
    priority: 100 - index,
    is_active: true,
  };

  if (scope === "all") {
    return [{ ...baseInsert, channel_id: null }];
  }

  const selectedChannels =
    scope === "platforms"
      ? activeChannels.filter((channel) =>
          (node.data?.platforms || []).includes(channel.platform)
        )
      : activeChannels.filter((channel) =>
          (node.data?.channelIds || []).includes(channel.id)
        );

  return selectedChannels.map((channel) => ({
    ...baseInsert,
    channel_id: channel.id,
  }));
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ flowId: string }> }
) {
  const { flowId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership)
    return NextResponse.json({ error: "Aucun espace de travail" }, { status: 404 });

  // Get current flow
  const { data: flow, error } = await supabase
    .from("flows")
    .select("*")
    .eq("id", flowId)
    .eq("workspace_id", membership.workspace_id)
    .single();

  if (error || !flow)
    return NextResponse.json(
      { error: error?.message || "Flux introuvable" },
      { status: 404 }
    );

  // Update flow status to published and increment version
  const newVersion = flow.version + 1;
  await supabase
    .from("flows")
    .update({
      status: "published",
      published_at: new Date().toISOString(),
      version: newVersion,
    })
    .eq("id", flowId);

  const triggerCount = await syncFlowTriggers({
    supabase,
    flowId,
    workspaceId: membership.workspace_id,
    nodes: flow.nodes,
  });

  // Save version snapshot
  await supabase.from("flow_versions").insert({
    flow_id: flowId,
    version: newVersion,
    nodes: flow.nodes,
    edges: flow.edges,
    viewport: flow.viewport,
    name: flow.name,
    published_by: user.id,
  });

  return NextResponse.json({ ...flow, version: newVersion, triggerCount });
}
