
-- Per-machine active shifts (defaults to all 3)
ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS active_shifts text[] NOT NULL DEFAULT ARRAY['manana','tarde','noche'];

-- Operator name on jobs
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS operator_name text;

-- Seed MAZAK 5 (morning only until Halliburton volume resumes) and GMAC external shop
INSERT INTO public.machines (name, type, display_order, hours_per_shift, active_shifts)
VALUES ('MAZAK 5', 'internal', 5, 8, ARRAY['manana'])
ON CONFLICT (name) DO UPDATE SET active_shifts = EXCLUDED.active_shifts, display_order = EXCLUDED.display_order;

INSERT INTO public.machines (name, type, display_order, hours_per_shift, active_shifts)
VALUES ('GMAC', 'external_shop', 13, 8, ARRAY['manana','tarde','noche'])
ON CONFLICT (name) DO NOTHING;
