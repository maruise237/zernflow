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
    <div className="flex min-h-dvh bg-[radial-gradient(circle_at_top_left,rgba(37,99,235,0.14),transparent_34rem),linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.16),transparent_30rem),linear-gradient(180deg,#111827_0%,#0f172a_100%)] md:h-screen">
      <Sidebar workspace={workspace} user={user} workspaces={workspaces} />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
