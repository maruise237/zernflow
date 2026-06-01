# ZernFlow

The open-source ManyChat alternative. Visual flow builder for Instagram, Facebook, Telegram, Twitter/X, Bluesky & Reddit.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Website](https://img.shields.io/badge/Website-zernflow.com-indigo)](https://zernflow.com)

**Live at [zernflow.com](https://zernflow.com)**

## What is ZernFlow?

ZernFlow is an open-source alternative to ManyChat. Build visual chatbot flows, manage contacts, send broadcasts, run drip campaigns, and handle live chat conversations across 6 social media platforms.

**Powered by [Zernio](https://zernio.com)** for OAuth, token refresh, rate limiting, and cross-platform messaging.

### Features

- **Visual Flow Builder** - Drag-and-drop chatbot builder with 15+ node types
- **AI Response Node** - AI-powered replies via DeepSeek direct provider or AI Gateway fallback (Vercel AI SDK)
- **Live Chat Inbox** - Real-time inbox with human takeover and conversation assignment
- **Contact CRM** - Tags, custom fields, segments, and contact management
- **Broadcasting** - Send targeted messages to contact segments
- **Sequences** - Drip campaigns with timed message series and automatic enrollment
- **Team Management** - Invite members, assign roles, manage permissions
- **Multi-Platform** - Instagram, Facebook, Telegram, Twitter/X, Bluesky, Reddit
- **Connect Channels** - OAuth connection flow directly from ZernFlow (powered by Zernio)
- **Rich Messaging** - Buttons, quick replies, and carousel cards
- **Comment-to-DM** - Automatically DM users who comment specific keywords
- **Growth Tools** - Conversation starter links for each connected platform
- **A/B Testing** - Split test different message paths
- **Webhooks & HTTP** - Connect to external APIs from your flows

## Quick Start

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Zernio](https://zernio.com) API key (entered in Settings after setup)
- A DeepSeek API key or [Vercel AI Gateway](https://vercel.com/ai-gateway) key (optional, for AI node, entered in Settings or env)

### Setup

1. **Clone the repo**

```bash
git clone https://github.com/zernio-dev/zernflow.git
cd zernflow
npm install
```

2. **Set up Supabase**

Create a free project at [supabase.com](https://supabase.com). Then run the SQL migrations in the Supabase SQL editor:

```bash
# Run each file in supabase/migrations/ in order
```

3. **Configure environment**

```bash
cp .env.example .env
```

Fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
CRON_SECRET=your-cron-secret              # For sequence processor + job scheduler
DEEPSEEK_API_KEY=...                      # Optional fallback for DeepSeek AI nodes
# AI_GATEWAY_API_KEY=...                  # Optional fallback for non-DeepSeek model ids
```

After starting the app, go to **Settings** to enter your Zernio API key and (optionally) a DeepSeek or AI Gateway key.

### Dokploy scheduled jobs

If you deploy with Dokploy, `vercel.json` cron entries are not used. ZernFlow starts an internal cron runner automatically when `CRON_SECRET` is set and the app is not running on Vercel.

Set these variables in Dokploy:

```env
CRON_SECRET=your-strong-secret
NEXT_PUBLIC_APP_URL=https://your-zernflow-domain.com
CRON_BASE_URL=https://your-zernflow-domain.com
```

The internal runner calls the job and sequence processors every minute. To disable it, set `DISABLE_INTERNAL_CRON=true`.

As a manual fallback, you can still configure two Dokploy Application Jobs:

```bash
npm run cron:jobs
npm run cron:sequences
```

Both can run every minute (`* * * * *`) and require `CRON_SECRET`. See [docs/dokploy-schedules.md](docs/dokploy-schedules.md).

4. **Run**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), sign up, and start building flows.

## Architecture

```
Browser (Flow Builder, Inbox, CRM, Sequences)
        |
   Next.js App Router
        |
   +----+----+----+----+----+
   |    |    |    |    |    |
Webhook Flow CRM  Live  Broadcast Sequence
Recv.  Engine     Chat           Processor
   |    |    |    |    |    |
   +----+----+----+----+----+
        |         |         |
    Supabase   Zernio API AI SDK
  (PG + Auth   (6 platforms) (OpenAI /
  + Realtime)              Anthropic /
                           Google)
```

## Stack

| Layer | Tool |
|-------|------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Database + Auth + Realtime | Supabase |
| Flow Builder | React Flow (@xyflow/react) |
| AI | Vercel AI SDK + DeepSeek direct provider, with [AI Gateway](https://vercel.com/ai-gateway) fallback |
| UI | Tailwind CSS 4 |
| Icons | @icons-pack/react-simple-icons |
| Messaging | [Zernio API](https://zernio.com) |

## Flow Node Types

| Node | Description |
|------|-------------|
| Trigger | Keyword, postback, quick reply, welcome, default |
| Send Message | Text, images, buttons, quick replies, carousels |
| AI Response | AI-powered replies with conversation context (DeepSeek, OpenAI, Anthropic, Google) |
| Condition | If/else on tags, fields, platform, variables |
| Delay | Wait seconds/minutes/hours/days |
| Add/Remove Tag | Manage contact tags |
| Set Custom Field | Set contact field values with variable interpolation |
| HTTP Request | Call external APIs, store responses |
| Go To Flow | Jump to another flow (with return stack) |
| Human Takeover | Pause automation, alert inbox |
| Enroll in Sequence | Add contact to a drip campaign |
| Subscribe/Unsubscribe | Toggle contact subscription |
| A/B Split | Randomly route contacts for testing |
| Smart Delay | Wait for user response or timeout |
| Comment Reply | Public reply to comments |
| Private Reply | Instagram comment-to-DM |

## Project Structure

```
zernflow/
├── app/
│   ├── (auth)/             # Login, register pages
│   ├── (dashboard)/        # Flows, inbox, contacts, sequences, settings
│   ├── invite/             # Team invite acceptance page
│   └── api/
│       ├── webhooks/late/   # Webhook receiver
│       ├── cron/jobs/       # Job scheduler
│       ├── cron/sequences/  # Sequence step processor
│       └── v1/              # CRUD API routes
├── components/
│   ├── flow-builder/        # Canvas, nodes, panels
│   ├── inbox/               # Conversation list, thread, contact panel
│   ├── sequences/           # Sequence editor, enrollment list
│   ├── settings/            # Team management
│   └── ui/                  # Shared UI components
├── lib/
│   ├── supabase/            # Server/client/middleware
│   ├── flow-engine/         # Engine, trigger matcher, platform adapter, AI node
│   ├── actions/             # Server actions (team, sequences, workspace)
│   └── types/               # TypeScript types
└── supabase/
    └── migrations/          # SQL schema + RLS policies (00001-00009)
```

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT
