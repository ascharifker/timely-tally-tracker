# Peter's call fixes (Aug 19)

Three asks came out of that call. One is already done; two are not.

## 1. Upload review screen — can't see the part number or description
Today the review step opens in a medium dialog (`max-w-4xl`) and the line table scrolls sideways, so the PIR and description fields get squeezed and Peter has to scroll to verify each part number before confirming.

Fix:
- Open the review step nearly full screen (wide, tall, with the line table scrolling inside instead of the whole dialog).
- Give PIR and Spec/Description generous minimum widths so full values are visible without horizontal scrolling; shrink the narrow numeric columns (Qty, Currency, prices).
- Keep the amber "Check part #" warning in place.

## 2. Export only the POs you choose
Today Export always exports every row in the current view. Peter wants to pick specific POs.

Fix:
- Add a checkbox on each PO group header row in the orders table, plus a header "select all / none".
- When one or more POs are selected, the Export button exports only those POs' lines, and its label/scope shows the count (e.g. "3 POs"). With nothing selected, behavior is unchanged (exports the filtered view).
- Selection is view-only state, cleared when filters change.

## 3. Prices in the export — already working
`hb_price` / `total_hb` and a grand total are already in the CSV and the email summary. Confirmed in the current export code; no change needed.

## Technical details
- `src/components/fact/UploadPoDialog.tsx`: `DialogContent` → `max-w-[96vw] h-[92vh]` with an internal scroll region; add `min-w` classes to the PIR and description cells.
- `src/components/fact/PoLinesSpreadsheet.tsx`: new `selectedPos: Set<string>` state, checkbox in the group header and table header, pass the filtered-or-selected rows plus a scope string into `ExportLinesDialog`.
- `src/components/fact/ExportLinesDialog.tsx`: no logic change beyond receiving the narrowed rows/scope.
- No database or server-function changes.
