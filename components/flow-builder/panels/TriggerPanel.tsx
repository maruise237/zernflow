"use client";

import { useCallback, useState } from "react";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Platform, TriggerType } from "@/lib/types/database";
import type { FlowChannelOption } from "../flow-canvas";

interface Keyword {
  value: string;
  matchType: "exact" | "contains" | "startsWith";
}

interface TriggerPanelData {
  triggerType?: string;
  keywords?: Keyword[];
  payload?: string;
  activationScope?: "all" | "platforms" | "channels";
  platforms?: Platform[];
  channelIds?: string[];
  [key: string]: unknown;
}

interface TriggerPanelProps {
  data: Record<string, unknown>;
  channels: FlowChannelOption[];
  onChange: (data: Record<string, unknown>) => void;
}

const triggerTypes: Array<{ value: TriggerType; label: string; description: string; badge?: string }> = [
  { value: "keyword", label: "Mot-clé", description: "Déclenché quand un utilisateur envoie un mot-clé correspondant" },
  { value: "postback", label: "Clic bouton", description: "Déclenché quand un utilisateur clique sur un bouton" },
  { value: "quick_reply", label: "Réponse rapide", description: "Déclenché quand un utilisateur touche une réponse rapide" },
  { value: "welcome", label: "Message de bienvenue", description: "Déclenché quand un utilisateur démarre une conversation" },
  { value: "default", label: "Chatbot IA - tous les messages", description: "Optimise pour un assistant IA: le flow repond a chaque DM entrant quand aucun trigger plus precis ne correspond", badge: "Recommande IA" },
  { value: "comment_keyword", label: "Mot-clé en commentaire", description: "Déclenché par des mots-clés dans les commentaires de posts" },
];

const matchTypes: Array<{ value: "exact" | "contains" | "startsWith"; label: string }> = [
  { value: "exact", label: "Correspondance exacte" },
  { value: "contains", label: "Contient" },
  { value: "startsWith", label: "Commence par" },
];

