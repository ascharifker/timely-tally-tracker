-- Engineering Verification Funnel: per-step state + cycle-time events

ALTER TABLE public.po_line_items
  ADD COLUMN IF NOT EXISTS eng_step text NULL,
  ADD COLUMN IF NOT EXISTS eng_step_started_at timestamptz NULL;

CREATE INDEX IF NOT EXISTS po_line_items_status_eng_step_idx
  ON public.po_line_items(status, eng_step);

-- Dedicated event log for PO line engineering step transitions.
-- Separate from public.status_events (which is scoped to jobs/machines).
CREATE TABLE IF NOT EXISTS public.po_line_step_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_line_item_id uuid NOT NULL REFERENCES public.po_line_items(id) ON DELETE CASCADE,
  from_step text NULL,
  to_step text NULL,
  kind text NOT NULL DEFAULT 'advance',
  actor uuid NULL,
  elapsed_ms bigint NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.po_line_step_events TO authenticated;
GRANT ALL ON public.po_line_step_events TO service_role;

ALTER TABLE public.po_line_step_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read po_line_step_events"
  ON public.po_line_step_events FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert po_line_step_events"
  ON public.po_line_step_events FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE INDEX IF NOT EXISTS po_line_step_events_line_idx
  ON public.po_line_step_events(po_line_item_id, occurred_at DESC);

-- Backfill: any line currently in pending_engineering starts at step 1.
UPDATE public.po_line_items
SET eng_step = 'po_info',
    eng_step_started_at = COALESCE(eng_step_started_at, now())
WHERE status = 'pending_engineering'
  AND eng_step IS NULL;
