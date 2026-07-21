
ALTER TABLE public.po_line_items
  ADD COLUMN IF NOT EXISTS hb_price numeric(12,2),
  ADD COLUMN IF NOT EXISTS total_hb numeric(14,2)
    GENERATED ALWAYS AS (hb_price * qty_ordered) STORED;
