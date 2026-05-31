# Dokploy Scheduled Jobs

ZernFlow has two background processors:

- delayed flow and broadcast jobs: `npm run cron:jobs`
- sequence drip campaign steps: `npm run cron:sequences`

`vercel.json` only configures Vercel Cron. On Dokploy, create Dokploy schedules instead.

## Recommended Dokploy Setup

Create two enabled schedules for the ZernFlow application:

| Name | Type | Cron expression | Command |
|------|------|-----------------|---------|
| ZernFlow jobs | Application Job | `* * * * *` | `npm run cron:jobs` |
| ZernFlow sequences | Application Job | `* * * * *` | `npm run cron:sequences` |

Use the same application container that runs `npm run start`. The container must have `CRON_SECRET` set. If Dokploy cannot reach the app on `http://127.0.0.1:$PORT`, set one of these runtime variables:

```env
CRON_BASE_URL=https://your-zernflow-domain.com
CRON_SECRET=your-strong-secret
```

The scripts call the existing Next.js cron endpoints with:

```http
Authorization: Bearer $CRON_SECRET
```

## Why This Matters

Dokploy does not read Vercel Cron configuration. Without Dokploy schedules, `/api/cron/jobs` and `/api/cron/sequences` can exist but never run in production.

The database migration `00014_atomic_scheduler_claims.sql` makes these schedules safe to run every minute by claiming due rows with `FOR UPDATE SKIP LOCKED`. If two scheduler runs overlap, only one worker can process a given job or sequence enrollment.
