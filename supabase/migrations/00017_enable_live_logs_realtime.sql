-- Enable the internal live logs console to receive inserts through Supabase Realtime.
-- The dashboard still polls as a fallback, but this makes log updates appear instantly.

do $$
begin
  alter publication supabase_realtime add table automation_events;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table app_logs;
exception
  when duplicate_object then null;
end $$;
