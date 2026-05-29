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
import { nextActiveShiftBoundary, SHIFTS, shiftIndexFromHour } from "../shifts";

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
  machine: Pick<Machine, "hours_per_shift"> & Partial<Pick<Machine, "active_shifts">>,
): ScheduleSpan {
  const hps = Math.max(0.1, machine.hours_per_shift || 8);
  const active =
    machine.active_shifts && machine.active_shifts.length > 0
      ? machine.active_shifts
      : (["manana", "tarde", "noche"] as Array<"manana" | "tarde" | "noche">);

  const start = nextActiveShiftBoundary(new Date(fromMs), active);
  const startMs = start.getTime();

  // Walk shift-by-shift, skipping inactive ones (they consume wall-clock time
  // but no productive hours).
  let remaining = hoursNeeded;
  let shiftStartMs = startMs;
  let shiftsConsumed = 0;
  let endMs = startMs;

  // safety cap: 365 days of shifts
  for (let i = 0; i < 365 * 3 && remaining > 0; i++) {
    const idx = shiftIndexFromHour(new Date(shiftStartMs).getHours());
    const isActive = active.includes(SHIFTS[idx].key);
    if (isActive) {
      const work = Math.min(remaining, hps);
      const elapsedInShift = (work / hps) * SHIFT_MS;
      endMs = shiftStartMs + elapsedInShift;
      remaining -= work;
      shiftsConsumed += 1;
    }
    shiftStartMs += SHIFT_MS;
  }

  // Cursor = end of the last active shift consumed (machine free at next boundary).
  const cursorMs = shiftStartMs; // already advanced past last consumed shift

  return {
    planned_start: new Date(startMs).toISOString(),
    planned_end: new Date(endMs).toISOString(),
    cursorMs,
    shiftsConsumed: Math.max(1, shiftsConsumed),
  };
}