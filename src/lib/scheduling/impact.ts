// Downstream impact graph traversal — no AI.
import type { Job } from "../fact-types";

export interface ImpactedJob {
  job: Job;
  delay_hours: number;
}

/**
 * Given a delayed anchor job, return the downstream jobs on the same machine
 * that will be pushed (in time order), each carrying the same delay_hours.
 */
export function downstreamImpact(
  jobs: Job[],
  anchorId: string,
  delayHours: number,
): ImpactedJob[] {
  const anchor = jobs.find((j) => j.id === anchorId);
  if (!anchor || !anchor.machine_id || !anchor.planned_end) return [];
  const anchorEnd = new Date(anchor.planned_end).getTime();
  return jobs
    .filter(
      (j) =>
        j.id !== anchor.id &&
        j.machine_id === anchor.machine_id &&
        j.planned_start &&
        new Date(j.planned_start).getTime() >= anchorEnd,
    )
    .sort(
      (a, b) =>
        new Date(a.planned_start as string).getTime() -
        new Date(b.planned_start as string).getTime(),
    )
    .map((job) => ({ job, delay_hours: delayHours }));
}