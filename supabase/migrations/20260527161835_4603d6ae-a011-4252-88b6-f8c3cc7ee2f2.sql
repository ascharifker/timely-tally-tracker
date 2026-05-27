
-- Enums
CREATE TYPE public.machine_type AS ENUM ('internal', 'external_shop');
CREATE TYPE public.shift_slot AS ENUM ('manana', 'tarde', 'noche');
CREATE TYPE public.job_status AS ENUM ('PLANNED', 'MAZAK', 'MAQUINADO_LISTO', 'CEMENTACION', 'EXPO', 'YA_SE_ENVIO');
CREATE TYPE public.job_priority AS ENUM ('low', 'normal', 'high', 'urgent');

-- machines
CREATE TABLE public.machines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  type public.machine_type NOT NULL DEFAULT 'internal',
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.machines TO authenticated;
GRANT SELECT ON public.machines TO anon;
GRANT ALL ON public.machines TO service_role;
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "machines read" ON public.machines FOR SELECT USING (true);
CREATE POLICY "machines write auth" ON public.machines FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- jobs
CREATE TABLE public.jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  odf TEXT NOT NULL,
  po_musa TEXT,
  po_halliburton TEXT,
  pir TEXT,
  tube_spec TEXT,
  qty INT NOT NULL DEFAULT 1,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  status public.job_status NOT NULL DEFAULT 'PLANNED',
  priority public.job_priority NOT NULL DEFAULT 'normal',
  export_date DATE,
  customer_date DATE,
  planned_start TIMESTAMPTZ,
  planned_end TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;
GRANT SELECT ON public.jobs TO anon;
GRANT ALL ON public.jobs TO service_role;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "jobs read" ON public.jobs FOR SELECT USING (true);
CREATE POLICY "jobs write auth" ON public.jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- shifts
CREATE TABLE public.shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  slot public.shift_slot NOT NULL,
  available BOOLEAN NOT NULL DEFAULT true,
  job_id UUID REFERENCES public.jobs(id) ON DELETE SET NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date, machine_id, slot)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shifts TO authenticated;
GRANT SELECT ON public.shifts TO anon;
GRANT ALL ON public.shifts TO service_role;
ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "shifts read" ON public.shifts FOR SELECT USING (true);
CREATE POLICY "shifts write auth" ON public.shifts FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- job_steps
CREATE TABLE public.job_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  step_order INT NOT NULL,
  step_name TEXT NOT NULL,
  machine_id UUID REFERENCES public.machines(id) ON DELETE SET NULL,
  status public.job_status NOT NULL DEFAULT 'PLANNED',
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  note TEXT
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_steps TO authenticated;
GRANT SELECT ON public.job_steps TO anon;
GRANT ALL ON public.job_steps TO service_role;
ALTER TABLE public.job_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "job_steps read" ON public.job_steps FOR SELECT USING (true);
CREATE POLICY "job_steps write auth" ON public.job_steps FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- part_times
CREATE TABLE public.part_times (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pir TEXT NOT NULL,
  machine_id UUID NOT NULL REFERENCES public.machines(id) ON DELETE CASCADE,
  hours_per_piece NUMERIC(10,3) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pir, machine_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.part_times TO authenticated;
GRANT SELECT ON public.part_times TO anon;
GRANT ALL ON public.part_times TO service_role;
ALTER TABLE public.part_times ENABLE ROW LEVEL SECURITY;
CREATE POLICY "part_times read" ON public.part_times FOR SELECT USING (true);
CREATE POLICY "part_times write auth" ON public.part_times FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- status_events
CREATE TABLE public.status_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  from_status public.job_status,
  to_status public.job_status NOT NULL,
  delay_hours NUMERIC(10,2),
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.status_events TO authenticated;
GRANT SELECT ON public.status_events TO anon;
GRANT ALL ON public.status_events TO service_role;
ALTER TABLE public.status_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "status_events read" ON public.status_events FOR SELECT USING (true);
CREATE POLICY "status_events write auth" ON public.status_events FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- briefings
CREATE TABLE public.briefings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  briefing_date DATE NOT NULL,
  kind TEXT NOT NULL,
  content TEXT NOT NULL,
  source_snapshot JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.briefings TO authenticated;
GRANT SELECT ON public.briefings TO anon;
GRANT ALL ON public.briefings TO service_role;
ALTER TABLE public.briefings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "briefings read" ON public.briefings FOR SELECT USING (true);
CREATE POLICY "briefings write auth" ON public.briefings FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER jobs_touch BEFORE UPDATE ON public.jobs
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Seed machines
INSERT INTO public.machines (name, type, display_order) VALUES
  ('MAZAK 1', 'internal', 1),
  ('MAZAK 2', 'internal', 2),
  ('MAZAK 3', 'internal', 3),
  ('MAZAK 4', 'internal', 4),
  ('GEMAK', 'external_shop', 10),
  ('MAQYRO', 'external_shop', 11),
  ('TECMAC', 'external_shop', 12);
