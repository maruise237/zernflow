import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createZernioClient } from "@/lib/zernio-client";
import { ensureZernflowWebhook } from "@/lib/zernio-webhook";
import type { Database, Platform } from "@/lib/types/database";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;
type Channel = Database["public"]["Tables"]["channels"]["Row"];
type ZernioAccount = {
  _id?: string;
  platform?: string;
  username?: string;
  displayName?: string;
  profilePicture?: string | null;
  enabled?: boolean;
  isActive?: boolean;
};

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

const inboxPlatforms = new Set<Platform>([
  "facebook",
  "instagram",
  "twitter",
  "telegram",
  "bluesky",
  "reddit",
  "whatsapp",
]);

type InboxConversation = {
  id?: string;
  platform?: string;
  accountId?: string;
  participantId?: string;
  participantName?: string | null;
  participantPicture?: string | null;
  lastMessage?: string | null;
  updatedTime?: string | null;
  status?: "active" | "archived";
  unreadCount?: number | null;
};

async function getWorkspace(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, workspaces(*)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership?.workspaces) return null;
  return membership.workspaces;
}

async function syncInboxConversations({
  supabase,
  zernio,
  workspaceId,
  channels,
}: {
  supabase: SupabaseClient;
  zernio: ReturnType<typeof createZernioClient>;
  workspaceId: string;
  channels: Channel[];
}) {
  let synced = 0;
  let failed = 0;

  for (const channel of channels) {
    if (!channel.late_account_id) continue;
    if (!inboxPlatforms.has(channel.platform as Platform)) continue;

    try {
      const res = await zernio.messages.listInboxConversations({
        query: {
          accountId: channel.late_account_id,
          limit: 50,
          sortOrder: "desc",
        },
      });
      const inboxConversations = ((res.data as any)?.data ?? []) as InboxConversation[];

      for (const inboxConversation of inboxConversations) {
        if (!inboxConversation.id || !inboxConversation.participantId) continue;

        const participantName =
          inboxConversation.participantName ||
          inboxConversation.participantId;
        const lastMessageAt =
          inboxConversation.updatedTime || new Date().toISOString();

        const { data: contactChannel } = await supabase
          .from("contact_channels")
          .select("contact_id")
          .eq("channel_id", channel.id)
          .eq("platform_sender_id", inboxConversation.participantId)
          .maybeSingle();

        let contactId = contactChannel?.contact_id ?? null;

        if (contactId) {
          await supabase
            .from("contacts")
            .update({
              display_name: participantName,
              avatar_url: inboxConversation.participantPicture ?? null,
              last_interaction_at: lastMessageAt,
            })
            .eq("id", contactId);
        } else {
          const { data: newContact } = await supabase
            .from("contacts")
            .insert({
              workspace_id: workspaceId,
              display_name: participantName,
              avatar_url: inboxConversation.participantPicture ?? null,
              last_interaction_at: lastMessageAt,
            })
            .select("id")
            .single();

          if (!newContact) continue;
          contactId = newContact.id;

          await supabase.from("contact_channels").insert({
            contact_id: contactId,
            channel_id: channel.id,
            platform_sender_id: inboxConversation.participantId,
            platform_username: null,
          });
        }

        const conversationStatus =
          inboxConversation.status === "archived" ? "closed" : "open";

        const { data: existingConversation } = await supabase
          .from("conversations")
          .select("id, status")
          .eq("channel_id", channel.id)
          .eq("contact_id", contactId)
          .maybeSingle();

        if (existingConversation) {
          await supabase
            .from("conversations")
            .update({
              late_conversation_id: inboxConversation.id,
              last_message_at: lastMessageAt,
              last_message_preview: inboxConversation.lastMessage ?? null,
              unread_count: inboxConversation.unreadCount ?? 0,
              ...(existingConversation.status === "snoozed"
                ? {}
                : { status: conversationStatus }),
            })
            .eq("id", existingConversation.id);
        } else {
          await supabase.from("conversations").insert({
            workspace_id: workspaceId,
            channel_id: channel.id,
            contact_id: contactId,
            platform: channel.platform as Platform,
            late_conversation_id: inboxConversation.id,
            status: conversationStatus,
            last_message_at: lastMessageAt,
            last_message_preview: inboxConversation.lastMessage ?? null,
            unread_count: inboxConversation.unreadCount ?? 0,
          });
        }

        synced++;
      }
    } catch (error) {
      failed++;
      console.error(
        `Failed to sync inbox conversations for channel ${channel.id}:`,
        error
      );
    }
  }

  return { synced, failed };
}

