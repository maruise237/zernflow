import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import type { Platform } from "@/lib/types/database";

const socialPlatforms = new Set<Platform>([
  "facebook",
  "instagram",
  "twitter",
  "tiktok",
  "youtube",
  "linkedin",
  "threads",
  "pinterest",
  "telegram",
  "bluesky",
  "reddit",
  "whatsapp",
  "googlebusiness",
  "snapchat",
  "discord",
]);

/**
 * POST /api/v1/channels/test-key
 *
 * Tests a Zernio API key, saves it to the workspace, and auto-syncs channels.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { apiKey, workspaceId } = body;

  if (!apiKey || typeof apiKey !== "string") {
    return NextResponse.json(
      { error: "La clé API est requise" },
      { status: 400 }
    );
  }

  // Validate the key by listing accounts
  let accounts: Array<{
    _id?: string;
    platform?: string;
    username?: string;
    displayName?: string;
    profilePicture?: string | null;
    enabled?: boolean;
    isActive?: boolean;
  }>;
  try {
    const zernio = createZernioClient(apiKey.trim());
    const res = await zernio.accounts.listAccounts();
    accounts = ((res.data?.accounts ?? []) as typeof accounts).filter(
      (account) =>
        account._id &&
        account.platform &&
        socialPlatforms.has(account.platform as Platform) &&
        account.enabled !== false &&
        account.isActive !== false
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Clé API invalide ou erreur de connexion";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  // If workspaceId provided, save the key and sync channels
  if (workspaceId) {
    const supabase = await createClient();

    // Save the API key
    const { error: saveErr } = await supabase
      .from("workspaces")
      .update({ late_api_key_encrypted: apiKey.trim() })
      .eq("id", workspaceId)
      .select("id")
      .single();

    if (saveErr) {
      return NextResponse.json(
        { error: `Clé valide, mais impossible de l'enregistrer : ${saveErr.message}` },
        { status: 500 }
      );
    }

    // Auto-sync channels
    const { data: existingChannels } = await supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspaceId);

    const existingByLateId = new Map(
      (existingChannels ?? []).map((c) => [c.late_account_id, c])
    );

    for (const account of accounts) {
      if (!account._id) continue;
      if (existingByLateId.has(account._id)) continue;

      await supabase.from("channels").insert({
        workspace_id: workspaceId,
        platform: account.platform as Platform,
        late_account_id: account._id,
        username: account.username || null,
        display_name: account.displayName || account.username || null,
        profile_picture: account.profilePicture || null,
        is_active: true,
      });
    }
  }

  return NextResponse.json({ accounts });
}
