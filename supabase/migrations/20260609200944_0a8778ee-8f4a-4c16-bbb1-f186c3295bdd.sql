
-- 1. Drop all anonymous write policies
DROP POLICY IF EXISTS "briefings anon write" ON public.briefings;
DROP POLICY IF EXISTS "customers anon write" ON public.customers;
DROP POLICY IF EXISTS "date_change_log anon write" ON public.date_change_log;
DROP POLICY IF EXISTS "job_steps anon write" ON public.job_steps;
DROP POLICY IF EXISTS "jobs anon write" ON public.jobs;
DROP POLICY IF EXISTS "machine_runs anon write" ON public.machine_runs;
DROP POLICY IF EXISTS "machines anon write" ON public.machines;
DROP POLICY IF EXISTS "odf_sequences write anon" ON public.odf_sequences;
DROP POLICY IF EXISTS "part_times anon write" ON public.part_times;
DROP POLICY IF EXISTS "po_line_items anon write" ON public.po_line_items;
DROP POLICY IF EXISTS "purchase_orders anon write" ON public.purchase_orders;
DROP POLICY IF EXISTS "shifts anon write" ON public.shifts;
DROP POLICY IF EXISTS "status_events anon write" ON public.status_events;
DROP POLICY IF EXISTS "vendors anon write" ON public.vendors;

-- 2. Drop redundant unrestricted "write auth" policies where role-based ones exist
DROP POLICY IF EXISTS "job_steps write auth" ON public.job_steps;
DROP POLICY IF EXISTS "jobs write auth" ON public.jobs;
DROP POLICY IF EXISTS "machine_runs write auth" ON public.machine_runs;
DROP POLICY IF EXISTS "po_line_items write auth" ON public.po_line_items;
DROP POLICY IF EXISTS "purchase_orders write auth" ON public.purchase_orders;

-- 3. Restrict vendor SELECT to authenticated users
DROP POLICY IF EXISTS "vendors read" ON public.vendors;
CREATE POLICY "vendors read authenticated"
  ON public.vendors
  FOR SELECT
  TO authenticated
  USING (true);

-- Also revoke anon SELECT privilege so PostgREST denies it
REVOKE SELECT ON public.vendors FROM anon;

-- 4. Recreate v_job_current_step without SECURITY DEFINER
DROP VIEW IF EXISTS public.v_job_current_step;
CREATE VIEW public.v_job_current_step
WITH (security_invoker = true)
AS
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
ORDER BY j.id, s.step_order;

GRANT SELECT ON public.v_job_current_step TO authenticated;
GRANT SELECT ON public.v_job_current_step TO service_role;

-- 5. Tighten EXECUTE permissions on SECURITY DEFINER functions
-- Trigger-only functions: no one should call directly
REVOKE EXECUTE ON FUNCTION public.touch_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_po_line_date_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_po_line_export_date_change() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.log_job_date_change() FROM PUBLIC, anon, authenticated;

-- RLS helper functions: only authenticated users need them
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.has_active_delegation(uuid, public.review_track) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_edit_po(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.current_user_can_edit_production() FROM PUBLIC, anon;

-- ODF allocator: only authenticated users
REVOKE EXECUTE ON FUNCTION public.next_odf_number(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.next_odf_number(integer) TO authenticated;

-- 6. Storage: restrict po-documents bucket policies to authenticated
DROP POLICY IF EXISTS "po-documents read" ON storage.objects;
DROP POLICY IF EXISTS "po-documents insert" ON storage.objects;
DROP POLICY IF EXISTS "po-documents update" ON storage.objects;
DROP POLICY IF EXISTS "po-documents delete" ON storage.objects;

CREATE POLICY "po-documents read auth"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'po-documents');

CREATE POLICY "po-documents insert auth"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'po-documents');

CREATE POLICY "po-documents update auth"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (bucket_id = 'po-documents')
  WITH CHECK (bucket_id = 'po-documents');

CREATE POLICY "po-documents delete auth"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'po-documents');
