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

  return (
    <>
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar/90 shadow-sm shadow-black/5 backdrop-blur-xl md:flex">
      <div className="border-b border-sidebar-border px-4 py-4">
        <WorkspaceSwitcher current={workspace} workspaces={workspaces} />
      </div>

      <nav className="flex-1 space-y-1.5 p-4">
        {navItems.map((item) => {
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "group flex min-h-11 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-all duration-200",
                item.isActive
                  ? "bg-primary text-primary-foreground shadow-sm shadow-black/10"
                  : "text-sidebar-foreground/68 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
                  item.isActive
                    ? "bg-white/12 text-primary-foreground"
                    : "bg-sidebar-accent text-sidebar-foreground/62 group-hover:text-sidebar-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
              </span>
              {t(item.name)}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-1.5 border-t border-sidebar-border p-4">
        <button
          onClick={toggleTheme}
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          {dark ? t("LightMode") : t("DarkMode")}
        </button>
        <button
          onClick={handleSignOut}
          className="flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-sidebar-foreground/70 transition-colors duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <LogOut className="h-4 w-4" />
          {t("SignOut")}
        </button>
      </div>
    </aside>

    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-sidebar-border bg-sidebar/95 px-2 py-2 shadow-lg shadow-black/10 backdrop-blur-xl md:hidden">
      <nav className="flex gap-1 overflow-x-auto pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={cn(
              "flex min-w-16 flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[10px] font-medium transition-colors duration-200",
              item.isActive
                ? "bg-primary text-primary-foreground"
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
