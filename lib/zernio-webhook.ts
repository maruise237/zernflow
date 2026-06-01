import { createZernioClient } from "@/lib/zernio-client";

type ZernioClient = ReturnType<typeof createZernioClient>;

type ZernioWebhook = {
  _id?: string;
  name?: string;
  url?: string;
};

export const zernflowWebhookEvents = ["message.received", "comment.received"] as const;

export function getPublicAppUrl() {
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || process.env.CRON_BASE_URL)?.replace(/\/$/, "");

  if (!appUrl || appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    return null;
  }

  return appUrl;
}

export async function ensureZernflowWebhook(zernio: ZernioClient) {
  const appUrl = getPublicAppUrl();
  if (!appUrl) {
    return { skipped: true, reason: "NEXT_PUBLIC_APP_URL or CRON_BASE_URL is not a public URL" };
  }

  const url = `${appUrl}/api/webhooks/late`;
  const name = "ZernFlow Inbox + Comments";
  const webhooksRes = await zernio.webhooks.getWebhookSettings();
  const existing = (webhooksRes.data?.webhooks as ZernioWebhook[] | undefined)?.find(
    (webhook) => webhook.url === url || webhook.name === name
  );

  if (existing?._id) {
    await zernio.webhooks.updateWebhookSettings({
      body: {
        _id: existing._id,
        name,
        url,
        events: [...zernflowWebhookEvents],
        isActive: true,
      },
    });
    return { skipped: false, action: "updated", url };
  }

  await zernio.webhooks.createWebhookSettings({
    body: {
      name,
      url,
      events: [...zernflowWebhookEvents],
      isActive: true,
    },
  });

  return { skipped: false, action: "created", url };
}
