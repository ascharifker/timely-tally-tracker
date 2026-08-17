ALTER TABLE public.po_line_items
  ADD COLUMN IF NOT EXISTS pir_rev text,
  ADD COLUMN IF NOT EXISTS body_od text,
  ADD COLUMN IF NOT EXISTS body_wall text,
  ADD COLUMN IF NOT EXISTS body_grade text,
  ADD COLUMN IF NOT EXISTS body_length text,
  ADD COLUMN IF NOT EXISTS body_thread text,
  ADD COLUMN IF NOT EXISTS body_heat_treat text,
  ADD COLUMN IF NOT EXISTS body_notes text;