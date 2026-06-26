In the Gantt chart job cards, replace the tube spec label under the ODT number with the PIR number.

Files to change:
- `src/components/fact/MachineGantt.tsx`
  - Scheduled bars: swap `j.tube_spec` → `j.pir` on the second line of the card (lines ~798-801).
  - Unscheduled drawer: swap `j.tube_spec` → `j.pir` in the chip list (line ~914).