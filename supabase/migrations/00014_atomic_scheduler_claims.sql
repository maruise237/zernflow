-- Atomic cron claims for delayed flows and sequences.
-- Vercel Cron can overlap invocations, so workers must claim rows in the DB.

ALTER TABLE scheduled_jobs
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

ALTER TABLE sequence_enrollments
  ADD COLUMN IF NOT EXISTS locked_at timestamptz;

DROP INDEX IF EXISTS idx_scheduled_jobs_pending;
CREATE INDEX IF NOT EXISTS idx_scheduled_jobs_due
  ON scheduled_jobs(run_at, locked_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_sequence_enrollments_due
  ON sequence_enrollments(next_step_at, locked_at)
  WHERE status IN ('active', 'processing');

CREATE OR REPLACE FUNCTION claim_due_scheduled_jobs(batch_size integer DEFAULT 20)
RETURNS SETOF scheduled_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE scheduled_jobs
  SET status = 'failed',
      last_error = coalesce(last_error, 'Timed out while processing')
  WHERE status = 'processing'
    AND locked_at < now() - interval '10 minutes'
    AND attempts >= 3;

  RETURN QUERY
  WITH due AS (
    SELECT id
    FROM scheduled_jobs
    WHERE (
        status = 'pending'
        AND run_at <= now()
      )
      OR (
        status = 'processing'
        AND locked_at < now() - interval '10 minutes'
        AND attempts < 3
      )
    ORDER BY run_at ASC
    LIMIT batch_size
    FOR UPDATE SKIP LOCKED
  )
  UPDATE scheduled_jobs sj
  SET status = 'processing',
      attempts = sj.attempts + 1,
      locked_at = now()
  FROM due
  WHERE sj.id = due.id
  RETURNING sj.*;
END;
$$;

CREATE OR REPLACE FUNCTION claim_due_sequence_enrollments(batch_size integer DEFAULT 50)
RETURNS TABLE (
  id uuid,
  sequence_id uuid,
  contact_id uuid,
  channel_id uuid,
  current_step_index integer,
  status text,
  enrolled_at timestamptz,
  next_step_at timestamptz,
  completed_at timestamptz,
  locked_at timestamptz,
  sequence_workspace_id uuid,
  sequence_steps jsonb,
  sequence_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH due AS (
    SELECT se.id
    FROM sequence_enrollments se
    WHERE (
        se.status = 'active'
        AND se.next_step_at <= now()
      )
      OR (
        se.status = 'processing'
        AND se.locked_at < now() - interval '10 minutes'
      )
    ORDER BY se.next_step_at ASC
    LIMIT batch_size
    FOR UPDATE OF se SKIP LOCKED
  ),
  claimed AS (
    UPDATE sequence_enrollments se
    SET status = 'processing',
        locked_at = now()
    FROM due
    WHERE se.id = due.id
    RETURNING se.*
  )
  SELECT
    c.id,
    c.sequence_id,
    c.contact_id,
    c.channel_id,
    c.current_step_index,
    c.status,
    c.enrolled_at,
    c.next_step_at,
    c.completed_at,
    c.locked_at,
    s.workspace_id AS sequence_workspace_id,
    s.steps AS sequence_steps,
    s.status AS sequence_status
  FROM claimed c
  JOIN sequences s ON s.id = c.sequence_id;
END;
$$;
