export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { installServerLogCapture } = await import("./lib/server-log-capture");
  const { startInternalCronRunner } = await import("./lib/internal-cron-runner");
  installServerLogCapture();
  startInternalCronRunner();
}
