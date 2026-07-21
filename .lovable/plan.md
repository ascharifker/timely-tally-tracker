## Goal

Add HB pricing to PO lines and restructure the Orders table so lines are grouped under their PO, with PO # sorting and expand/collapse.

## 1. Schema — add HB Price columns

Migration on `public.po_line_items`:
- `hb_price numeric(12,2)` — unit price agreed with Halliburton (per piece).
- `total_hb numeric(14,2)` generated as `hb_price * qty_ordered` (Postgres `GENERATED ALWAYS AS ... STORED`), so it stays in sync automatically as qty or unit price changes.

Update the fetch in `src/hooks/usePoLinesSpreadsheet.ts` to select the two new columns, and extend `POLineItem` in `src/lib/fact-types.ts`.

Parser stays untouched for now — user confirmed manual entry, upgrade later.

## 2. Allow editing HB Price

- Add `hb_price` to `EDITABLE_FIELDS` in `src/lib/po-workflow.functions.ts` (numeric coercion; null clears). `total_hb` is generated, never edited.
- Extend `EditableField` type in `PoLinesSpreadsheet.tsx`.

## 3. Group rows by PO # with expand/collapse

Rework `src/components/fact/PoLinesSpreadsheet.tsx`:
- After filtering, group `filtered` rows by `po.id` (rows without a PO fall into a synthetic "No PO" group at the bottom).
- Render a **PO header row** per group with:
  - expand/collapse chevron (default collapsed; state kept in a `Set<string>` in component state, persisted to `localStorage` so it survives navigation)
  - Customer, PO # (clickable link, as today), line count, earliest committed date, group totals (Qty, Pending, **Total HB** = sum of line `total_hb`), and an aggregate status pill (e.g. "3 pending eng · 2 in prod").
- Line rows render only when the group is expanded, indented under the header, keeping all existing editable cells (PIR, Description, Qty, Customer date, Notes) plus two new cells: **HB Price** (editable) and **Total HB** (read-only, right-aligned currency).
- Search / preset filters continue to operate on lines; a group is shown only if at least one line matches, and auto-expands when the search query is non-empty so matches are visible.

Column header row updates: add "HB Price" and "Total HB" columns; keep the existing 13 columns.

## 4. Sort by PO #

- Change the current "active first / committed_date asc" sort to sort **groups**, not lines, so the whole table is ordered by PO.
- Default group sort: PO # ascending (natural sort so `PO-10` comes after `PO-2`).
- Add a small sort control above the table with three options: **PO # ↑**, **PO # ↓**, **Earliest date**. Persist choice to `localStorage`.
- Inside each group, lines keep their line_number order.

## 5. Currency formatting

Small helper in `src/lib/utils.ts` (or local to the component) to format HB values as USD with thousands separator; null → "—".

## Out of scope

- Parser auto-extraction of price (explicit user request to defer).
- Changes to `/purchase-orders/$id` detail page or `PoDetailDialog` — only mention if the user later asks; HB fields naturally show up there once selected, but not required now.

## Technical notes

- `total_hb` as a `GENERATED` column avoids drift and keeps the totals correct when Peter edits qty inline.
- Grouping is a pure client-side render change over the already-fetched `rows`; no new server function needed beyond adding `hb_price` to the editable-field enum.
