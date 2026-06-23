
BEGIN;

TRUNCATE TABLE
  public.machine_runs,
  public.job_steps,
  public.jobs,
  public.briefings,
  public.date_change_log,
  public.status_events,
  public.po_line_step_events,
  public.po_line_items,
  public.purchase_orders,
  public.customers,
  public.odf_sequences
RESTART IDENTITY CASCADE;

COMMIT;
