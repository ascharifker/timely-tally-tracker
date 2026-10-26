// Machine-time overlap guard: one ODT per machine per time window.
import type { Job } from "../fact-types";

export function findOverlap(
  jobs: Pick<Job, "id" | "odf" | "machine_id" | "planned_start" | "planned_end">[],
  machineId: string,
  startMs: number,
  endMs: number,
  excludeId?: string,
) {
  return (
    jobs.find((j) => {
      if (j.id === excludeId || j.machine_id !== machineId) return false;
      if (!j.planned_start || !j.planned_end) return false;
      const s = new Date(j.planned_start).getTime();
      const e = new Date(j.planned_end).getTime();
      return s < endMs && startMs < e;
    }) ?? null
  );
}
