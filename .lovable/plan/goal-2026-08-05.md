## Goal

Make extracted PO prices appear immediately and consistently everywhere users review an uploaded order.

## Verified diagnosis

- The latest 13 uploaded lines all have `unit_price`, `hb_price`, and `total_hb` saved in the database; the parser-to-database mapping is working for those uploads.
- The main Orders query already reads `hb_price` and `total_hb`, but the upload flow does not invalidate its `po_lines_spreadsheet` cache after saving.
- The dedicated PO detail page and the reusable PO detail dialog do not query or render the HB price fields at all.
- The currently open Orders preview does not render the HB Price / Total HB labels, despite the source containing them, so validation must include a fresh rendered preview rather than relying only on saved data.

## Changes

### 1. Refresh prices immediately after upload
- Invalidate the Orders spreadsheet query after `commitPo` succeeds so newly saved prices appear without a reload or stale cached rows.
- Keep the existing purchase-order and customer invalidations.

### 2. Show prices in every order-lines table
- Add `hb_price` and `total_hb` to the PO detail query/type.
- Add **HB Price** and **Total HB** columns to both the PO detail page and reusable PO detail dialog.
- Use the saved currency where available and a consistent fallback display for missing prices.

### 3. Harden the upload contract
- Keep one canonical price value through review and commit so the visible **HB Price** field is exactly what is saved.
- Preserve the current fallback that derives a unit price from a line total when the PDF only provides an extended amount.
- Ensure an explicitly reviewed/edited HB Price is not overwritten by a different extracted field during commit.

### 4. Verify the full flow
- Confirm a parsed price appears in the upload review, is saved to `hb_price`, produces the expected `total_hb = hb_price × qty`, and renders in the Orders list immediately.
- Confirm the same values appear after opening the PO detail page and after a fresh reload.
- Check both unit-price PDFs and line-total-only PDFs, plus a line with no detected price.

## Technical scope

- Frontend query invalidation and order-line presentation.
- Upload/commit price-field consistency.
- No database schema change or data reset is required.