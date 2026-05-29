-- 1. Extend machines with specs + cost + vendor link
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS model text,
  ADD COLUMN IF NOT EXISTS serial_number text,
  ADD COLUMN IF NOT EXISTS year integer,
  ADD COLUMN IF NOT EXISTS purchase_date date,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS hourly_cost numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vendor_id uuid;

-- 2. Vendors table (external shops)
CREATE TABLE IF NOT EXISTS public.vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tax_id text,
  contact_name text,
  contact_email text,
  contact_phone text,
  hourly_rate numeric NOT NULL DEFAULT 0,
  lead_time_days_avg numeric,
  notes text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.vendors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendors TO authenticated;
GRANT ALL ON public.vendors TO service_role;

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendors read" ON public.vendors FOR SELECT USING (true);
CREATE POLICY "vendors anon write" ON public.vendors FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "vendors write auth" ON public.vendors FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER vendors_touch_updated_at
  BEFORE UPDATE ON public.vendors
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. Machine runs (real production captures)
CREATE TABLE IF NOT EXISTS public.machine_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL,
  machine_id uuid NOT NULL,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  pieces_completed integer NOT NULL DEFAULT 0,
  operator_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS machine_runs_machine_idx ON public.machine_runs(machine_id, started_at DESC);
CREATE INDEX IF NOT EXISTS machine_runs_job_idx ON public.machine_runs(job_id, started_at DESC);

GRANT SELECT ON public.machine_runs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_runs TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machine_runs TO authenticated;
GRANT ALL ON public.machine_runs TO service_role;

ALTER TABLE public.machine_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "machine_runs read" ON public.machine_runs FOR SELECT USING (true);
CREATE POLICY "machine_runs anon write" ON public.machine_runs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "machine_runs write auth" ON public.machine_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER machine_runs_touch_updated_at
  BEFORE UPDATE ON public.machine_runs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. Extend event_kind enum with maintenance taxonomy
ALTER TYPE public.event_kind ADD VALUE IF NOT EXISTS 'maintenance_preventive';
ALTER TYPE public.event_kind ADD VALUE IF NOT EXISTS 'maintenance_corrective';