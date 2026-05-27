
GRANT INSERT, UPDATE, DELETE ON public.machines, public.jobs, public.shifts, public.job_steps, public.part_times, public.status_events, public.briefings TO anon;

CREATE POLICY "machines anon write" ON public.machines FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "jobs anon write" ON public.jobs FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "shifts anon write" ON public.shifts FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "job_steps anon write" ON public.job_steps FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "part_times anon write" ON public.part_times FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "status_events anon write" ON public.status_events FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "briefings anon write" ON public.briefings FOR ALL TO anon USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
