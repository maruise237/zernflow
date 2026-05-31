type CronTask = {
  name: string;
  path: string;
  intervalMs: number;
  initialDelayMs: number;
};

declare global {
  // eslint-disable-next-line no-var
  var __zernflowInternalCronRunnerStarted: boolean | undefined;
}

const TASKS: CronTask[] = [
  {
    name: "jobs",
    path: "/api/cron/jobs",
    intervalMs: 60_000,
    initialDelayMs: 15_000,
  },
  {
    name: "sequences",
    path: "/api/cron/sequences",
    intervalMs: 60_000,
    initialDelayMs: 30_000,
  },
];

export function startInternalCronRunner() {
  if (globalThis.__zernflowInternalCronRunnerStarted) return;
  if (!shouldStartInternalCron()) return;

  globalThis.__zernflowInternalCronRunnerStarted = true;

  for (const task of TASKS) {
    scheduleTask(task);
  }

  console.info("[internal-cron] started");
}

function shouldStartInternalCron() {
  if (process.env.npm_lifecycle_event === "build") return false;
  if (process.env.VERCEL === "1") return false;
  if (process.env.DISABLE_INTERNAL_CRON === "true") return false;

  return Boolean(process.env.CRON_SECRET);
}

function scheduleTask(task: CronTask) {
  let isRunning = false;

  const run = () => {
    if (isRunning) return;

    isRunning = true;
    void runTask(task).finally(() => {
      isRunning = false;
    });
  };

  setTimeout(run, task.initialDelayMs);
  setInterval(run, task.intervalMs);
}

async function runTask(task: CronTask) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return;

  const baseUrl = getBaseUrl();
  const url = new URL(task.path, baseUrl);

  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      signal: AbortSignal.timeout(55_000),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(
        `[internal-cron] ${task.name} failed with ${response.status}: ${body}`
      );
    }
  } catch (err) {
    console.error(`[internal-cron] ${task.name} failed`, err);
  }
}

function getBaseUrl() {
  return (
    process.env.CRON_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    `http://127.0.0.1:${process.env.PORT || "3000"}`
  );
}
