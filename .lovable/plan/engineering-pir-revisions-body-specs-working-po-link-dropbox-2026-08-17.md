# Engineering: PIR revisions, body specs, working PO link, Dropbox

## 1. PIR version (revision) column

- New field `pir_rev` on PO lines (short text, e.g. `A`, `02`, `Rev C`).
- Shows as its own column in the Orders spreadsheet, inline-editable like PIR, and included in CSV export and the PO detail view.
- Shown and editable in Engineering Step 2 (PIR Verification) next to the PIR number, so Alexis records which revision was verified.
- The PO parser tries to pull a revision when the PDF states one; otherwise it stays blank for manual entry.
- Revision changes are logged in the existing line history/audit trail so a later revision bump is visible.

## 2. Tube / body specs (separate from component specs)

Today there is one free-text `tube_spec` blob. Add a dedicated **Body / Tube Spec** panel that stores real fields on the line:

- OD, wall, grade/material, length, thread/connection, heat treatment, plus a free-text note.
- Lives as a new step panel in the Engineering drawer ("Body Spec Review") between PIR Verification and Part Component List, with each field editable and saved to the line.
- The existing `tube_spec` text stays as the raw/imported value and is displayed read-only for reference, so nothing already captured is lost.
- Orders table gets an optional compact summary column (OD × wall × grade) built from the structured fields.

If the exact field list from Engineering differs, the fields are defined in one config file so they can be changed without touching the UI.

## 3. Fix the "Open source PDF" link in Step 1

The PO upload stores a storage *path*, but Step 1 (and the PO detail dialog) renders that path as a plain link against a private bucket, so it 404s.

- Step 1 will request a short-lived signed URL through the existing `getPoDocumentUrl` server function and open that.
- Same fix applied in the PO detail dialog.
- If no document was uploaded for the PO, the link is hidden and a "No PDF attached" note plus an **Attach PO PDF** button appears, so a missing document can be fixed in place.

## 4. Dropbox connection (phased)

Phase A — search and open from the platform:
- Connect Dropbox through Lovable's connector so the app can query your Dropbox on your team's account.
- A **Design plans** panel in the Engineering drawer searches Dropbox by PIR (and revision) and lists matching files with a preview/open link — no more leaving the app.

Phase B — Master PIR sync:
- Point the app at the Dropbox folder/file holding the ~10k-line MASTER PIR.
- The app pulls it on a schedule, indexes it into a searchable table (PIR, revision, description, component/body spec fields), and Step 3 auto-matches the line's PIR + revision against it: green when the revision matches, warning when the file has a newer revision, red when the PIR is not found.
- Edits made here (PIR, revision, specs) are flagged for write-back; whether the app writes back into the Dropbox master file or only produces a change report is decided before building Phase B, since writing to a shared 10k-row workbook is risky.

Phase A is small; Phase B depends on seeing the actual MASTER PIR file structure (column headers) and confirming Dropbox access.

## Technical notes

- Migration adds `pir_rev text` and structured body-spec columns (`body_od`, `body_wall`, `body_grade`, `body_length`, `body_thread`, `body_heat_treat`, `body_notes`) to `po_line_items`.
- Body-spec field definitions live in a new `src/lib/body-spec.ts` config consumed by the drawer panel and the spreadsheet summary.
- Step 1 PDF link switches from raw `source_document_url` to `useServerFn(getPoDocumentUrl)`.
- New engineering step key `body_spec` added to `src/lib/engineering-steps.ts`; existing lines mid-funnel keep working because step order is resolved by key.
- Dropbox uses the standard connector (server-side only); Master PIR index becomes a `master_pir` table refreshed by a server function.

## Order of work

1. Fix the PDF link (immediate, no schema change).
2. Migration + PIR revision column + body spec panel.
3. Dropbox Phase A search.
4. Master PIR ingest and auto-verification once the file structure is confirmed.
