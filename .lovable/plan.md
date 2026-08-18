# Quality Matrix v2 — real inspection checklists from Catalina

Catalina's two files are not a "matrix" of criteria — they are **dimensional inspection sheets**: rows of characteristics with a spec/tolerance, and a column per physical piece where the inspector writes the measured value. So we rebuild the Quality Matrix module around that reality.

## What the two files actually are

| File | Who fills it | Shape |
| --- | --- | --- |
| `101572594_REV_C...` | Filled per part number | Part-specific sheet: header (PIR 101572594, Rev C, No. Dibujo D01618219 Rev A, ODF 429/26, ODT 1088/26, machine no., start/end datetime), then **LADO BOX** (~19 characteristics) and **LADO PIN** (~18 characteristics), each with a concrete dimension e.g. `11.750 +/-.118`, plus columns `PZA #` for each inspected piece, operator signature and measuring-instrument NCM list |
| `MA-QA-F19U Rev. C` | Controlled blank form | Same structure but generic: header fields (No. Parte, Rev, No. Plano, No. Dibujo, ODF, ODT, Grado, Libraje, Colada/HT), sections **CAJA** and **PIN**, characteristics with blank spec column, up to 7 `PZA #` columns, functional gauge test Pasa/No Pasa, grooves/anchors with sub-readings (1)(2)(3) |

Conclusion: one **form template** (versioned, e.g. `MA-QA-F19U Rev C`) defines the characteristic rows. A **part spec** fills in the tolerances for a given PIR + revision. An **inspection record** captures measured values per piece for a given ODT / PO line.

## Data model

```text
qm_forms                     -- controlled forms
  id, code ('MA-QA-F19U'), name, revision ('C'),
  filled_by ('quality' | 'production'), is_active

qm_characteristics           -- rows of a form
  id, form_id, section ('CAJA'|'BOX'|'PIN'|'TRAZABILIDAD'),
  label_es, label_en, default_spec, value_kind
  ('measurement'|'pass_fail'|'text'|'ok'), sub_readings int default 1,
  sort_order, is_active

qm_part_specs                -- tolerances for a specific part
  id, pir, pir_rev, characteristic_id, spec_text, unique(pir,pir_rev,characteristic_id)

qm_inspections               -- one per PO line + form
  id, po_line_item_id, job_id (nullable), form_id,
  machine_no, heat_number, drawing_no, drawing_rev, grade, weight_ppf,
  started_at, finished_at, instruments_ncm text,
  signed_off_by, signed_off_at, notes, status ('draft'|'signed')

qm_measurements
  id, inspection_id, characteristic_id, piece_label ('PZA 1'...),
  reading_index (for the (1)(2)(3) sub-readings),
  value_text, result ('pass'|'fail'|'n_a'), recorded_by, recorded_at
  unique(inspection_id, characteristic_id, piece_label, reading_index)
```

All tables get GRANTs, RLS enabled, and policies: read for authenticated, write for `admin`, `manager`, `engineer`, plus the new `quality` role and `production_editor` on production-type forms.

The old `quality_matrix_templates` / `quality_matrix_items` / `po_line_quality_checks` tables and the generic starter checklist are dropped — they were placeholders and hold no real data.

## New `quality` role

Add `quality` to the `app_role` enum so Catalina's inspectors sign the QA form, while `production_editor` signs the production form. Engineering/admin/manager keep full access.

## Excel importers

Two admin importers (SheetJS, same pattern as the MAQUINADOS import):

1. **Import form template** — upload `MA-QA-F19U Rev. C.xlsx`, parse the CAJA/PIN blocks into `qm_forms` + `qm_characteristics`, show a preview grid before committing.
2. **Import part spec** — upload a part sheet like `101572594_REV_C...xlsx`, match rows to characteristics of the selected form (fuzzy label match with a manual remap dropdown for unmatched rows), and write `qm_part_specs` for that PIR + revision.

Both live under Settings, and the part-spec importer is also reachable from the engineering drawer so Alexis can load a spec while reviewing a line.

## UI — rewritten `QualityMatrixPanel`

Inside the engineering drawer's `matrix_check` step:

- **Header card**: PIR + rev (prefilled from the line), drawing no./rev, ODF/ODT, grade, libraje, colada (HT), machine no., start/end datetime.
- **Form tabs**: one tab per applicable form (Calidad / Producción).
- **Inspection grid**: rows = characteristics grouped by CAJA/BOX and PIN, first columns = characteristic + spec (from `qm_part_specs`, falling back to the form default), then one editable column per piece. Add/remove piece columns. Pass/fail rows render as a Pasa / No Pasa toggle; grooves/anchor rows expose the (1)(2)(3) sub-inputs.
- **Out-of-tolerance flagging**: where the spec parses as `nominal +/- tol` or a `MIN`/`MAX` bound, an entered value outside range is highlighted red and counted in a failures badge. Unparseable specs stay free-text.
- **Attachments**: keep the existing reference-document upload (signed URL viewer) for scanned originals.
- **Footer**: instruments NCM text, notes, and **Firmar inspección** with role gating and the signer name + timestamp shown once signed.
- Non-authorized users see the whole grid read-only.

## Export

Extend `ExportLinesDialog` and add a per-inspection export that reproduces the sheet layout (characteristics down, pieces across) as CSV, so the record can be printed or archived like today's Excel.

## Seeding

Seed `qm_forms` + `qm_characteristics` directly from the two uploaded files as part of the migration, so the module is usable immediately without running the importer:
- `MA-QA-F19U Rev C` — quality form, CAJA + PIN characteristics.
- Production equipment checklist — production form, LADO BOX + LADO PIN characteristics.
Also seed `qm_part_specs` for PIR `101572594` Rev `C` with the tolerances from that file, so there is a fully worked example to demo.

## Acceptance criteria

- Opening a line in `matrix_check` shows the CAJA/PIN grid with the correct tolerances for its PIR + rev.
- An inspector can add pieces, type measurements, see out-of-tolerance values flagged, and sign the inspection.
- A second, production-filled form is available on its own tab with its own sign-off.
- Uploading a new part sheet creates the specs for that PIR + revision without touching other parts.
- Existing engineering funnel steps and navigation are unchanged.

## Out of scope

- Auto-reading tolerances from design plans / Dropbox.
- Statistical analysis (Cp/Cpk) over measurements — the data model supports it later.
- Printing to the exact Excel visual layout (CSV export only for now).
