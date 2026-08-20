CREATE TABLE public.qc_document_matrix (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pir text NOT NULL UNIQUE,
  part_description text,
  documented_rev text,
  status text NOT NULL DEFAULT 'not_documented',
  dropbox_path text,
  dropbox_name text,
  source text,
  requested_at timestamptz,
  documented_at timestamptz,
  documented_by uuid REFERENCES auth.users(id),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT qc_document_matrix_status_chk CHECK (status IN ('documented','new_rev_pending','not_documented','requested_from_customer')),
  CONSTRAINT qc_document_matrix_source_chk CHECK (source IS NULL OR source IN ('dropbox','customer','internal'))
);

CREATE TABLE public.qc_document_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  matrix_id uuid NOT NULL REFERENCES public.qc_document_matrix(id) ON DELETE CASCADE,
  po_line_item_id uuid REFERENCES public.po_line_items(id) ON DELETE SET NULL,
  kind text NOT NULL,
  from_status text,
  to_status text,
  from_rev text,
  to_rev text,
  actor uuid REFERENCES auth.users(id),
  note text,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX qc_document_events_matrix_idx ON public.qc_document_events(matrix_id, occurred_at DESC);
CREATE INDEX qc_document_matrix_status_idx ON public.qc_document_matrix(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.qc_document_matrix TO authenticated;
GRANT ALL ON public.qc_document_matrix TO service_role;
GRANT SELECT, INSERT ON public.qc_document_events TO authenticated;
GRANT ALL ON public.qc_document_events TO service_role;

ALTER TABLE public.qc_document_matrix ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.qc_document_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.current_user_can_edit_qc()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  select auth.uid() is not null and (
    public.has_role(auth.uid(), 'admin')
    or public.has_role(auth.uid(), 'manager')
    or public.has_role(auth.uid(), 'engineer')
    or public.has_role(auth.uid(), 'quality')
  )
$$;

CREATE POLICY "qc matrix readable by authenticated"
  ON public.qc_document_matrix FOR SELECT TO authenticated USING (true);
CREATE POLICY "qc matrix writable by qc roles"
  ON public.qc_document_matrix FOR ALL TO authenticated
  USING (public.current_user_can_edit_qc())
  WITH CHECK (public.current_user_can_edit_qc());

CREATE POLICY "qc events readable by authenticated"
  ON public.qc_document_events FOR SELECT TO authenticated USING (true);
CREATE POLICY "qc events insertable by qc roles"
  ON public.qc_document_events FOR INSERT TO authenticated
  WITH CHECK (public.current_user_can_edit_qc());

CREATE TRIGGER trg_qc_document_matrix_updated_at
  BEFORE UPDATE ON public.qc_document_matrix
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();