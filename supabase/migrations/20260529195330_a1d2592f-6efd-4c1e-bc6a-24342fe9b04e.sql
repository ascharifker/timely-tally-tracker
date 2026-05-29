-- Allow status_events to capture machine-level events (e.g. maintenance) without a job.
ALTER TABLE public.status_events ALTER COLUMN job_id DROP NOT NULL;
ALTER TABLE public.status_events ADD COLUMN machine_id uuid;
ALTER TABLE public.status_events ADD COLUMN started_at timestamptz;
ALTER TABLE public.status_events ADD COLUMN ended_at timestamptz;
ALTER TABLE public.status_events ADD COLUMN cost numeric;

CREATE INDEX IF NOT EXISTS idx_status_events_machine_id ON public.status_events(machine_id);

-- Sanity: at least one of job_id or machine_id must be present.
ALTER TABLE public.status_events
  ADD CONSTRAINT status_events_target_present
  CHECK (job_id IS NOT NULL OR machine_id IS NOT NULL);