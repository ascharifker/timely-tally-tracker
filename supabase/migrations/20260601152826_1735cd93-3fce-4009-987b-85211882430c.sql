
-- 1. CUSTOMERS
CREATE TABLE public.customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text UNIQUE,
  active boolean NOT NULL DEFAULT true,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.customers TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customers TO authenticated;
GRANT ALL ON public.customers TO service_role;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "customers read" ON public.customers FOR SELECT USING (true);
CREATE POLICY "customers anon write" ON public.customers FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "customers write auth" ON public.customers FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_customers_updated_at BEFORE UPDATE ON public.customers
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2. PURCHASE_ORDERS
CREATE TABLE public.purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE RESTRICT,
  po_number text NOT NULL,
  issued_date date,
  committed_date date,
  status text NOT NULL DEFAULT 'received',
  source_document_url text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (customer_id, po_number)
);
CREATE INDEX idx_purchase_orders_customer_issued
  ON public.purchase_orders (customer_id, issued_date DESC);
GRANT SELECT ON public.purchase_orders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_orders TO authenticated;
GRANT ALL ON public.purchase_orders TO service_role;
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "purchase_orders read" ON public.purchase_orders FOR SELECT USING (true);
CREATE POLICY "purchase_orders anon write" ON public.purchase_orders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "purchase_orders write auth" ON public.purchase_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON public.purchase_orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3. PO_LINE_ITEMS
CREATE TABLE public.po_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id uuid NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
  line_number integer NOT NULL DEFAULT 1,
  pir text,
  tube_spec text,
  qty_ordered integer NOT NULL DEFAULT 1,
  committed_date date,
  unit_price numeric,
  currency text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_po_line_items_po ON public.po_line_items (purchase_order_id);
GRANT SELECT ON public.po_line_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.po_line_items TO authenticated;
GRANT ALL ON public.po_line_items TO service_role;
ALTER TABLE public.po_line_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "po_line_items read" ON public.po_line_items FOR SELECT USING (true);
CREATE POLICY "po_line_items anon write" ON public.po_line_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "po_line_items write auth" ON public.po_line_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_po_line_items_updated_at BEFORE UPDATE ON public.po_line_items
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 4. JOBS: FK opcional a la línea
ALTER TABLE public.jobs
  ADD COLUMN po_line_item_id uuid REFERENCES public.po_line_items(id) ON DELETE SET NULL;
CREATE INDEX idx_jobs_po_line_item ON public.jobs (po_line_item_id);

-- 5. MIGRACIÓN DE DATOS
INSERT INTO public.customers (name, code) VALUES
  ('Musa', 'MUSA'),
  ('Halliburton', 'HAL')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.purchase_orders (customer_id, po_number)
SELECT DISTINCT
  (SELECT id FROM public.customers WHERE code = 'MUSA'),
  j.po_musa
FROM public.jobs j
WHERE j.po_musa IS NOT NULL AND j.po_musa <> ''
ON CONFLICT (customer_id, po_number) DO NOTHING;

INSERT INTO public.purchase_orders (customer_id, po_number)
SELECT DISTINCT
  (SELECT id FROM public.customers WHERE code = 'HAL'),
  j.po_halliburton
FROM public.jobs j
WHERE j.po_halliburton IS NOT NULL AND j.po_halliburton <> ''
ON CONFLICT (customer_id, po_number) DO NOTHING;

WITH job_with_po AS (
  SELECT
    j.id AS job_id,
    j.pir,
    j.tube_spec,
    j.qty,
    j.customer_date,
    po.id AS po_id,
    ROW_NUMBER() OVER (PARTITION BY po.id ORDER BY j.created_at, j.id) AS line_number
  FROM public.jobs j
  JOIN public.customers c
    ON (c.code = 'MUSA' AND j.po_musa IS NOT NULL AND j.po_musa <> '')
    OR (c.code = 'HAL'  AND j.po_halliburton IS NOT NULL AND j.po_halliburton <> '')
  JOIN public.purchase_orders po
    ON po.customer_id = c.id
   AND po.po_number = CASE WHEN c.code = 'MUSA' THEN j.po_musa ELSE j.po_halliburton END
),
inserted AS (
  INSERT INTO public.po_line_items
    (purchase_order_id, line_number, pir, tube_spec, qty_ordered, committed_date)
  SELECT po_id, line_number, pir, tube_spec, qty, customer_date
  FROM job_with_po
  RETURNING id, purchase_order_id, line_number
)
UPDATE public.jobs j
SET po_line_item_id = i.id
FROM inserted i, job_with_po jwp
WHERE jwp.job_id = j.id
  AND i.purchase_order_id = jwp.po_id
  AND i.line_number = jwp.line_number;
