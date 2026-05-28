// Compute a job's real machining duration in hours.
// Priority: explicit override → catalog entry (PIR × machine) × qty → heuristic fallback.

import type { Job, PartTime } from "../fact-types";

export interface DurationResult {
  hours: number;
  source: "override" | "catalog" | "heuristic";
  hoursPerPiece?: number;
}

/** Heuristic used when there's no catalog entry — keeps legacy behaviour visible. */
function heuristicHours(job: Pick<Job, "priority" | "qty">): number {
  const baseShifts = { urgent: 1, high: 1, normal: 2, low: 3 }[job.priority] ?? 2;
  const qtyBoost = job.qty >= 10 ? 1 : 0;
  return Math.min(4, baseShifts + qtyBoost) * 8;
}

export function jobDurationHours(
  job: Pick<Job, "priority" | "qty" | "pir" | "machine_id" | "hours_override">,
  partTimes: PartTime[],
): DurationResult {
  if (job.hours_override && job.hours_override > 0) {
    return { hours: job.hours_override, source: "override" };
  }
  if (job.pir && job.machine_id) {
    const entry = partTimes.find(
      (p) => p.pir === job.pir && p.machine_id === job.machine_id,
    );
    if (entry && entry.hours_per_piece > 0) {
      return {
        hours: entry.hours_per_piece * Math.max(1, job.qty),
        source: "catalog",
        hoursPerPiece: entry.hours_per_piece,
      };
    }
  }
  return { hours: heuristicHours(job), source: "heuristic" };
}