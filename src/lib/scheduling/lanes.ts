// Greedy lane packing so overlapping jobs on the same machine stack vertically
// instead of drawing on top of each other.

import type { Job } from "../fact-types";

export interface LaneAssignment {
  laneByJob: Map<string, number>;
  laneCount: number;
}

/** Pack jobs into the minimum number of horizontal lanes that avoid overlap. */
export function packLanes(jobs: Job[]): LaneAssignment {
  const sorted = jobs
    .filter((j) => j.planned_start && j.planned_end)
    .slice()
    .sort(
      (a, b) =>
        new Date(a.planned_start as string).getTime() -
        new Date(b.planned_start as string).getTime(),
    );

  const laneEnds: number[] = []; // last planned_end ms per lane
  const laneByJob = new Map<string, number>();

  for (const j of sorted) {
    const s = new Date(j.planned_start as string).getTime();
    const e = new Date(j.planned_end as string).getTime();
    let lane = laneEnds.findIndex((end) => end <= s);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(e);
    } else {
      laneEnds[lane] = e;
    }
    laneByJob.set(j.id, lane);
  }

  return { laneByJob, laneCount: Math.max(1, laneEnds.length) };
}

/** Lane assignments + lane counts grouped by machine id. */
export function packLanesByMachine(jobs: Job[]): {
  byMachine: Map<string, LaneAssignment>;
  laneByJob: Map<string, number>;
} {
  const groups = new Map<string, Job[]>();
  for (const j of jobs) {
    if (!j.machine_id || !j.planned_start || !j.planned_end) continue;
    const arr = groups.get(j.machine_id) ?? [];
    arr.push(j);
    groups.set(j.machine_id, arr);
  }
  const byMachine = new Map<string, LaneAssignment>();
  const laneByJob = new Map<string, number>();
  for (const [mid, arr] of groups) {
    const a = packLanes(arr);
    byMachine.set(mid, a);
    for (const [jid, lane] of a.laneByJob) laneByJob.set(jid, lane);
  }
  return { byMachine, laneByJob };
}