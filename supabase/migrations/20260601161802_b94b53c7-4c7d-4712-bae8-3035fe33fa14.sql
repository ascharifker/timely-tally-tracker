
-- Paso 2.5 (a): wipe demo data + queue/role schema + date-change audit log.

-- ============================================================
-- Part A: Wipe operational + customer demo data.
-- ============================================================
TRUNCATE TABLE
  public.status_events,
  public.machine_runs,
  public.shifts,
  public.job_steps,
  public.jobs,
  public.po_line_items,
  public.purchase_orders,
  public.customers,
  public.briefings
RESTART IDENTITY CASCADE;

-- ============================================================
-- Part B: po_line_items workflow status
-- ============================================================
CREATE TYPE public.po_line_status AS ENUM (
  'pending_engineering',
  'engineering_approved',
  'engineering_flagged',
  'ready_for_production',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

ALTER TABLE public.po_line_items
  ADD COLUMN status public.po_line_status NOT NULL DEFAULT 'pending_engineering',
  ADD COLUMN flag_reason text,
  ADD COLUMN engineering_reviewed_at timestamptz,
  ADD COLUMN engineering_reviewed_by text;

CREATE INDEX idx_po_line_items_status ON public.po_line_items(status);

-- ============================================================
-- Part D: date_change_log + triggers
-- ============================================================
CREATE TABLE public.date_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  po_line_item_id uuid REFERENCES public.po_line_items(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE CASCADE,
  field text NOT NULL,
  old_value date,
  new_value date,
  changed_by text,
  changed_at timestamptz NOT NULL DEFAULT now(),
  reason text,
  acknowledged_by_peter boolean NOT NULL DEFAULT false,
  acknowledged_at timestamptz
);

CREATE INDEX idx_date_change_log_unack ON public.date_change_log(acknowledged_by_peter, changed_at DESC);
CREATE INDEX idx_date_change_log_job ON public.date_change_log(job_id);
CREATE INDEX idx_date_change_log_line ON public.date_change_log(po_line_item_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.date_change_log TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.date_change_log TO authenticated;
GRANT ALL ON public.date_change_log TO service_role;

ALTER TABLE public.date_change_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "date_change_log read" ON public.date_change_log FOR SELECT USING (true);
CREATE POLICY "date_change_log anon write" ON public.date_change_log FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "date_change_log auth write" ON public.date_change_log FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Trigger on jobs: log changes to customer_date, planned_end, planned_start
CREATE OR REPLACE FUNCTION public.log_job_date_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.customer_date IS DISTINCT FROM OLD.customer_date THEN
    INSERT INTO public.date_change_log(job_id, po_line_item_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.po_line_item_id, 'customer_date', OLD.customer_date, NEW.customer_date);
  END IF;
  IF NEW.planned_end IS DISTINCT FROM OLD.planned_end THEN
    INSERT INTO public.date_change_log(job_id, po_line_item_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.po_line_item_id, 'planned_end', OLD.planned_end::date, NEW.planned_end::date);
  END IF;
  IF NEW.planned_start IS DISTINCT FROM OLD.planned_start THEN
    INSERT INTO public.date_change_log(job_id, po_line_item_id, field, old_value, new_value)
    VALUES (NEW.id, NEW.po_line_item_id, 'planned_start', OLD.planned_start::date, NEW.planned_start::date);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_job_date_change
  AFTER UPDATE ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.log_job_date_change();

-- Trigger on po_line_items: log changes to committed_date
CREATE OR REPLACE FUNCTION public.log_po_line_date_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.committed_date IS DISTINCT FROM OLD.committed_date THEN
    INSERT INTO public.date_change_log(po_line_item_id, field, old_value, new_value)
    VALUES (NEW.id, 'committed_date', OLD.committed_date, NEW.committed_date);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_log_po_line_date_change
  AFTER UPDATE ON public.po_line_items
  FOR EACH ROW
  EXECUTE FUNCTION public.log_po_line_date_change();
