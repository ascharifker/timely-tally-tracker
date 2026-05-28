// Hour-based scheduling engine aligned to production shifts.
//
// Each machine has `hours_per_shift` productive hours per 8h slot. Jobs always
// start at a shift boundary (06/14/22). A 10h job on a 7h/turno machine
// consumes shift 1 entirely (8h elapsed, 7h productive) + 3h of shift 2
// (proportional → 3/7 of the 8h slot).
//
// Visual end timestamp is computed so the bar lands inside the right shift
// band; downstream cursors continue from the end of the last shift the job
// actually occupied (machine isn't free again until that whole shift ends).

import type { Machine } from "../fact-types";
import { nextShiftBoundary } from "../shifts";

const SHIFT_MS = 8 * 60 * 60 * 1000;

export interface ScheduleSpan {
  planned_start: string;
  planned_end: string;
  /** First ms the machine is free again — use this as the next job's cursor. */
  cursorMs: number;
  shiftsConsumed: number;
}

/**
 * Place `hoursNeeded` of productive work on `machine` starting at `fromMs`
 * (snapped to next shift boundary).
 */
export function scheduleJob(
  fromMs: number,
  hoursNeeded: number,
  machine: Pick<Machine, "hours_per_shift">,
): ScheduleSpan {
  const hps = Math.max(0.1, machine.hours_per_shift || 8);
  const start = nextShiftBoundary(new Date(fromMs));
  const startMs = start.getTime();

  // How many full shifts + remainder hours within the next shift.
  const fullShifts = Math.floor(hoursNeeded / hps);
  const remainder = hoursNeeded - fullShifts * hps; // 0..<hps

  // Proportional ms inside the next shift for the remainder.
  const remainderMs = (remainder / hps) * SHIFT_MS;
  const totalElapsedMs = fullShifts * SHIFT_MS + remainderMs;

  const endMs = startMs + totalElapsedMs;

  // Machine free at end of the shift the job last touched (ceil to next boundary).
  const shiftsConsumed = remainder > 0 ? fullShifts + 1 : fullShifts;
  const cursorMs = startMs + shiftsConsumed * SHIFT_MS;

  return {
    planned_start: new Date(startMs).toISOString(),
    planned_end: new Date(endMs).toISOString(),
    cursorMs,
    shiftsConsumed: Math.max(1, shiftsConsumed),
  };
}