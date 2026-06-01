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

assertContains(publishRoute, "syncFlowTriggers", "publish route");
assertContains(publishRoute, "triggerType", "publish route");
assertContains(publishRoute, ".from(\"triggers\")", "publish route");
assertContains(publishRoute, "channel_id: null", "publish route");
assertContains(publishRoute, "comment_keyword", "publish route");
assertContains(publishRoute, "source: \"flow_builder\"", "publish route");
assertContains(publishRoute, "triggerCount", "publish route");
assertContains(triggerPanel, "Canaux: tous les canaux actifs", "trigger panel activation copy");
assertContains(flowCanvas, "publishMessage", "flow canvas publish feedback");
assertContains(flowCanvas, "tous les canaux actifs", "flow canvas publish feedback");

console.log("flow publish trigger verification passed");
