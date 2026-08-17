# Fix PO part-number extraction + add prices to export

Peter's two issues from the Halliburton PO: the first 3 line items got the wrong part numbers, and the Orders screen (the one that shows prices) can't be exported with those prices.

## Why the part numbers are wrong

Confirmed by reading a real Halliburton/Ariba PO (4518744487):

- The correct part number is in the line table's **Customer Part #** column (e.g. `102882625`).
- Below each line there is a long "TECHNICAL DATA" comment block listing the whole bill of materials — dozens of rows like `COM 102974776 ...`, `PIR 100077052 ...`, `MDW`, `SPC`, `DRW`, each with a level (00, 01, 02, 03) and a revision letter.
- The extractor is grabbing one of those nested component `PIR` rows instead of the top-level part number, because the block literally contains the word "PIR" many times.

## Changes

### 1. Teach the extractor where the real part number lives
In the PO extraction prompt (`src/lib/po-intake.functions.ts`):
- `pir` must come from the line table's **Customer Part # / Material / Part #** column — never from the Comments / TECHNICAL DATA block.
- Explicitly instruct: ignore `COM`, `MDW`, `SPC`, `DRW` rows, and only use a `PIR` row from the technical block when its level is `00` **and** its number equals the Customer Part #.
- `pir_rev` = the REV letter on that level-`00` `PIR`/`MAT` row for the same part number (e.g. `C`).
- `tube_spec` = the line's Part # / Description text (e.g. `SH,FL,7-5/8BLK TSH523 33.7,PQ,DV,RPT,EDJ`), not a component description.
- Also return the raw `customer_part_number` per line so we can cross-check.

### 2. Server-side sanity check
After the model responds, if `pir` differs from the returned `customer_part_number`, prefer the customer part number and mark that line `low_confidence`. Also mark lines where the part number doesn't appear in the PDF's line-item region.

### 3. Flag suspect lines in the review step
In `UploadPoDialog.tsx`, show a small "check part #" warning badge on flagged lines so the user corrects them before saving. The PIR field is already editable there.

### 4. Export prices from the Orders screen
In `ExportLinesDialog.tsx`, add **HB Price** and **Total HB** columns to the CSV and include the price in the plain-text/email summary, plus a grand total row. This makes the priced Orders view exportable, which is what Peter asked for.

## Out of scope
- Master PIR / Dropbox cross-validation (separate phase).
- Any schema change — no new columns needed.
