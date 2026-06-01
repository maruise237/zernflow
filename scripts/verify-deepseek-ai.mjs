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

const packageJson = read("package.json");
const aiResponseNode = read("lib/flow-engine/nodes/ai-response.ts");
const aiPanel = read("components/flow-builder/panels/AiResponsePanel.tsx");
const flowCanvas = read("components/flow-builder/flow-canvas.tsx");
const templatesView = read("app/(dashboard)/dashboard/flows/templates/templates-view.tsx");
const settingsView = read("app/(dashboard)/dashboard/settings/settings-view.tsx");
const envExample = read(".env.example");

assertContains(packageJson, "@ai-sdk/deepseek", "package dependencies");
assertContains(aiResponseNode, "createDeepSeek", "AI response node");
assertContains(aiResponseNode, "DEEPSEEK_API_KEY", "AI response node");
assertContains(aiResponseNode, "deepseek/", "AI response node");
assertContains(aiPanel, "deepseek/deepseek-v4-flash", "AI response panel");
assertContains(aiPanel, "deepseek/deepseek-v4-pro", "AI response panel");
assertContains(flowCanvas, "deepseek/deepseek-v4-flash", "flow canvas default model");
assertContains(templatesView, "deepseek/deepseek-v4-flash", "flow templates default model");
assertContains(settingsView, "DeepSeek", "settings view");
assertContains(envExample, "DEEPSEEK_API_KEY", "environment example");

console.log("DeepSeek AI verification passed");
