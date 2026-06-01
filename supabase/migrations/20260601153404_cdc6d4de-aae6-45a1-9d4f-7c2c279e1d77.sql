
INSERT INTO storage.buckets (id, name, public)
VALUES ('po-documents', 'po-documents', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "po-documents read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'po-documents');

CREATE POLICY "po-documents insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'po-documents');

CREATE POLICY "po-documents update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'po-documents');

CREATE POLICY "po-documents delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'po-documents');
