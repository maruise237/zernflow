-- Production diagnostics for webhooks and flow executions.
-- This table is intentionally append-only from the app so support can answer:
-- did the webhook arrive, did a trigger match, and where did execution stop?

create table if not exists automation_events (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  flow_id uuid references flows(id) on delete set null,
  trigger_id uuid references triggers(id) on delete set null,
  channel_id uuid references channels(id) on delete set null,
  contact_id uuid references contacts(id) on delete set null,
  conversation_id uuid references conversations(id) on delete set null,
  session_id uuid references flow_sessions(id) on delete set null,
  source text not null default 'system',
  event_type text not null,
  status text not null default 'info',
  message text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_automation_events_workspace_created
  on automation_events(workspace_id, created_at desc);

create index if not exists idx_automation_events_flow_created
  on automation_events(flow_id, created_at desc);

create index if not exists idx_automation_events_channel_created
  on automation_events(channel_id, created_at desc);

create index if not exists idx_automation_events_type_created
  on automation_events(event_type, created_at desc);

alter table automation_events enable row level security;

create policy "Users can view automation events in their workspace"
  on automation_events for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );
