export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const { startInternalCronRunner } = await import("./lib/internal-cron-runner");
  startInternalCronRunner();
}
