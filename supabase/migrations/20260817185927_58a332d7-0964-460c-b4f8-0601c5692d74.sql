CREATE TABLE public.quality_matrix_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  version text,
  is_default boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.quality_matrix_templates
  ADD CONSTRAINT unique_template_name UNIQUE (name);

CREATE TABLE public.quality_matrix_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id uuid NOT NULL REFERENCES public.quality_matrix_templates(id) ON DELETE CASCADE,
  category text,
  label text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true
);

ALTER TABLE public.quality_matrix_items
  ADD CONSTRAINT unique_template_label UNIQUE (template_id, label);

CREATE TABLE public.po_line_quality_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  po_line_item_id uuid NOT NULL REFERENCES public.po_line_items(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.quality_matrix_items(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pass', 'fail', 'n_a')),
  notes text,
  checked_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checked_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (po_line_item_id, item_id)
);

ALTER TABLE public.po_line_items
  ADD COLUMN IF NOT EXISTS quality_matrix_document_url text,
  ADD COLUMN IF NOT EXISTS quality_matrix_signed_off_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quality_matrix_signed_off_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS quality_matrix_notes text;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_matrix_templates TO authenticated;
GRANT ALL ON public.quality_matrix_templates TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quality_matrix_items TO authenticated;
GRANT ALL ON public.quality_matrix_items TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_line_quality_checks TO authenticated;
GRANT ALL ON public.po_line_quality_checks TO service_role;

ALTER TABLE public.quality_matrix_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quality_matrix_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_line_quality_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read quality matrix templates"
  ON public.quality_matrix_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Engineering roles can manage quality matrix templates"
  ON public.quality_matrix_templates FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'engineer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'engineer'));

CREATE POLICY "Authenticated users can read quality matrix items"
  ON public.quality_matrix_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "Engineering roles can manage quality matrix items"
  ON public.quality_matrix_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'engineer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'engineer'));

CREATE POLICY "Authenticated users can read quality checks"
  ON public.po_line_quality_checks FOR SELECT TO authenticated USING (true);

CREATE POLICY "Engineering roles can manage quality checks"
  ON public.po_line_quality_checks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'engineer'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'manager') OR public.has_role(auth.uid(), 'engineer'));

WITH default_template AS (
  INSERT INTO public.quality_matrix_templates (name, version, is_default)
  VALUES ('General Quality Matrix', '1.0', true)
  ON CONFLICT (name) DO NOTHING
  RETURNING id
)
INSERT INTO public.quality_matrix_items (template_id, category, label, description, sort_order)
SELECT id, d.category, d.label, d.description, d.sort_order
FROM default_template, (VALUES
  ('Dimensional', 'Dimensional inspection', 'Verify OD, ID, length and wall thickness against body spec', 0),
  ('Thread', 'Thread inspection', 'Verify thread form, pitch, and engagement per spec', 1),
  ('Surface', 'Surface finish inspection', 'Verify surface finish, coatings, and visual defects', 2),
  ('Material', 'Material certification', 'Verify heat number, grade, and mill certificate', 3),
  ('Heat treatment', 'Heat treatment certification', 'Verify hardness, heat treat, and test reports', 4)
) AS d(category, label, description, sort_order)
ON CONFLICT (template_id, label) DO NOTHING;