export function TriggerPanel({ data: rawData, channels, onChange }: TriggerPanelProps) {
  const data = rawData as TriggerPanelData;
  const triggerType = data.triggerType || "keyword";
  const keywords = data.keywords || [];
  const activationScope = data.activationScope || "all";
  const selectedPlatforms = data.platforms || [];
  const selectedChannelIds = data.channelIds || [];
  const [newKeyword, setNewKeyword] = useState("");
  const [newMatchType, setNewMatchType] = useState<"exact" | "contains" | "startsWith">("contains");
  const platformOptions = Array.from(new Set(channels.map((channel) => channel.platform)));

  const handleTriggerTypeChange = useCallback(
    (type: string) => {
      onChange({ ...data, triggerType: type });
    },
    [data, onChange]
  );

  const addKeyword = useCallback(() => {
    const trimmed = newKeyword.trim();
    if (!trimmed) return;
    const updated: Keyword[] = [...keywords, { value: trimmed, matchType: newMatchType }];
    onChange({ ...data, keywords: updated });
    setNewKeyword("");
  }, [data, keywords, newKeyword, newMatchType, onChange]);

  const removeKeyword = useCallback(
    (index: number) => {
      const updated = keywords.filter((_, i) => i !== index);
      onChange({ ...data, keywords: updated });
    },
    [data, keywords, onChange]
  );

  const updateKeywordMatchType = useCallback(
    (index: number, matchType: "exact" | "contains" | "startsWith") => {
      const updated = keywords.map((k, i) => (i === index ? { ...k, matchType } : k));
      onChange({ ...data, keywords: updated });
    },
    [data, keywords, onChange]
  );

  const showKeywords = triggerType === "keyword" || triggerType === "comment_keyword";
  const showPayload = triggerType === "postback" || triggerType === "quick_reply";

  function togglePlatform(platform: Platform) {
    const next = selectedPlatforms.includes(platform)
      ? selectedPlatforms.filter((p) => p !== platform)
      : [...selectedPlatforms, platform];
    onChange({ ...data, platforms: next });
  }

  function toggleChannel(channelId: string) {
    const next = selectedChannelIds.includes(channelId)
      ? selectedChannelIds.filter((id) => id !== channelId)
      : [...selectedChannelIds, channelId];
    onChange({ ...data, channelIds: next });
  }

  return (
    <div className="space-y-5">
      {/* Trigger Type */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-foreground">
          Type de déclencheur
        </label>
        <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-900 dark:bg-blue-950 dark:text-blue-300">
          Canaux: tous les canaux actifs par défaut. Vous pouvez limiter ce déclencheur à certaines plateformes ou comptes.
        </div>
        <div className="space-y-1.5">
          {triggerTypes.map((t) => (
            <label
              key={t.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                triggerType === t.value
                  ? "border-emerald-500 bg-emerald-50"
                  : "border-border bg-card hover:border-input"
              )}
            >
              <input
                type="radio"
                name="triggerType"
                value={t.value}
                checked={triggerType === t.value}
                onChange={() => handleTriggerTypeChange(t.value)}
                className="mt-0.5 h-4 w-4 border-input text-emerald-500 focus:ring-emerald-500"
              />
              <div>
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
                  {t.label}
                  {t.badge && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {t.badge}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">{t.description}</p>
              </div>
            </label>
          ))}
        </div>
      </div>

      {triggerType === "default" && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
          Ce mode est celui a utiliser pour un chatbot IA permanent. Il ne demande pas de mot-cle:
          chaque message entrant peut lancer le flow, sauf si un autre trigger plus specifique passe avant.
        </div>
      )}

      {/* Activation Scope */}
      <div>
        <label className="mb-2 block text-xs font-semibold text-foreground">
          Activation réelle
        </label>
        <div className="grid gap-2">
          {[
            { value: "all", label: "Tous les canaux actifs", description: "Le flow réagit partout où le type d'événement est supporté." },
            { value: "platforms", label: "Plateformes choisies", description: "Le flow réagit sur tous les comptes actifs des plateformes sélectionnées." },
            { value: "channels", label: "Comptes précis", description: "Le flow réagit seulement sur les comptes sélectionnés." },
          ].map((scope) => (
            <label
              key={scope.value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
                activationScope === scope.value
                  ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                  : "border-border bg-card hover:border-input"
              )}
            >
              <input
                type="radio"
                name="activationScope"
                value={scope.value}
                checked={activationScope === scope.value}
                onChange={() =>
                  onChange({
                    ...data,
                    activationScope: scope.value,
                    ...(scope.value === "all" ? { platforms: [], channelIds: [] } : {}),
                  })
                }
                className="mt-0.5 h-4 w-4 border-input text-blue-500 focus:ring-blue-500"
              />
              <div>
                <p className="text-sm font-medium text-foreground">{scope.label}</p>
                <p className="text-xs text-muted-foreground">{scope.description}</p>
              </div>
            </label>
          ))}
        </div>

        {activationScope === "platforms" && (
          <div className="mt-3 rounded-lg border border-border bg-card p-3">
            {platformOptions.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucun canal actif. Connectez et synchronisez vos canaux avant de cibler une plateforme.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {platformOptions.map((platform) => (
                  <button
                    key={platform}
                    type="button"
                    onClick={() => togglePlatform(platform)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      selectedPlatforms.includes(platform)
                        ? "border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                        : "border-border text-muted-foreground hover:border-input"
                    )}
                  >
                    {platform}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {activationScope === "channels" && (
          <div className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3">
            {channels.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Aucun compte actif. Connectez et synchronisez vos canaux avant de cibler un compte.
              </p>
            ) : (
              channels.map((channel) => (
                <label
                  key={channel.id}
                  className="flex cursor-pointer items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
                >
                  <span className="min-w-0 text-sm">
                    <span className="block truncate">
                      {channel.display_name || channel.username || channel.platform}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {channel.platform}{channel.username ? ` · @${channel.username}` : ""}
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={selectedChannelIds.includes(channel.id)}
                    onChange={() => toggleChannel(channel.id)}
                    className="h-4 w-4 rounded border-input text-blue-500 focus:ring-blue-500"
                  />
                </label>
              ))
            )}
          </div>
        )}
      </div>

      {/* Keywords Section */}
      {showKeywords && (
        <div>
          <label className="mb-2 block text-xs font-semibold text-foreground">
            Mots-clés
          </label>

          {/* Existing keywords */}
          {keywords.length > 0 && (
            <div className="mb-3 space-y-2">
              {keywords.map((keyword, index) => (
                <div
                  key={index}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card p-2"
                >
                  <span className="flex-1 truncate text-sm text-foreground">
                    {keyword.value}
                  </span>
                  <select
                    value={keyword.matchType}
                    onChange={(e) =>
                      updateKeywordMatchType(index, e.target.value as "exact" | "contains" | "startsWith")
                    }
                    className="rounded border border-border bg-muted px-2 py-1 text-xs text-foreground"
                  >
                    {matchTypes.map((m) => (
                      <option key={m.value} value={m.value}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removeKeyword(index)}
                    className="rounded p-1 text-muted-foreground/60 hover:bg-muted hover:text-muted-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add new keyword */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newKeyword}
              onChange={(e) => setNewKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addKeyword();
                }
              }}
              placeholder="Saisir un mot-clé..."
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <select
              value={newMatchType}
              onChange={(e) => setNewMatchType(e.target.value as "exact" | "contains" | "startsWith")}
              className="rounded-lg border border-border bg-card px-2 py-2 text-xs text-foreground focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {matchTypes.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={addKeyword}
              disabled={!newKeyword.trim()}
              className="rounded-lg bg-emerald-500 p-2 text-white transition-colors hover:bg-emerald-600 disabled:opacity-40"
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          {keywords.length === 0 && (
            <p className="mt-2 text-xs text-muted-foreground">
              Ajoutez les mots-clés qui déclencheront ce flux. Appuyez sur Entrée ou cliquez sur + pour ajouter.
            </p>
          )}
        </div>
      )}

      {/* Payload Section */}
      {showPayload && (
        <div>
          <label className="mb-2 block text-xs font-semibold text-foreground">
            Payload
          </label>
          <input
            type="text"
            value={data.payload || ""}
            onChange={(e) => onChange({ ...data, payload: e.target.value })}
            placeholder="Saisir la valeur du payload..."
            className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
          <p className="mt-1.5 text-xs text-muted-foreground">
            La valeur du payload à reconnaître quand {triggerType === "postback" ? "un bouton est cliqué" : "une réponse rapide est sélectionnée"}.
          </p>
        </div>
      )}
    </div>
  );
}
