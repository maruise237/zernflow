import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function assertContains(source, needle, label) {
  if (!source.includes(needle)) {
    throw new Error(`${label} is missing ${JSON.stringify(needle)}`);
  }
}

const webhookRoute = read("app/api/webhooks/late/route.ts");
const channelSyncRoute = read("app/api/v1/channels/sync/route.ts");

assertContains(webhookRoute, "comment.received", "webhook route");
assertContains(webhookRoute, "comment_keyword", "webhook route");
assertContains(webhookRoute, "comment_logs", "webhook route");
assertContains(webhookRoute, "comment_id", "comment flow context");
assertContains(webhookRoute, "post_id", "comment flow context");
assertContains(webhookRoute, "dm_sent", "comment log outcome");
assertContains(channelSyncRoute, "createWebhookSettings", "channel sync route");
assertContains(channelSyncRoute, "updateWebhookSettings", "channel sync route");
assertContains(channelSyncRoute, "message.received", "channel sync route");
assertContains(channelSyncRoute, "comment.received", "channel sync route");
assertContains(channelSyncRoute, "CRON_BASE_URL", "channel sync route");

console.log("comment webhook verification passed");
