# Free navigation across engineering steps

Today a line only moves via "Complete step" or the "Jump to" dropdown, and the drawer always shows the line's current step. This adds free browsing plus an explicit way to commit a jump.

## What you get

1. **Step navigator in the drawer** — the 5 steps render as a clickable stepper at the top. Clicking any step shows that step's panel (PO Info, PIR, Body Spec, Components, Quality Matrix) without changing anything.
2. **Preview banner** — when the viewed step differs from the line's real step, a small bar appears: "Viewing PIR Verification — current step is PO Info", with two buttons: **Set as current step** and **Back to current**.
3. **Clickable step dots in the queue row** — clicking a dot opens the drawer already focused on that step (preview only).
4. **Prev / Next browse arrows** in the drawer footer, separate from "Complete step" so nothing is recorded while browsing.
5. **Committing a jump** uses the existing `setEngStep` server function, so the step clock restarts and the event is logged exactly as the current dropdown does. Gated to the Engineering role like every other mutation.

## Technical notes

- `src/components/fact/EngStepDrawer.tsx`: add `viewStep` state (defaults to `line.eng_step`, resets when the drawer opens or the line changes). Route panel rendering off `viewStep` instead of `currentKey`. Add the stepper header, preview banner, and prev/next controls. "Complete step" / "Back" keep acting on the line's real step.
- `src/routes/engineering.tsx`: `StepDots` gains an `onSelect(stepKey)` prop; the row passes one that sets `drawerLineId` and an initial `drawerStep`, forwarded to the drawer.
- No schema or server-function changes — `setEngStep` already exists and handles logging.
