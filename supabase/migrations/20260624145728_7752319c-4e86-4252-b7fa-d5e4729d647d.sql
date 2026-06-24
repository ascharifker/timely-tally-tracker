
CREATE OR REPLACE FUNCTION public.bulk_import_maquinados(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r jsonb;
  customer_uuid uuid;
  po_uuid uuid;
  line_uuid uuid;
  job_uuid uuid;
  inserted int := 0;
  skipped int := 0;
  errors jsonb := '[]'::jsonb;
  row_idx int := 0;
  v_po_number text;
  v_odf text;
  v_pir text;
  v_qty int;
  v_tube text;
  v_notes_product text;
  v_committed date;
  v_machine_id uuid;
  v_line_status po_line_status;
  v_job_status job_status;
  v_comentarios text;
  v_runs jsonb;
  run_item jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'forbidden: admin role required';
  END IF;

  -- Ensure COE customer exists
  INSERT INTO public.customers(name, code, active)
  VALUES ('COE', 'COE', true)
  ON CONFLICT (name) DO NOTHING;
  SELECT id INTO customer_uuid FROM public.customers WHERE name = 'COE';

  FOR r IN SELECT * FROM jsonb_array_elements(payload)
  LOOP
    row_idx := row_idx + 1;
    BEGIN
      v_po_number := nullif(trim(r->>'po_number'),'');
      v_odf := nullif(trim(r->>'odf'),'');
      v_pir := nullif(trim(r->>'pir'),'');
      v_qty := COALESCE((r->>'qty')::int, 0);
      v_tube := r->>'tube_spec';
      v_notes_product := r->>'notes_product';
      v_committed := CASE WHEN nullif(r->>'committed_date','') IS NULL THEN NULL ELSE (r->>'committed_date')::date END;
      v_machine_id := CASE WHEN nullif(r->>'machine_id','') IS NULL THEN NULL ELSE (r->>'machine_id')::uuid END;
      v_line_status := COALESCE(nullif(r->>'status','')::po_line_status, 'in_progress');
      v_job_status := CASE WHEN nullif(r->>'job_status','') IS NULL THEN NULL ELSE (r->>'job_status')::job_status END;
      v_comentarios := r->>'comentarios';
      v_runs := COALESCE(r->'runs', '[]'::jsonb);

      IF v_po_number IS NULL OR v_odf IS NULL OR v_pir IS NULL OR v_qty <= 0 THEN
        skipped := skipped + 1;
        errors := errors || jsonb_build_object('rowIndex', row_idx, 'message', 'missing required fields');
        CONTINUE;
      END IF;

      -- Upsert PO
      INSERT INTO public.purchase_orders(customer_id, po_number, review_track, status)
      VALUES (customer_uuid, v_po_number, 'coe', 'received')
      ON CONFLICT (customer_id, po_number) DO UPDATE SET updated_at = now()
      RETURNING id INTO po_uuid;

      -- Insert line item (auto line_number = max+1 for this PO)
      INSERT INTO public.po_line_items(
        purchase_order_id, line_number, pir, tube_spec, qty_ordered,
        committed_date, notes, status
      )
      VALUES (
        po_uuid,
        COALESCE((SELECT max(line_number) FROM public.po_line_items WHERE purchase_order_id = po_uuid), 0) + 1,
        v_pir, v_tube, v_qty, v_committed, v_notes_product, v_line_status
      )
      RETURNING id INTO line_uuid;

      -- If production status, create job
      IF v_job_status IS NOT NULL THEN
        INSERT INTO public.jobs(odf, pir, tube_spec, qty, machine_id, status, customer_date, notes, po_line_item_id)
        VALUES (v_odf, v_pir, v_tube, v_qty, v_machine_id, v_job_status, v_committed, v_comentarios, line_uuid)
        RETURNING id INTO job_uuid;

        -- Status event
        INSERT INTO public.status_events(job_id, machine_id, to_status, event_kind, reason)
        VALUES (job_uuid, v_machine_id, v_job_status, 'delay', 'bulk_import_maquinados');

        -- Machine runs (planned only — pieces stored as completed=0 with note)
        IF v_machine_id IS NOT NULL THEN
          FOR run_item IN SELECT * FROM jsonb_array_elements(v_runs)
          LOOP
            INSERT INTO public.machine_runs(job_id, machine_id, started_at, pieces_completed, notes)
            VALUES (
              job_uuid,
              v_machine_id,
              (run_item->>'started_at')::timestamptz,
              COALESCE((run_item->>'pieces')::int, 0),
              'planned (imported)'
            );
          END LOOP;
        END IF;
      END IF;

      inserted := inserted + 1;
    EXCEPTION WHEN OTHERS THEN
      skipped := skipped + 1;
      errors := errors || jsonb_build_object('rowIndex', row_idx, 'message', SQLERRM);
    END;
  END LOOP;

  RETURN jsonb_build_object('inserted', inserted, 'skipped', skipped, 'errors', errors);
END;
$$;

REVOKE ALL ON FUNCTION public.bulk_import_maquinados(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.bulk_import_maquinados(jsonb) TO authenticated;
