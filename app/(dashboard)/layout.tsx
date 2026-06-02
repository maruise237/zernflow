import { getWorkspace } from "@/lib/workspace";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { workspace, user, supabase } = await getWorkspace();

  const { data: memberships } = await supabase
    .from("workspace_members")
    .select("role, workspaces(id, name, slug)")
    .eq("user_id", user.id);

  const workspaces = (memberships ?? [])
    .map((m) => ({
      ...(m.workspaces as { id: string; name: string; slug: string }),
      role: m.role,
    }))
    .filter((w) => w.id);

  return (
    <div className="dashboard-shell flex h-dvh overflow-hidden">
      <Sidebar workspace={workspace} user={user} workspaces={workspaces} />
      <main id="main-content" className="min-h-0 min-w-0 flex-1 overflow-hidden pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
