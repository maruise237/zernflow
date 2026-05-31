const job = process.argv[2];

const paths = {
  jobs: "/api/cron/jobs",
  sequences: "/api/cron/sequences",
};

if (!job || !paths[job]) {
  console.error("Usage: node scripts/run-cron.mjs <jobs|sequences>");
  process.exit(1);
}

const cronSecret = process.env.CRON_SECRET;
if (!cronSecret) {
  console.error("CRON_SECRET is required");
  process.exit(1);
}

const baseUrl =
  process.env.CRON_BASE_URL ||
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  `http://127.0.0.1:${process.env.PORT || "3000"}`;

const url = new URL(paths[job], baseUrl);
const response = await fetch(url, {
  headers: {
    Authorization: `Bearer ${cronSecret}`,
  },
});

const body = await response.text();

if (!response.ok) {
  console.error(`Cron ${job} failed with ${response.status}: ${body}`);
  process.exit(1);
}

console.log(body);