/**
 * POST /api/v1/channels/sync
 *
 * Syncs all Zernio accounts as channels for the current workspace.
 * Creates new channels for accounts not yet in the DB.
 * Deactivates channels whose Zernio accounts no longer exist.
 */
export async function POST() {
  const supabase = await createClient();
  const workspace = await getWorkspace(supabase);
  if (!workspace)
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  if (!workspace.late_api_key_encrypted) {
    return NextResponse.json(
      { error: "La clé API Zernio n'est pas configurée. Allez d'abord dans les paramètres." },
      { status: 400 }
    );
  }

  const zernio = createZernioClient(workspace.late_api_key_encrypted);

  try {
    let webhook:
      | Awaited<ReturnType<typeof ensureZernflowWebhook>>
      | { skipped: true; reason: string };
    try {
      webhook = await ensureZernflowWebhook(zernio);
    } catch (error) {
      console.error("Failed to configure Zernio webhook:", error);
      webhook = {
        skipped: true,
        reason: error instanceof Error ? error.message : String(error),
      };
    }

    const res = await zernio.accounts.listAccounts();
    const lateAccounts = ((res.data?.accounts ?? []) as ZernioAccount[]).filter(
      (account) =>
        account._id &&
        account.platform &&
        socialPlatforms.has(account.platform as Platform) &&
        account.enabled !== false &&
        account.isActive !== false
    );

    // Get existing channels for this workspace
    const { data: existingChannels } = await supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspace.id);

    const existingByZernioId = new Map(
      (existingChannels ?? []).map((c) => [c.late_account_id, c])
    );

    // The SDK type doesn't declare profilePicture but the API returns it
    const lateAccountIds = new Set(lateAccounts.map((a) => a._id).filter(Boolean));
    let created = 0;
    let updated = 0;

    for (const account of lateAccounts) {
      if (!account._id || !account.platform) continue;
      const profilePic = account.profilePicture || null;

      const existing = existingByZernioId.get(account._id);

      if (existing) {
        if (
          existing.username !== (account.username || null) ||
          existing.display_name !== (account.displayName || account.username || null) ||
          existing.profile_picture !== profilePic
        ) {
          await supabase
            .from("channels")
            .update({
              username: account.username || null,
              display_name: account.displayName || account.username || null,
              profile_picture: profilePic,
            })
            .eq("id", existing.id);
          updated++;
        }
      } else {
        await supabase.from("channels").insert({
          workspace_id: workspace.id,
          platform: account.platform as Platform,
          late_account_id: account._id,
          username: account.username || null,
          display_name: account.displayName || account.username || null,
          profile_picture: profilePic,
          is_active: true,
        });
        created++;
      }
    }

    // Deactivate channels whose Zernio accounts no longer exist
    let deactivated = 0;
    for (const channel of existingChannels ?? []) {
      if (!lateAccountIds.has(channel.late_account_id) && channel.is_active) {
        await supabase
          .from("channels")
          .update({ is_active: false })
          .eq("id", channel.id);
        deactivated++;
      }
    }

    const { data: activeChannels } = await supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspace.id)
      .eq("is_active", true);

    const inbox = await syncInboxConversations({
      supabase,
      zernio,
      workspaceId: workspace.id,
      channels: activeChannels ?? [],
    });

    // Return updated channel list
    const { data: channels } = await supabase
      .from("channels")
      .select("*")
      .eq("workspace_id", workspace.id)
      .order("created_at", { ascending: false });

    return NextResponse.json({
      channels: channels ?? [],
      synced: { created, updated, deactivated, inbox, webhook },
    });
  } catch (error) {
    console.error("Failed to sync channels:", error);
    return NextResponse.json(
      { error: `Impossible de synchroniser les canaux : ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
