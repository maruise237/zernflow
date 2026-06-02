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
  const [error, setError] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
        setNewName("");
        setError("");
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
    setError("");
    try {
      const res = await fetch("/api/v1/workspaces/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId }),
      });
      if (!res.ok) {
        setError("Impossible de changer d'espace de travail.");
        return;
      }
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
    setError("");
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
    } else {
      setError("Impossible de creer cet espace de travail.");
    }
    setSwitching(null);
  }

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="flex min-h-11 w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-all hover:bg-sidebar-accent active:scale-[0.99]"
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
          <span className="block truncate text-[11px] text-sidebar-foreground/50">
            Espace actif
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-sidebar-foreground/50 transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-border/80 bg-popover p-1.5 shadow-xl"
          role="menu"
        >
          {/* Workspace list */}
          {workspaces.map((ws) => {
            const isActive = ws.id === current.id;
            const isLoading = switching === ws.id;
            return (
              <button
                type="button"
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                disabled={!!switching}
                role="menuitem"
                className={cn(
                  "flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm transition-all disabled:cursor-not-allowed disabled:opacity-60 active:scale-[0.99]",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-popover-foreground hover:bg-accent"
                )}
              >
                <img
                  src={avatarUrl(ws.id, 24)}
                  alt=""
                  className="h-6 w-6 rounded-md"
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
          <div className="my-1.5 border-t border-border" />

          {/* Create workspace */}
          {creating ? (
            <form onSubmit={handleCreate} className="p-1">
              <label htmlFor="workspace-name" className="sr-only">
                Nom de l'espace de travail
              </label>
              <input
                id="workspace-name"
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nom de l'espace de travail"
                className="min-h-10 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                disabled={switching === "new"}
              />
              {error && (
                <p className="mt-1.5 text-xs text-destructive">{error}</p>
              )}
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="submit"
                  disabled={!newName.trim() || switching === "new"}
                  className="min-h-9 flex-1 cursor-pointer rounded-lg bg-primary px-2 py-1 text-xs font-medium text-primary-foreground transition-all hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.99]"
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
                    setError("");
                  }}
                  className="min-h-9 cursor-pointer rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                >
                  Annuler
                </button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              role="menuitem"
              className="flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Plus className="h-3.5 w-3.5" />
              Créer un espace de travail
            </button>
          )}
          {error && !creating && (
            <p className="px-2 pb-1 pt-1.5 text-xs text-destructive">{error}</p>
          )}
        </div>
      )}
    </div>
  );
}
