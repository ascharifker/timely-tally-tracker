
-- Tighten SELECT policies from {public} (anon+authenticated) to {authenticated} only
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['briefings','customers','date_change_log','machines','odf_sequences','part_times','shifts','status_events']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || ' read', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (true)', t || ' read authenticated', t);
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon', t);
  END LOOP;
END $$;
