
-- 1) ODF sequences (nnn/yy)
CREATE TABLE public.odf_sequences (
  year integer PRIMARY KEY,
  last_number integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.odf_sequences TO anon, authenticated;
GRANT ALL ON public.odf_sequences TO service_role;
ALTER TABLE public.odf_sequences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "odf_sequences read" ON public.odf_sequences FOR SELECT USING (true);
CREATE POLICY "odf_sequences write auth" ON public.odf_sequences FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "odf_sequences write anon" ON public.odf_sequences FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.next_odf_number(p_year integer)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  INSERT INTO public.odf_sequences(year, last_number)
  VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_number = public.odf_sequences.last_number + 1
  RETURNING last_number INTO n;
  RETURN lpad(n::text, 3, '0') || '/' || lpad((p_year % 100)::text, 2, '0');
END;
$$;

-- 2) Extend job_status enum
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'EN_ESPERA';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'ON_HOLD';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'MAQYRO';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'EN_GEMAK';
ALTER TYPE public.job_status ADD VALUE IF NOT EXISTS 'CEMENTACION_LISTO';

-- 3) export_date on po_line_items + trigger log
ALTER TABLE public.po_line_items ADD COLUMN IF NOT EXISTS export_date date;

CREATE OR REPLACE FUNCTION public.log_po_line_export_date_change()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.export_date IS DISTINCT FROM OLD.export_date THEN
    INSERT INTO public.date_change_log(po_line_item_id, field, old_value, new_value)
    VALUES (NEW.id, 'export_date', OLD.export_date, NEW.export_date);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_po_line_export_date ON public.po_line_items;
CREATE TRIGGER trg_log_po_line_export_date
  AFTER UPDATE ON public.po_line_items
  FOR EACH ROW EXECUTE FUNCTION public.log_po_line_export_date_change();

-- Make sure the committed_date trigger is also installed (function existed but trigger missing).
DROP TRIGGER IF EXISTS trg_log_po_line_committed_date ON public.po_line_items;
CREATE TRIGGER trg_log_po_line_committed_date
  AFTER UPDATE ON public.po_line_items
  FOR EACH ROW EXECUTE FUNCTION public.log_po_line_date_change();

-- 4) job_steps: planned dates + vendor
ALTER TABLE public.job_steps ADD COLUMN IF NOT EXISTS planned_start timestamptz;
ALTER TABLE public.job_steps ADD COLUMN IF NOT EXISTS planned_end   timestamptz;
ALTER TABLE public.job_steps ADD COLUMN IF NOT EXISTS vendor_id     uuid;

CREATE INDEX IF NOT EXISTS idx_job_steps_job ON public.job_steps(job_id, step_order);

-- 5) Current-step view
CREATE OR REPLACE VIEW public.v_job_current_step AS
SELECT DISTINCT ON (j.id)
  j.id AS job_id,
  s.id AS step_id,
  s.step_order,
  s.step_name,
  s.status,
  s.machine_id,
  s.vendor_id,
  s.planned_start,
  s.planned_end,
  s.started_at,
  s.completed_at
FROM public.jobs j
LEFT JOIN public.job_steps s ON s.job_id = j.id AND s.completed_at IS NULL
ORDER BY j.id, s.step_order NULLS LAST;

GRANT SELECT ON public.v_job_current_step TO anon, authenticated, service_role;
