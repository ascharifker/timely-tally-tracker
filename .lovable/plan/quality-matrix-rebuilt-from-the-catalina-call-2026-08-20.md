# Quality Matrix — rebuilt from the Catalina call

## What the call changed

The single biggest correction: **"matriz de calidad" is not an inspection checklist.** It is Catalina's **document / revision control matrix** — the list of part numbers (PIR) and the drawing revision she has documented in the system at Reynosa. What Alexis actually does in Step 4 is:

1. Take the part number off the PO.
2. Check it against Catalina's matrix — is this document on file, and at which revision?
3. If the PO brings a newer revision, he tells Catalina and she updates the record immediately.
4. If the document is not on file at Reynosa, Alexis supplies it from Dropbox; if he doesn't have it either, he requests it from the customer, and it gets catalogued once received.

Real QC inspection is a **separate world**, and Catalina explicitly asked to phase it:

- **Process inspection** — filled by *production* after a setup / at start-up, verifying run conditions. More generic across parts.
- **Product inspection** — filled by a *Mego QC inspector* (not Catalina, not a third party), 100% of pieces, at several points in the flow, using a **per-part form** she prints today and fills by hand.
- Her ask, verbatim in spirit: a digital form the inspector fills on a computer or iPad that attaches itself to the product record.
- She is sending a **flujograma** (receive PO -> inspection points -> which document at each point). Deep product-inspection design waits for that and for the October site visit.
- Her order of attack: **process first, then product** — tie down one stage before jumping to the next.

Also noted: she is worried about losing documents in Dropbox and has no Drive capacity. A backup/mirror of controlled documents is a real need for audits, not a nice-to-have.

## Phase 1 — Document Control Matrix (build now)

Replace the current generic pass/fail checklist in Step 4 with what Alexis actually does.

- New **Matriz de Documentos**: one row per part number (PIR) holding the controlled revision, document status, where the file lives, and who last updated it and when.
- Step 4 in the Engineering drawer becomes **Verificación de documento**. It looks up the line's PIR in the matrix and shows one of four states:
  - `Documentado` — on file and the revision matches the PO.
  - `Revisión nueva` — the PO revision is newer than the matrix; one click sends a request to Catalina to update.
  - `No documentado` — not on file. Alexis can attach the Dropbox plan he found (the Dropbox panel already exists) to close it.
  - `Solicitado al cliente` — nobody has it; one click records the request and its date.
- Every state change is logged with actor and timestamp, so the matrix carries its own audit trail.
- Catalina gets a **Calidad** view listing everything pending her action (new revisions to document, documents received to catalogue) and can mark a part as documented at revision X.
- Reuse the Dropbox integration: when the drawer finds a plan, its filename revision is compared against both the PO revision and the matrix revision, and any mismatch is shown explicitly.
- **Import**: load the matrix in bulk from the Excel she already maintains, so nothing gets retyped.

## Phase 2 — Process inspection forms (after Phase 1 lands)

Digital version of the production start-up / setup check, since it is the more generic of the two.

- A **form catalog**: reusable templates with sections and items (yes/no, value + tolerance, text, signature).
- A production user opens the ODT, fills the start-up check on a tablet, and it attaches to the job.
- Sign-off records who filled it and when; PDF export for the paper record and audits.

## Phase 3 — Product inspection (after the flujograma and the October visit)

Per-part inspection forms with characteristics, tolerances and per-piece readings, plus inspection points mapped onto the production flow. Deliberately not designed yet — waiting on the flujograma so the model mirrors her real inspection points instead of guessing from two sample sheets.

## Technical section

New tables for Phase 1:

```text
qc_document_matrix
  id, pir (unique), part_description,
  documented_rev,
  status: documented | new_rev_pending | not_documented | requested_from_customer,
  dropbox_path, dropbox_name, source: dropbox | customer | internal,
  requested_at, documented_at, documented_by, notes, created_at, updated_at

qc_document_events
  id, matrix_id, po_line_item_id (nullable), kind,
  from_status, to_status, from_rev, to_rev, actor, note, occurred_at
```

Both get GRANTs to `authenticated` and `service_role`, RLS enabled, read for authenticated users, writes restricted to `admin | manager | engineer | quality`.

New role: add `quality` to the `app_role` enum, label "Calidad", selectable in Settings > Users. Engineering can flag and attach; Calidad can mark documented and set the controlled revision.

Server functions in a new `src/lib/qc-matrix.functions.ts`: `getMatrixEntryForPir`, `upsertMatrixEntry`, `requestRevisionUpdate`, `markDocumented`, `markRequestedFromCustomer`, `listPendingQualityActions`, `importMatrixRows`.

UI:
- Rewrite `src/components/fact/QualityMatrixPanel.tsx` as the document-verification panel (status card, revision comparison, actions, event history).
- New `src/routes/calidad.tsx` — Catalina's pending-actions queue plus the full matrix table with PIR search and an Excel importer (SheetJS, same pattern as the maquinados import).
- Sidebar entry for Calidad, visible to the new role plus admin/manager.

Existing objects: `quality_matrix_templates`, `quality_matrix_items` and `po_line_quality_checks` stay in place, unused for now — they become the backbone of the Phase 2 form catalog rather than being dropped. The `quality_matrix_signed_off_*` columns on `po_line_items` are reused to record that Step 4 document verification passed.