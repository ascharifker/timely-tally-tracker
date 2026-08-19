# Call prep — Catalina (QC / Quality Matrix), 30 min

Goal of the call: understand how QC actually inspects, in her words, so the module mirrors her process instead of the two sample checklists. Come out with enough to freeze a data model.

## What we have today (so you can speak to it)

- Engineering funnel has 4 steps: PO Info -> PIR Verification -> Part Component List -> Quality Matrix Check.
- Step 4 today: a generic checklist (Pass / Fail / N/A per item + notes), one attached reference document, and a single sign-off with timestamp and user. Editable only by the Engineering role.
- The two files she sent are dimensional inspection sheets: rows = characteristics (dimension + tolerance), columns = pieces inspected, one sheet filled by Calidad and one by Producción. Our current model cannot hold per-piece measurements — that's the main gap.

## The 8 questions to get answered

1. **Product or process?** She asked this directly. Confirm: we want product inspection (per part / per PO line) first, and process/production self-check second. Ask if both must live in the same record.
2. **Who fills what, and when.** Producción self-check at first piece? Calidad at final? In-process every N pieces? Who signs, and can production submit without QC?
3. **Where the criteria come from.** For a given part number / PIR / revision, where do the characteristics and tolerances live today — the drawing, the PIR, a controlled Excel? Who updates them when a revision changes?
4. **Sampling rule.** How many pieces get measured out of a lot — fixed N, %, AQL table, first/middle/last? Does it change by customer or part?
5. **Pass / fail / rework outcomes.** What happens on an out-of-tolerance reading: scrap, rework, concession, stop the lot? Is there a nonconformance (NC) number or report today?
6. **Instruments and traceability.** Do they record gauge/instrument ID, calibration, inspector name, date/time per sheet? Anything the customer audits?
7. **The physical/legal artifact.** Does the signed sheet have to be printed/PDF'd for the customer or ISO records? Do they need a specific layout back out of the system?
8. **Volume + friction.** How many sheets per day, filled on paper then typed in? Tablet on the floor? This decides whether we build fast keyboard entry or a simple form.

## Things to show her live (5 min max)

- Engineering drawer -> Step 4 as it stands, so she reacts to something concrete.
- The PO line context (customer, part number, PIR + rev, quantity) that we can auto-fill onto her sheet — that's the immediate time saver to sell.

## Ask her to leave with

- One blank master template of each form type they use (not just the two already sent).
- One completed real example, so we see the real handwriting/values and edge cases.
- The list of characteristic types they record (dimension, visual, functional, material cert, torque...).
- Who besides her needs a login and at what permission level (inspector = enter readings, QC lead = sign off).

## What we build after (do not commit dates on the call)

Generic model, driven by her answers:
- `qm_forms` (templates) -> `qm_characteristics` (rows: description, nominal, tol +/-, unit, type, instrument)
- `qm_part_specs` (which template + values apply to a part number / PIR revision)
- `qm_inspections` (a filled sheet: line, lot, sample size, inspector, stage: production self-check vs QC final)
- `qm_measurements` (one reading per characteristic per piece, auto-flagged out of tolerance)
- `quality` role separate from `engineer`; QC sign-off distinct from engineering sign-off
- Excel importer so a template can be loaded from her existing sheets rather than retyped
- PDF export of the completed sheet for customer/ISO records

## Technical notes

Current tables: `quality_matrix_templates`, `quality_matrix_items`, `po_line_quality_checks`, plus `quality_matrix_*` columns on `po_line_items`. The v2 model above is additive — the existing checklist can stay as a lightweight per-line gate while the measurement grid becomes the real QC record, or we migrate it out once her forms are loaded. Decide after the call.
