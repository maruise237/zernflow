"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Github, Sparkles, UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  async function handleGitHubLogin() {
    await supabase.auth.signInWithOAuth({
      provider: "github",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  return (
    <div className="auth-shell flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-2xl border border-border bg-card/90 shadow-2xl shadow-blue-950/10 backdrop-blur-xl lg:grid-cols-[1.05fr_0.95fr]">
        <aside className="hidden border-r border-white/10 bg-primary p-10 text-primary-foreground lg:flex lg:flex-col lg:justify-between">
          <Link href="/" className="flex items-center gap-3">
            <Image src="/logo.png" alt="ZernFlow" width={36} height={36} className="rounded-xl" />
            <span className="text-lg font-semibold">ZernFlow</span>
          </Link>

          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/78">
              <Sparkles className="h-3.5 w-3.5" />
              Lancez vos flux en quelques minutes
            </div>
            <div>
              <h2 className="max-w-sm text-3xl font-semibold tracking-tight">
                Créez une machine de conversation qui vous appartient.
              </h2>
              <p className="mt-4 max-w-sm text-sm leading-6 text-white/70">
                ZernFlow centralise les DM, les commentaires, les séquences et les contacts sans vous enfermer dans une plateforme.
              </p>
            </div>
          </div>

          <p className="text-xs leading-5 text-white/50">
            Open source, multi-plateforme et prêt pour les équipes qui veulent automatiser sans perdre le contrôle.
          </p>
        </aside>

        <main className="w-full p-6 sm:p-10">
          <div className="mx-auto w-full max-w-sm space-y-6">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-secondary shadow-sm">
                <UserPlus className="h-6 w-6 text-foreground" />
              </div>
              <h1 className="text-2xl font-semibold tracking-tight">Créez votre compte</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Commencez avec ZernFlow
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
                  Nom
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
                  placeholder="Votre nom"
                />
              </div>

              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
                  placeholder="you@example.com"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-sm font-medium">
                  Mot de passe
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="min-h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus:ring-2 focus:ring-ring"
                  placeholder="Min. 6 caractères"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="min-h-11 w-full cursor-pointer rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground shadow-sm shadow-black/10 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Création du compte..." : "Créer le compte"}
              </button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Ou continuer avec
                </span>
              </div>
            </div>

            <button
              onClick={handleGitHubLogin}
              className="flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium transition-colors hover:bg-secondary"
            >
              <Github className="h-4 w-4" />
              GitHub
            </button>

            <p className="text-center text-sm text-muted-foreground">
              Vous avez déjà un compte ?{" "}
              <Link href="/login" className="font-medium text-foreground hover:underline">
                Se connecter
              </Link>
            </p>
          </div>
        </main>
      </div>
    </div>
  );
}
