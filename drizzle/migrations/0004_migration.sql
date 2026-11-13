CREATE TABLE public.shift_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  log_date date NOT NULL DEFAULT current_date,
  shift_number smallint NOT NULL,
  machine_id uuid REFERENCES public.machines(id) ON DELETE SET NULL,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  operator_name text,
  pieces_machined integer NOT NULL DEFAULT 0,
  stage_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX shift_logs_date_idx ON public.shift_logs(log_date);
CREATE INDEX shift_logs_job_idx ON public.shift_logs(job_id);

CREATE TABLE public.job_stage_settings (
  job_id uuid PRIMARY KEY REFERENCES public.jobs(id) ON DELETE CASCADE,
  not_applicable text[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_logs TO authenticated;
GRANT ALL ON public.shift_logs TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_stage_settings TO authenticated;
GRANT ALL ON public.job_stage_settings TO service_role;

ALTER TABLE public.shift_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_stage_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.validate_shift_log() RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.shift_number NOT IN (1,2,3) THEN RAISE EXCEPTION 'Turno debe ser 1, 2 o 3'; END IF;
  IF NEW.pieces_machined < 0 THEN RAISE EXCEPTION 'Piezas no puede ser negativo'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER shift_logs_validate BEFORE INSERT OR UPDATE ON public.shift_logs FOR EACH ROW EXECUTE FUNCTION public.validate_shift_log();

CREATE POLICY "Staff read shift logs" ON public.shift_logs FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Production editors write shift logs" ON public.shift_logs FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_production());
CREATE POLICY "Production editors update shift logs" ON public.shift_logs FOR UPDATE TO authenticated
  USING (public.current_user_can_edit_production()) WITH CHECK (public.current_user_can_edit_production());
CREATE POLICY "Production editors delete shift logs" ON public.shift_logs FOR DELETE TO authenticated
  USING (public.current_user_can_edit_production());

CREATE POLICY "Staff read stage settings" ON public.job_stage_settings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid()));
CREATE POLICY "Production editors manage stage settings" ON public.job_stage_settings FOR ALL TO authenticated
  USING (public.current_user_can_edit_production()) WITH CHECK (public.current_user_can_edit_production());