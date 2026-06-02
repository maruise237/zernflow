import { NextRequest, NextResponse } from "next/server";
import { WORKSPACE_COOKIE } from "@/lib/workspace";
import { recordAppLog } from "@/lib/app-logs";
import { createClient, createServiceClient } from "@/lib/supabase/server";

const LEVELS = new Set(["debug", "info", "warn", "warning", "error"]);

async function getRequestWorkspace(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const requestedWorkspaceId =
    request.nextUrl.searchParams.get("workspaceId") ||
    request.cookies.get(WORKSPACE_COOKIE)?.value ||
    null;

  let query = supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1);

  if (requestedWorkspaceId) {
    query = query.eq("workspace_id", requestedWorkspaceId);
  }

  const { data: membership } = await query.single();

  if (!membership?.workspace_id) {
    return { error: NextResponse.json({ error: "Workspace not found" }, { status: 404 }) };
  }

  return { workspaceId: membership.workspace_id };
}

export async function GET(request: NextRequest) {
  const workspace = await getRequestWorkspace(request);
  if ("error" in workspace) return workspace.error;

  const limit = Math.min(Number(request.nextUrl.searchParams.get("limit") || 160), 300);
  const serviceSupabase = await createServiceClient();

  const [events, appLogs] = await Promise.all([
    serviceSupabase
      .from("automation_events")
      .select("*")
      .eq("workspace_id", workspace.workspaceId)
      .order("created_at", { ascending: false })
      .limit(limit),
    serviceSupabase
      .from("app_logs")
      .select("*")
      .or(`workspace_id.eq.${workspace.workspaceId},workspace_id.is.null`)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (events.error) {
    return NextResponse.json({ error: events.error.message }, { status: 500 });
  }

  if (appLogs.error) {
    return NextResponse.json({ error: appLogs.error.message }, { status: 500 });
  }

  return NextResponse.json({
    workspaceId: workspace.workspaceId,
    events: events.data ?? [],
    appLogs: appLogs.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const workspace = await getRequestWorkspace(request);
  if ("error" in workspace) return workspace.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const level = typeof body.level === "string" && LEVELS.has(body.level) ? body.level : "error";
  const message = typeof body.message === "string" ? body.message.slice(0, 1000) : "Client log";
  const source = typeof body.source === "string" ? body.source.slice(0, 120) : "client";
  const metadata =
    body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
      ? body.metadata
      : {};

  const serviceSupabase = await createServiceClient();
  await recordAppLog(serviceSupabase, {
    workspace_id: workspace.workspaceId,
    level,
    source,
    message,
    metadata: {
      ...metadata,
      userAgent: request.headers.get("user-agent"),
      path: request.headers.get("referer"),
    },
  });

  return NextResponse.json({ ok: true });
}
