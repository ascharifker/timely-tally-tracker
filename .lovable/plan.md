## Make the "Pipeline de Estado" board drag-and-drop

Replace the current "→ Next stage" text-link buttons on each ODF card with native HTML5 drag-and-drop, so users grab a card and drop it into any column to change its status.

### Behavior
- Grab any ODF card (cursor changes to `grab`/`grabbing`) and drag it onto any of the 6 columns (PLANNED → YA_SE_ENVIO).
- Drop target column highlights while hovering (ring + subtle bg tint using existing status color tokens).
- On drop, fire the existing `useUpdateJobStatus` mutation — same code path as today, just triggered by drop instead of click.
- Dropping on the card's own column is a no-op.
- Optimistic update so the card jumps columns instantly (add `onMutate` to `useUpdateJobStatus`, same pattern already used by `useLogDelay`).
- Toast on success ("ODF 347 → Cementación"), rollback + error toast on failure.

### Files touched
- `src/components/fact/StatusBoard.tsx` — add `draggable`, `onDragStart`, `onDragOver`, `onDragLeave`, `onDrop` handlers; remove the two "→ Next stage" buttons; local `dragOverStatus` state for highlight.
- `src/hooks/useFactData.ts` — add optimistic `onMutate` / `onError` / `onSettled` to `useUpdateJobStatus` (mirrors `useLogDelay` shape).

### Out of scope
- Reordering cards inside a column (status pipeline has no within-column order today).
- Touch/mobile drag (HTML5 DnD is desktop-only; viewport is 1334px, fine for now).
- Keyboard a11y for drag (can add later with `@dnd-kit` if needed — sticking with native DnD keeps it zero-dep).
- Cascade/reschedule on status change (status moves are independent of `planned_*` dates).
