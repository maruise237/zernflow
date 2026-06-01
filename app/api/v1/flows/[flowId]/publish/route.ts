import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database, Json, TriggerType } from "@/lib/types/database";

type FlowNode = {
  id: string;
  type: string;
  data?: {
    triggerType?: TriggerType;
    keywords?: Array<string | { value: string; matchType?: string }>;
    payload?: string;
    [key: string]: unknown;
  };
};

function buildTriggerConfig(node: FlowNode): Json {
  const data = node.data || {};
  const baseConfig = {
    source: "flow_builder",
    nodeId: node.id,
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
  nodes,
}: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  flowId: string;
  nodes: Json;
}) {
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

  if (triggerNodes.length === 0) return;

  const inserts: Database["public"]["Tables"]["triggers"]["Insert"][] =
    triggerNodes.map((node, index) => ({
      flow_id: flowId,
      channel_id: null,
      type: node.data?.triggerType || "keyword",
      config: buildTriggerConfig(node),
      priority: 100 - index,
      is_active: true,
    }));

  const { error } = await supabase.from("triggers").insert(inserts);
  if (error) throw new Error(error.message);
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

  await syncFlowTriggers({ supabase, flowId, nodes: flow.nodes });

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

  const triggerCount = Array.isArray(flow.nodes)
    ? (flow.nodes as unknown as FlowNode[]).filter((node) => node.type === "trigger").length
    : 0;

  return NextResponse.json({ ...flow, version: newVersion, triggerCount });
}
