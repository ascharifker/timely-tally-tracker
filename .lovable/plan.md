# MAQUINADOS Importer

Scope: parse the `MAQUINADOS` sheet only from Fer's `CRONOGRAMA FLOTACION` workbook and bulk-load it into the live database. Admin-only, in-app, with preview + commit.

## Sheet shape (verified against uploaded file)

- Rows 1–4: header / title block (ignored).
- Row 5+ alternates between **machine group headers** (single cell in col A like `MAZAK 1`, `MAZAK 2`, `MAZAK 3`, `MAZAK 4`, `CENTRO DE MAQUINADO`, `MAQUINAS Y HERRAMIENTAS`, `MAQYRO`, `TEC MAQ`) and **data rows** belonging to the most recent header.
- Data-row columns:
  1. `No. de P.O.` — multi-line; first non-empty line containing digits → `purchase_orders.po_number`. Whole cell stored as raw.
  2. `No. de ODF` — e.g. `180/26` → `jobs.odf`.
  3. `FECHA DE ENTREGA EN PO` — date or text → `po_line_items.committed_date` (+ `jobs.customer_date`).
  4. `No. de Tuberia utilizada` — long text → `po_line_items.tube_spec`.
  5. `CODIGO DE PRODUCTO` — long text → `po_line_items.notes` (product description).
  6. `PIR` — e.g. `103012842 REV B` → `po_line_items.pir`.
  7. `CANTIDAD A PRODUCIR` — int or text like `"3\n1 DE 3 TOTALES"` → leading int → `po_line_items.qty_ordered` / `jobs.qty`.
  8. `FECHA` — ignored (it's the workbook-wide date stamp).
  9. `COMENTARIOS` — schedule notes like `21-may 3er turno .5 pza` → stored on `jobs.notes` AND best-effort parsed into planned `machine_runs`.

## Build pieces

### 1. Route `/admin/import-maquinados` (admin-only)

- Layout: `_authenticated` subtree, guarded by `has_role('admin')` check on mount (redirect to `/` otherwise).
- File drop zone for `.xlsx`. Parse client-side with `xlsx` (SheetJS) — already a one-off browser concern, no upload until commit.

### 2. Parser (`src/lib/maquinados-import.ts`, client-safe)

- `parseMaquinadosSheet(arrayBuffer) → ParsedRow[]`
- Iterates rows, tracks `currentMachineHeader` whenever a single-cell row matches the known machine-header regex.
- Emits one `ParsedRow` per data row with: raw cells, derived fields, the machine header string, and `validation: { errors: string[]; warnings: string[] }`.
- Hard errors block commit on that row: missing PO# digits, missing ODF, missing PIR, qty ≤ 0, no machine header in scope.
- Warnings (don't block): committed_date unparseable, schedule cell present but no runs parsed.

### 3. Machine auto-match

- `useMachines()` already exists; the parser is passed the machines list and resolves each header to a `machine_id` by case-insensitive trimmed name match.
- Unmatched header → all rows under it become row-level errors with message `Crear máquina "MAZAK 5" en Configuración antes de importar.`
- Importer does NOT auto-create machines (per your "Auto-match by name" answer).

### 4. Schedule cell parser (`parseScheduleCell`)

- Splits on newlines.
- Regex per line: `^(\d{1,2})-(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+(1er|2do|3er)\s+turno(?:\s+([\d.]+)\s*pza)?\s*$`
- Each successful match → one planned `machine_runs` row with computed `started_at` (date + shift start hour from `shifts` table or sensible defaults) and `pieces_completed = matched qty or 0`. Year inferred from `committed_date.year` (fallback current year).
- Unmatched lines are kept in the raw notes; row gets a warning if 0 of N lines parsed.
- Full raw `COMENTARIOS` text always goes into `jobs.notes` regardless of parse outcome.

### 5. Preview UI (`MaquinadosImportPreview`)

Single table grouped by machine header. Columns:

- Status pill (✓ OK / ⚠ warnings / ✗ errors)
- Machine (matched name or red "unmatched")
- PO# · ODF · PIR · Qty · Committed date
- Tube spec (truncated, hover for full)
- Product (truncated, hover for full)
- **Starts at** — `Select` per row defaulting to `MAZAK` (in-production). Options: `INTAKE`, `PENDIENTE_ING_STEP1..4`, `MAZAK`, `MAQUINADO_LISTO`, `TALLER_EXTERNO`, `TERMINADO`. Bulk-set control above the table.
- Planned runs count (badge `3 runs parsed` / `0/4 lines`)
- Notes preview (truncated)

Header row above table: total rows, breakdown (OK / warn / error), `Commit OK + warnings` button (disabled while any row has hard errors selected for commit; rows with errors are excluded automatically and flagged with a "skipped on commit" badge).

### 6. Commit path (server)

- `src/lib/maquinados-import.functions.ts` → `bulkImportMaquinados(payload: ParsedRow[])`
- `.middleware([requireSupabaseAuth])` + admin role check via `has_role`.
- Loads `supabaseAdmin` inside the handler (privileged, atomic across multiple tables).
- Calls Postgres function `public.bulk_import_maquinados(payload jsonb) returns jsonb` (created via migration). Function does, in one tx, per row:
  1. `INSERT … ON CONFLICT DO NOTHING` into `customers` (always `COE` since every row in this sheet is for COE based on the PO header text — single hard-coded customer for v1; flagged in TODOs for multi-customer later).
  2. Upsert `purchase_orders` by `(customer_id, po_number)` with `review_track='coe'`.
  3. Insert `po_line_items` (status = the per-row chosen status; PIR / qty / tube_spec / notes / committed_date populated).
  4. If status is in production set (`MAZAK`, `MAQUINADO_LISTO`, `TALLER_EXTERNO`, `TERMINADO`): insert `jobs` row with `odf`, `machine_id`, `qty`, `customer_date`, `status`, `notes`.
  5. Insert any parsed `machine_runs` rows linked to the new job.
  6. Insert one `status_events` row with `metadata.kind='bulk_import_maquinados'`.
- Returns `{ inserted, skipped, errors: [{rowIndex, message}] }` — surfaced as a result toast + summary card in the UI.

### 7. Migration

- Add `public.bulk_import_maquinados(payload jsonb)` security-definer function with `search_path=public`, executable by `authenticated`. Role check inside the function (`has_role(auth.uid(),'admin')`) so even direct RPC is gated.
- No new tables.

### 8. Nav

- Add a "Importar MAQUINADOS" link in the admin section of `AppShell` (visible only to admins via existing `useUserRole`).

## Out of scope (call out, build later)

- RIMADORAS / NUEVAS PO / FLOTACION sheets (separate parsers when needed).
- Multi-customer detection from the PO header (always COE for v1).
- Re-import / merge semantics — re-running with same ODF/PO will surface a unique-violation error in the result summary; user resolves manually.
- Editing rows in the preview before commit (read-only with status dropdown only).
- Saving the uploaded file to storage.

## Build order

1. Migration: `bulk_import_maquinados` SQL function.
2. `src/lib/maquinados-import.ts` parser + schedule parser + machine matcher (pure, unit-testable).
3. `src/lib/maquinados-import.functions.ts` server fn calling the RPC.
4. `src/routes/_authenticated/admin.import-maquinados.tsx` route + preview UI.
5. Add `xlsx` (SheetJS) via `bun add xlsx`.
6. Nav entry.
7. Smoke test against the uploaded file end-to-end.
