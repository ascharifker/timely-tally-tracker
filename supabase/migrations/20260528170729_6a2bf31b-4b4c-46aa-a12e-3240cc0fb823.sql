ALTER TABLE public.machines
  ADD COLUMN IF NOT EXISTS hours_per_shift NUMERIC NOT NULL DEFAULT 8;

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS hours_override NUMERIC NULL;

-- Dedup any existing duplicates before unique constraint
DELETE FROM public.part_times a
USING public.part_times b
WHERE a.ctid < b.ctid
  AND a.pir = b.pir
  AND a.machine_id = b.machine_id;

ALTER TABLE public.part_times
  ADD CONSTRAINT part_times_pir_machine_unique UNIQUE (pir, machine_id);

ALTER TABLE public.part_times
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS touch_part_times_updated_at ON public.part_times;
CREATE TRIGGER touch_part_times_updated_at
  BEFORE UPDATE ON public.part_times
  FOR EACH ROW
  EXECUTE FUNCTION public.touch_updated_at();