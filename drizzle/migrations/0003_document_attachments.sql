CREATE TABLE public.document_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type text NOT NULL CHECK (entity_type IN ('purchase_order','po_line','job','qc_matrix')),
  entity_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'otro',
  source text NOT NULL CHECK (source IN ('dropbox','upload')),
  name text NOT NULL,
  dropbox_path text,
  storage_path text,
  rev text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX document_attachments_entity_idx ON public.document_attachments(entity_type, entity_id);
GRANT SELECT, INSERT, DELETE ON public.document_attachments TO authenticated;
GRANT ALL ON public.document_attachments TO service_role;
ALTER TABLE public.document_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Signed-in users read attachments" ON public.document_attachments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Signed-in users add own attachments" ON public.document_attachments FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Owner or admin deletes attachments" ON public.document_attachments FOR DELETE TO authenticated USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'manager') OR public.has_role(auth.uid(),'quality'));

INSERT INTO storage.objects (bucket_id, name) SELECT 'x','x' WHERE false;
CREATE POLICY "Signed-in read attachment files" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'attachments');
CREATE POLICY "Signed-in upload attachment files" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'attachments');