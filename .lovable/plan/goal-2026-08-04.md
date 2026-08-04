## Goal

When a PO PDF is uploaded, the price extracted by the parser must land in the Orders table's **HB Price / Total HB** columns — today it is captured but stored in a different field the Orders table never reads.

## What's happening now

- The AI extractor already pulls `unit_price` and `currency` per line, and the upload dialog shows them as editable fields.
- On commit, those values are written to `po_line_items.unit_price` / `currency`.
- The Orders table reads `hb_price` and the generated `total_hb`, which stay empty — so uploaded prices never appear.

## Changes

### 1. Carry the extracted price into HB Price
- In `src/lib/po-intake.functions.ts`, when inserting line items in `commitPo`, also set `hb_price` from the line's price. `total_hb` is generated automatically from `hb_price * qty_ordered`.
- Add `hb_price` to the commit input schema so the dialog can send an explicitly edited value that differs from `unit_price`.

### 2. Make the extraction stronger about prices
- Extend the extractor prompt so it reads unit price, extended/line total, and currency, and normalizes formats (thousands separators, `USD`/`$`/`ARS`, values like `1.234,56`).
- If only a line total is present, derive the unit price by dividing by quantity; if only a unit price is present, leave the total to the generated column.

### 3. Show it in the review step before commit
- In `src/components/fact/UploadPoDialog.tsx`, relabel the price field as **HB Price** and add a read-only **Total HB** preview (price × qty) per line, plus a PO-level total, so the user can confirm or correct what the parser found before saving.

## Out of scope
- Changing how `unit_price` is used elsewhere; it stays as-is for backward compatibility (HB Price is populated alongside it).
- Any schema change — `hb_price` and `total_hb` already exist.
