"use client";

import Link from "next/link";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useEffect } from "react";

export default function GrowthError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Growth page failed to load", error);
  }, [error]);

  return (
    <div className="flex h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-xl rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-red-50 p-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-semibold text-foreground">
              La page Growth n'a pas pu charger
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Le build est OK, mais une erreur runtime bloque cette page. Cette
              vue capture maintenant l'erreur pour aider le debug au lieu de
              laisser Next afficher l'ecran noir generique.
            </p>

            <div className="mt-4 rounded-lg border border-border bg-muted/40 p-3">
              <p className="text-xs font-medium text-muted-foreground">
                Diagnostic
              </p>
              <p className="mt-1 break-words text-sm text-foreground">
                {error.message || "Erreur runtime sans message public"}
              </p>
              {error.digest && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Digest: {error.digest}
                </p>
              )}
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <RefreshCw className="h-4 w-4" />
                Recharger Growth
              </button>
              <Link
                href="/dashboard/diagnostics"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Ouvrir Diagnostics
              </Link>
              <Link
                href="/dashboard"
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted"
              >
                Retour dashboard
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
