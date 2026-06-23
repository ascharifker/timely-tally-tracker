
# Demo Reset + Pending-ODF Importer

Two shippable pieces. Do the wipe first (today, pre-demo). Build the importer next as its own small wave so Fer can paste in his backlog when he's ready.

---

## Piece 1 — Demo wipe (transactional + customers)

One migration that truncates the demo data in dependency order, in a transaction.

**Wiped (CASCADE-safe order):**
- `machine_runs`
- `job_steps`
- `jobs`
- `briefings`
- `date_change_log`
- `status_events`
- `po_line_step_events`
- `po_line_items`
- `purchase_orders`
- `customers`
- `odf_sequences` (so ODF numbering restarts at 001/26)

**Preserved:** `machines`, `vendors`, `part_times`, `user_roles`, `review_delegations`, auth users, storage buckets (object files in `po-documents/` left alone — orphaned but harmless; can purge later if Fer wants).

Delivered as a single migration so it goes through the normal approval gate. After it runs, the app boots into an empty state — engineering, production, intake, purchase-orders pages all render with zero rows.

---

## Piece 2 — Pending-ODF importer (in-app, admin-only)

New route `/admin/import` (admin role only, route gated under `_authenticated/`).

### Flow
1. **Drop .xlsx** → parsed in the browser with `xlsx` (SheetJS). No upload until commit.
2. **Preview grid** → every row shown with parsed values, derived fields (customer match, PO match), and per-row validation status (ok / warning / error). Errors block the row; warnings don't.
3. **Per-row "Starts at" selector** → dropdown per row: `Engineering · Step 1 (PO Info)` | `Engineering · Step 2 (PIR Verify)` | `Engineering · Step 3 (Components)` | `Engineering · Step 4 (Matrix)` | `Ready for production`. Bulk-set control at the top ("Set all to…").
4. **Commit** → server function runs the insert in a single transaction, returns counts + any row-level failures.

### Assumed column shape (Mego's usual)
We plan against these; refine when Fer's sheet lands.

| Sheet column     | Maps to                                  |
|------------------|------------------------------------------|
| Customer         | `customers.name` (fuzzy match → create if new) |
| PO #             | `purchase_orders.po_number` (group rows) |
| Line #           | `po_line_items.line_number` (auto if blank) |
| PIR              | `po_line_items.pir`                      |
| Tube spec        | `po_line_items.tube_spec`                |
| Qty              | `po_line_items.qty_ordered`              |
| Committed date   | `po_line_items.committed_date`           |
| Export date      | `po_line_items.export_date`              |
| ODF              | `jobs.odf` (only created if "Ready for production") |
| Notes            | `po_line_items.notes`                    |
| Review track     | `purchase_orders.review_track` (default `coe`) |

Loose-row tolerance: missing PIR / tube spec / dates are allowed and just keep the row in earlier engineering steps. Missing customer + PO# + qty = hard error.

### Commit logic (server function)
- `bulkImportPendingLines({ rows })` with `requireSupabaseAuth` + admin role check.
- Per row:
  1. Upsert customer by name.
  2. Upsert PO by `(customer_id, po_number)`.
  3. Insert `po_line_items` with `status` derived from the row's "Starts at" choice (`pending_engineering` + matching `eng_step`, or `ready_for_production`).
  4. If "Ready for production" AND `odf` provided → insert a `jobs` row linked to the line; otherwise skip job creation (it'll happen in the normal production flow).
  5. Log a `status_events` row with `metadata.kind='bulk_import'` so cycle-time math doesn't count import as a step.
- Wrap whole batch in a Postgres function `public.bulk_import_pending_lines(payload jsonb)` so it's truly atomic — partial failure rolls back.

### What we don't build now
- No Excel template generator (Fer brings his own; importer just maps columns).
- No edit-in-place in the preview grid — errors must be fixed in Excel and re-uploaded. Keeps v1 small.
- No re-import / merge semantics. Second import = additional rows.

---

## Build order
1. Migration wipe (today, before demo).
2. After demo + Fer's sheet in hand: column mapping refinement → importer route + preview UI → server fn + Postgres function → smoke test with his actual file.

Approve and I'll start with the wipe migration.
