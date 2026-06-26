## Goal
When a kanban card is moved to **Ya se envió**, prompt for a **Fecha de envío** (export date), persist it on the job, and show it in the job detail dialog.

## Changes

### 1. Storage
- Reuse existing `jobs.export_date` if present; otherwise add a `shipped_date date` column to `jobs` via migration. (Will confirm by reading schema during build.)

### 2. StatusBoard drop handler (`src/components/fact/StatusBoard.tsx`)
- Intercept drops onto the `YA_SE_ENVIO` column. Instead of calling `update.mutate` immediately, open a new `ShippedDateDialog` with the job pre-loaded.
- Same interception for status changes triggered elsewhere (e.g., `JobDetailDialog` status selector) — add the prompt there too.

### 3. New `ShippedDateDialog` (`src/components/fact/ShippedDateDialog.tsx`)
- Shadcn Dialog + Calendar (with `pointer-events-auto`) + date input.
- Default value = today.
- On confirm: update job with `{ status: 'YA_SE_ENVIO', shipped_date }` via `useUpdateJobStatus` (extend hook to accept extra fields) or a new `useShipJob` mutation.
- Cancel = no status change.

### 4. Job detail display (`src/components/fact/JobDetailDialog.tsx`)
- Add a read-only "Fecha de envío" row that appears when `shipped_date` is set.
- Allow admin/manager to edit it inline (date picker) for corrections.

### 5. Types (`src/lib/fact-types.ts`)
- Add `shipped_date?: string | null` to the `Job` type.

## Out of scope
- Reporting/exports based on shipped_date (can come later).
- Backfilling historical jobs.
