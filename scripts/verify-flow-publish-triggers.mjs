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
const triggerNode = read("components/flow-builder/nodes/trigger-node.tsx");
const flowCanvas = read("components/flow-builder/flow-canvas.tsx");
const zernioWebhook = read("lib/zernio-webhook.ts");
const syncRoute = read("app/api/v1/channels/sync/route.ts");
const cronRoute = read("app/api/cron/webhooks/route.ts");
const internalCron = read("lib/internal-cron-runner.ts");
const templatesView = read("app/(dashboard)/dashboard/flows/templates/templates-view.tsx");

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
assertContains(publishRoute, "replyText", "publish route comment reply text");
assertContains(publishRoute, "invalid_trigger_scope", "publish route");
assertContains(publishRoute, "ensureZernflowWebhook", "publish route webhook");
assertContains(publishRoute, "webhook", "publish route webhook response");
assertContains(triggerPanel, "Canaux: tous les canaux actifs", "trigger panel activation copy");
assertContains(triggerPanel, "Chatbot IA - tous les messages", "trigger panel ai chatbot trigger");
assertContains(triggerPanel, "Recommande IA", "trigger panel ai chatbot trigger");
assertContains(triggerPanel, "Reponse publique automatique", "trigger panel comment reply text");
assertContains(triggerPanel, "Plateformes choisies", "trigger panel platform scope");
assertContains(triggerPanel, "Comptes précis", "trigger panel channel scope");
assertContains(triggerNode, "Chatbot IA", "trigger node ai chatbot label");
assertContains(templatesView, "Regardez vos DM", "gated resource template comment reply");
assertContains(templatesView, "check-subscriber", "gated resource subscription branch");
assertContains(templatesView, "CONFIRM_SUBSCRIBED_FOR_RESOURCE", "gated resource confirmation branch");
assertContains(templatesView, "actionType: \"privateReply\"", "gated resource private reply");
assertContains(templatesView, "buttons: [", "gated resource private reply button");
assertContains(flowCanvas, "publishMessage", "flow canvas publish feedback");
assertContains(flowCanvas, "activation", "flow canvas publish feedback");
assertContains(zernioWebhook, "message.received", "zernio webhook helper");
assertContains(zernioWebhook, "comment.received", "zernio webhook helper");
assertContains(syncRoute, "ensureZernflowWebhook", "channels sync route webhook");
assertContains(cronRoute, "webhook_watchdog", "webhook watchdog cron route");
assertContains(cronRoute, "workspaceHasPublishedTriggers", "webhook watchdog cron route");
assertContains(internalCron, "/api/cron/webhooks", "internal cron webhook watchdog");

console.log("flow publish trigger verification passed");
