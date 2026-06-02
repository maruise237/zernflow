"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Plus, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface WorkspaceItem {
  id: string;
  name: string;
  slug: string;
  role: string;
}

function avatarUrl(seed: string, size = 28) {
  return `https://api.dicebear.com/9.x/bottts-neutral/svg?seed=${encodeURIComponent(seed)}&size=${size}`;
}

export function WorkspaceSwitcher({
  current,
  workspaces,
}: {
  current: { id: string; name: string };
  workspaces: WorkspaceItem[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [switching, setSwitching] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Focus input when create form opens
  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  async function handleSwitch(workspaceId: string) {
    if (workspaceId === current.id) {
      setOpen(false);
      return;
    }
    setSwitching(workspaceId);
    try {
      await fetch("/api/v1/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      router.refresh();
      setOpen(false);
    } finally {
      setSwitching(null);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setSwitching("new");
    const res = await fetch("/api/v1/workspaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() }),
    });
    if (res.ok) {
      router.refresh();
      setOpen(false);
      setCreating(false);
      setNewName("");
    }
    setSwitching(null);
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-xl border border-sidebar-border bg-card/70 px-2.5 py-2 text-left shadow-sm shadow-black/5 transition-colors duration-200 hover:bg-sidebar-accent"
      >
        <img
          src={avatarUrl(current.id)}
          alt=""
          className="h-8 w-8 rounded-lg"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-sidebar-foreground">
            {current.name}
          </span>
          <span className="block truncate text-[11px] font-medium text-sidebar-foreground/48">
            Workspace
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-sidebar-foreground/50 transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-border bg-popover p-1.5 shadow-xl shadow-black/10">
          {/* Workspace list */}
          {workspaces.map((ws) => {
            const isActive = ws.id === current.id;
            const isLoading = switching === ws.id;
            return (
              <button
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                disabled={!!switching}
                className={cn(
                  "flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-popover-foreground hover:bg-accent"
                )}
              >
                <img
                  src={avatarUrl(ws.id, 24)}
                  alt=""
                  className="h-6 w-6 rounded"
                />
                <span className="flex-1 truncate text-left">{ws.name}</span>
                {isLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : isActive ? (
                  <Check className="h-3.5 w-3.5" />
                ) : null}
              </button>
            );
          })}

          {/* Divider */}
          <div className="my-1 border-t border-border" />

          {/* Create workspace */}
          {creating ? (
            <form onSubmit={handleCreate} className="p-1">
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom de l'espace de travail"
                className="min-h-10 w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                disabled={switching === "new"}
              />
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="submit"
                  disabled={!newName.trim() || switching === "new"}
                  className="min-h-9 flex-1 cursor-pointer rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {switching === "new" ? (
                    <Loader2 className="mx-auto h-3.5 w-3.5 animate-spin" />
                  ) : (
                    "Créer"
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                  }}
                  className="min-h-9 cursor-pointer rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <button
              onClick={() => setCreating(true)}
              className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-muted-foreground transition-colors duration-200 hover:bg-secondary hover:text-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Créer un espace de travail
            </button>
          )}
        </div>
      )}
    </div>
  );
}
