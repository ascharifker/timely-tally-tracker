# Quality Matrix implementation for Engineering funnel

## Goal
Replace the placeholder "Quality Matrix Check" step in the Engineering verification funnel with a working module that lets Engineering/QC attach a reference document and complete a digital checklist before signing the line off to production.

## What we will build

1. Reference document upload
   - Each PO line can have one Quality Matrix reference file (Excel/PDF) uploaded in the `matrix_check` step.
   - Stored in the existing `po-documents` Supabase Storage bucket under `quality-matrix/{po_line_item_id}/`.
   - Download/replace controls in the drawer.

2. Digital checklist
   - A configurable `quality_matrix_templates` table holds reusable checklists.
   - `quality_matrix_items` defines each check: category, label, description, sort order.
   - Per line, `po_line_quality_checks` records the result (pass / fail / n/a), notes, checked by, and checked at.
   - The drawer renders the checklist grouped by category.

3. Sign-off
   - A reviewer with the Engineering role (or admin/manager) can sign off the matrix.
   - Sign-off stores `quality_matrix_signed_off_by`, `quality_matrix_signed_off_at`, and `quality_matrix_notes` on `po_line_items`.
   - Because you chose "reviewer sign-off" (not a hard gate), the "Complete step" button remains enabled; the drawer warns if any item is failed or unchecked but does not block advancement.

## Database changes

```text
quality_matrix_templates
  id uuid pk
  name text not null
  version text
  is_default boolean default false
  created_by uuid -> auth.users(id)
  created_at timestamptz default now()

quality_matrix_items
  id uuid pk
  template_id uuid -> quality_matrix_templates(id) on delete cascade
  category text
  label text not null
  description text
  sort_order int default 0
  is_active boolean default true

po_line_quality_checks
  id uuid pk
  po_line_item_id uuid -> po_line_items(id) on delete cascade
  item_id uuid -> quality_matrix_items(id) on delete cascade
  status text check in ('pass','fail','n_a')
  notes text
  checked_by uuid -> auth.users(id)
  checked_at timestamptz default now()
  unique(po_line_item_id, item_id)

po_line_items (add columns)
  quality_matrix_document_url text
  quality_matrix_signed_off_by uuid -> auth.users(id)
  quality_matrix_signed_off_at timestamptz
  quality_matrix_notes text
```

All new tables get GRANTs, RLS enabled, and policies scoped to authenticated users. Admins/managers/engineers get full access; other authenticated users get read-only access to templates/items and their own line checks.

## Backend changes

New server functions in `src/lib/quality-matrix.functions.ts`:
- `getQualityMatrixTemplate()` — returns the default template with items.
- `saveQualityMatrixCheck({ poLineItemId, itemId, status, notes })` — upserts a check result.
- `signOffQualityMatrix({ poLineItemId, notes })` — records sign-off.
- `attachQualityMatrixDocument({ poLineItemId, storagePath })` — stores the document URL on the line.

Update `src/lib/po-workflow.functions.ts`:
- Allow `advanceEngStep` to proceed from `matrix_check` even if the matrix is not fully passed (reviewer sign-off mode).

## UI changes

- Replace `MatrixPanel` in `src/components/fact/EngStepDrawer.tsx`.
- New panel sections:
  1. Reference document — upload/replace/download.
  2. Checklist — grouped by category, each item has Pass/Fail/N/A toggles and a notes input.
  3. Sign-off — notes textarea + "Sign off matrix" button; shows signed-off state if already done.
- Add a read-only warning for users without the Engineering role.

## Seed data

Create one default template called "General Quality Matrix" with a starter checklist (e.g., Dimensional inspection, Thread inspection, Surface finish, Material certification, Heat treatment certification). You can edit this list later once Catalina shares the real matrix.

## Acceptance criteria

- Engineering can open a line in `matrix_check`, upload a reference document, fill the checklist, and sign off.
- Non-engineers see the checklist read-only.
- Advancing from `matrix_check` to `ready_for_production` works after sign-off; an optional warning appears if items are unchecked or failed.
- The existing Engineering funnel steps (po_info, pir_verify, body_spec, components) remain unchanged.

## Out of scope

- Auto-extracting checklist items from Catalina's Excel/PDF. We will seed a starter template; importing her file into the digital checklist can be a follow-up.
- Email notifications on matrix completion.
