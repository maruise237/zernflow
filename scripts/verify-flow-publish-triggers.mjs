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

const publishRoute = read("app/api/v1/flows/[flowId]/publish/route.ts");
const triggerPanel = read("components/flow-builder/panels/TriggerPanel.tsx");
const flowCanvas = read("components/flow-builder/flow-canvas.tsx");
const zernioWebhook = read("lib/zernio-webhook.ts");
const syncRoute = read("app/api/v1/channels/sync/route.ts");
const cronRoute = read("app/api/cron/webhooks/route.ts");
const internalCron = read("lib/internal-cron-runner.ts");

assertContains(publishRoute, "syncFlowTriggers", "publish route");
assertContains(publishRoute, "triggerType", "publish route");
assertContains(publishRoute, ".from(\"triggers\")", "publish route");
assertContains(publishRoute, "channel_id: null", "publish route");
assertContains(publishRoute, "comment_keyword", "publish route");
assertContains(publishRoute, "source: \"flow_builder\"", "publish route");
assertContains(publishRoute, "triggerCount", "publish route");
assertContains(publishRoute, "activationScope", "publish route");
assertContains(publishRoute, "activeChannels", "publish route");
assertContains(publishRoute, "platforms", "publish route");
assertContains(publishRoute, "channelIds", "publish route");
assertContains(publishRoute, "invalid_trigger_scope", "publish route");
assertContains(publishRoute, "ensureZernflowWebhook", "publish route webhook");
assertContains(publishRoute, "webhook", "publish route webhook response");
assertContains(triggerPanel, "Canaux: tous les canaux actifs", "trigger panel activation copy");
assertContains(triggerPanel, "Plateformes choisies", "trigger panel platform scope");
assertContains(triggerPanel, "Comptes précis", "trigger panel channel scope");
assertContains(flowCanvas, "publishMessage", "flow canvas publish feedback");
assertContains(flowCanvas, "activation", "flow canvas publish feedback");
assertContains(zernioWebhook, "message.received", "zernio webhook helper");
assertContains(zernioWebhook, "comment.received", "zernio webhook helper");
assertContains(syncRoute, "ensureZernflowWebhook", "channels sync route webhook");
assertContains(cronRoute, "webhook_watchdog", "webhook watchdog cron route");
assertContains(cronRoute, "workspaceHasPublishedTriggers", "webhook watchdog cron route");
assertContains(internalCron, "/api/cron/webhooks", "internal cron webhook watchdog");

console.log("flow publish trigger verification passed");
