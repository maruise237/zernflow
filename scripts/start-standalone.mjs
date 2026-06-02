import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const root = process.cwd();
const standaloneDir = join(root, ".next", "standalone");
const staticSource = join(root, ".next", "static");
const staticTarget = join(standaloneDir, ".next", "static");
const publicSource = join(root, "public");
const publicTarget = join(standaloneDir, "public");
const serverPath = join(standaloneDir, "server.js");

if (!existsSync(serverPath)) {
  throw new Error("Missing .next/standalone/server.js. Run `npm run build` before `npm run start`.");
}

if (existsSync(staticSource) && !existsSync(staticTarget)) {
  await mkdir(join(standaloneDir, ".next"), { recursive: true });
  await cp(staticSource, staticTarget, { recursive: true });
}

if (existsSync(publicSource) && !existsSync(publicTarget)) {
  await cp(publicSource, publicTarget, { recursive: true });
}

const child = spawn(process.execPath, [serverPath], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
