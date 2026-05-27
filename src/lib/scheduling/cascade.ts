// Pure, deterministic cascade recalc engine.
// NO AI / NO ML — given a delay, returns the new planned_start/end for downstream jobs
// on the same machine, preserving their original order.

import type { Job } from "../fact-types";

export interface CascadeInput {
  jobs: Job[];
  delayedJobId: string;
  /** Hours to push the delayed job's planned_end by. Positive = delay, negative = pull-in. */
  delayHours: number;
}

export interface CascadeChange {
  job_id: string;
  odf: string;
  old_start: string | null;
  old_end: string | null;
  new_start: string;
  new_end: string;
  shifted_hours: number;
}

const HOUR_MS = 60 * 60 * 1000;

/**
 * Recompute downstream planned_start / planned_end on the same machine.
 * Strategy: any job on the same machine whose planned_start is >= the delayed
 * job's original planned_end gets pushed by delayHours, preserving relative gaps.
 */
export function cascade(input: CascadeInput): CascadeChange[] {
  const { jobs, delayedJobId, delayHours } = input;
  const anchor = jobs.find((j) => j.id === delayedJobId);
  if (!anchor || !anchor.machine_id || !anchor.planned_end) return [];

  const anchorEndMs = new Date(anchor.planned_end).getTime();
  const sameMachine = jobs
    .filter(
      (j) =>
        j.machine_id === anchor.machine_id &&
        j.id !== anchor.id &&
        j.planned_start &&
        j.planned_end &&
        new Date(j.planned_start).getTime() >= anchorEndMs,
    )
    .sort(
      (a, b) =>
        new Date(a.planned_start as string).getTime() -
        new Date(b.planned_start as string).getTime(),
    );

  const shiftMs = delayHours * HOUR_MS;
  const changes: CascadeChange[] = [];

  // Include the anchor itself first.
  changes.push({
    job_id: anchor.id,
    odf: anchor.odf,
    old_start: anchor.planned_start,
    old_end: anchor.planned_end,
    new_start: anchor.planned_start
      ? new Date(new Date(anchor.planned_start).getTime() + shiftMs).toISOString()
      : new Date(anchorEndMs).toISOString(),
    new_end: new Date(anchorEndMs + shiftMs).toISOString(),
    shifted_hours: delayHours,
  });

  for (const j of sameMachine) {
    const startMs = new Date(j.planned_start as string).getTime();
    const endMs = new Date(j.planned_end as string).getTime();
    changes.push({
      job_id: j.id,
      odf: j.odf,
      old_start: j.planned_start,
      old_end: j.planned_end,
      new_start: new Date(startMs + shiftMs).toISOString(),
      new_end: new Date(endMs + shiftMs).toISOString(),
      shifted_hours: delayHours,
    });
  }

  return changes;
}