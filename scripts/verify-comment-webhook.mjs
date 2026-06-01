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
const zernioWebhook = read("lib/zernio-webhook.ts");
const flowEngine = read("lib/flow-engine/engine.ts");

assertContains(webhookRoute, "comment.received", "webhook route");
assertContains(webhookRoute, "comment_keyword", "webhook route");
assertContains(webhookRoute, "comment_logs", "webhook route");
assertContains(webhookRoute, "comment_id", "comment flow context");
assertContains(webhookRoute, "post_id", "comment flow context");
assertContains(webhookRoute, "comment_created_at", "comment flow context");
assertContains(webhookRoute, "dm_sent", "comment log outcome");
assertContains(webhookRoute, "replyText", "comment trigger public reply");
assertContains(webhookRoute, "sendCommentTriggerPublicReply", "comment trigger public reply");
assertContains(webhookRoute, "replyToInboxPost", "comment trigger public reply");
assertContains(webhookRoute, "reply_sent", "comment log public reply outcome");
assertContains(channelSyncRoute, "ensureZernflowWebhook", "channel sync route");
assertContains(zernioWebhook, "createWebhookSettings", "webhook helper");
assertContains(zernioWebhook, "updateWebhookSettings", "webhook helper");
assertContains(zernioWebhook, "message.received", "webhook helper");
assertContains(zernioWebhook, "comment.received", "webhook helper");
assertContains(zernioWebhook, "CRON_BASE_URL", "webhook helper");
assertContains(flowEngine, "Private reply sent to comment author", "private reply telemetry");
assertContains(flowEngine, "Unknown private reply error", "private reply telemetry");
assertContains(flowEngine, "Post id missing for private reply", "private reply telemetry");
assertContains(flowEngine, "normalizePrivateReplyButtons", "private reply buttons");
assertContains(flowEngine, "body.buttons", "private reply buttons");
assertContains(flowEngine, "isCommentPrivateReplyExpired", "private reply 7 day guard");
assertContains(flowEngine, "older than 7 days", "private reply 7 day guard");

console.log("comment webhook verification passed");
