DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['purchase_orders','po_line_items','po_line_quality_checks','po_line_step_events','jobs','job_steps','machine_runs','machines','part_times','shifts','status_events','customers','vendors','briefings','date_change_log','quality_matrix_items','quality_matrix_templates']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'allow_anon_read_' || t, t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
  END LOOP;
END $$;