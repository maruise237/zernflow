import { getWorkspace } from "@/lib/workspace";
import { Sidebar } from "@/components/sidebar";
import type { Database } from "@/lib/types/database";

type WorkspaceRow = Database["public"]["Tables"]["workspaces"]["Row"];
type WorkspaceSummary = Pick<WorkspaceRow, "id" | "name" | "slug">;

function normalizeWorkspace(workspace: unknown): WorkspaceSummary | null {
  const value = Array.isArray(workspace) ? workspace[0] : workspace;

  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.id !== "string" ||
    typeof record.name !== "string" ||
    typeof record.slug !== "string"
  ) {
    return null;
  }

  return {
    id: record.id,
    name: record.name,
    slug: record.slug,
  };
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, user, supabase } = await getWorkspace();

  const { data: memberships, error: membershipsError } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug)")
    .eq("user_id", user.id);

  if (membershipsError) {
    console.error("Failed to load workspace memberships", membershipsError);
  }

  const workspaces = (memberships ?? [])
    .flatMap((membership) => {
      const workspaceItem = normalizeWorkspace(membership.workspaces);
      if (!workspaceItem) {
        return [];
      }

      return [
        {
          ...workspaceItem,
          role: membership.role,
        },
      ];
    });

  return (
    <div className="flex min-h-dvh bg-background md:h-screen">
      <Sidebar
        workspace={normalizeWorkspace(workspace) ?? workspace}
        user={user}
        workspaces={workspaces}
      />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
