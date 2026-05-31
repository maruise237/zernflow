# Dokploy Cron Processing

ZernFlow has two background processors:

- delayed flow and broadcast jobs: `npm run cron:jobs`
- sequence drip campaign steps: `npm run cron:sequences`

`vercel.json` only configures Vercel Cron. On Dokploy, ZernFlow can run these
processors automatically inside the Next.js server process.

## Recommended Dokploy Setup

Set these runtime variables on the Dokploy application:

```env
CRON_SECRET=your-strong-secret
NEXT_PUBLIC_APP_URL=https://your-zernflow-domain.com
CRON_BASE_URL=https://your-zernflow-domain.com
```

When `CRON_SECRET` is set and the app is not running on Vercel, the internal cron
runner starts automatically with `npm run start`. It calls:

```http
GET /api/cron/jobs
GET /api/cron/sequences
Authorization: Bearer $CRON_SECRET
```

To turn this off, set:

```env
DISABLE_INTERNAL_CRON=true
```

## Manual Fallback

If you prefer Dokploy scheduled jobs, create two enabled schedules for the
ZernFlow application:

| Name | Type | Cron expression | Command |
|------|------|-----------------|---------|
| ZernFlow jobs | Application Job | `* * * * *` | `npm run cron:jobs` |
| ZernFlow sequences | Application Job | `* * * * *` | `npm run cron:sequences` |

## Why This Matters

Dokploy does not read Vercel Cron configuration. Without the internal runner or
Dokploy schedules, `/api/cron/jobs` and `/api/cron/sequences` can exist but never
run in production.

The database migration `00014_atomic_scheduler_claims.sql` makes these schedules safe to run every minute by claiming due rows with `FOR UPDATE SKIP LOCKED`. If two scheduler runs overlap, only one worker can process a given job or sequence enrollment.
