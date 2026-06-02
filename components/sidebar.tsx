"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  GitBranch,
  MessageSquare,
  Users,
  Radio,
  ListOrdered,
  BarChart3,
  Activity,
  Sprout,
  Plug,
  Settings,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { WorkspaceSwitcher } from "@/components/workspace-switcher";
import type { Database } from "@/lib/types/database";

type Workspace = Database["public"]["Tables"]["workspaces"]["Row"];

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: string;
}

const navigation = [
  { name: "Flows", href: "/dashboard/flows", icon: GitBranch },
  { name: "Inbox", href: "/dashboard/inbox", icon: MessageSquare },
  { name: "Contacts", href: "/dashboard/contacts", icon: Users },
  { name: "Broadcasts", href: "/dashboard/broadcasts", icon: Radio },
  { name: "Sequences", href: "/dashboard/sequences", icon: ListOrdered },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Diagnostics", href: "/dashboard/diagnostics", icon: Activity },
  { name: "Growth", href: "/dashboard/growth", icon: Sprout },
  { name: "Channels", href: "/dashboard/channels", icon: Plug },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

const primaryNavigation = navigation.slice(0, 6);
const operationsNavigation = navigation.slice(6);

export function Sidebar({
  workspace,
  workspaces,
}: {
  workspace: Workspace;
  user: { id: string; email?: string };
  workspaces: WorkspaceItem[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [dark, setDark] = useState(false);
  const t = useTranslations("Navigation");

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const navItems = navigation.map((item) => {
    const isActive = pathname.startsWith(item.href);
    return { ...item, isActive };
  });
  const primaryItems = navItems.filter((item) =>
    primaryNavigation.some((nav) => nav.href === item.href)
  );
  const operationsItems = navItems.filter((item) =>
    operationsNavigation.some((nav) => nav.href === item.href)
  );

  return (
    <>
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar md:flex">
      <div className="border-b border-sidebar-border px-4 py-4">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} />
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        <SidebarSection label="Travail" items={primaryItems} translate={t} />
        <SidebarSection label="Pilotage" items={operationsItems} translate={t} />
      </nav>

      <div className="space-y-1 border-t border-sidebar-border p-3">
        <button
          onClick={toggleTheme}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.99]"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? t("LightMode") : t("DarkMode")}
        </button>
        <button
          onClick={handleSignOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground active:scale-[0.99]"
        >
          <LogOut className="h-4 w-4" />
          {t("SignOut")}
        </button>
      </div>
    </aside>

    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border bg-sidebar/95 px-2 py-2 shadow-lg backdrop-blur md:hidden">
      <nav
        className="flex gap-1 overflow-x-auto pb-[env(safe-area-inset-bottom)]"
        aria-label="Navigation mobile"
      >
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            aria-current={item.isActive ? "page" : undefined}
            className={cn(
              "flex min-w-16 flex-1 flex-col items-center gap-1 rounded-lg px-2 py-2 text-[10px] font-medium transition-all active:scale-[0.98]",
              item.isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="h-4 w-4" />
            <span className="max-w-16 truncate">{t(item.name)}</span>
          </Link>
        ))}
      </nav>
    </div>
    </>
  );
}

function SidebarSection({
  label,
  items,
  translate,
}: {
  label: string;
  items: Array<(typeof navigation)[number] & { isActive: boolean }>;
  translate: (key: string) => string;
}) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-sidebar-foreground/45">
        {label}
      </p>
      <div className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            aria-current={item.isActive ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all active:scale-[0.99]",
              item.isActive
                ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--primary)]"
                : "text-sidebar-foreground/68 hover:bg-sidebar-accent/70 hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon
              className={cn(
                "h-4 w-4 transition-colors",
                item.isActive
                  ? "text-primary"
                  : "text-sidebar-foreground/48 group-hover:text-sidebar-accent-foreground"
              )}
            />
            <span className="truncate">{translate(item.name)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
