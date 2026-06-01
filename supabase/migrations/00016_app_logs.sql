-- Temporary application logs for production debugging.
-- Keep this table while stabilizing live automations, then prune or remove it.

create table if not exists app_logs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id) on delete cascade,
  level text not null default 'info',
  source text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_logs_workspace_created
  on app_logs(workspace_id, created_at desc);

create index if not exists idx_app_logs_level_created
  on app_logs(level, created_at desc);

alter table app_logs enable row level security;

create policy "Users can view app logs in their workspace"
  on app_logs for select
  using (
    workspace_id in (
      select workspace_id from workspace_members where user_id = auth.uid()
    )
  );
