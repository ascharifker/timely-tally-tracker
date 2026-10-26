import type { Job } from "../fact-types";

export type ScheduledJob = Pick<Job, "id" | "odf" | "machine_id" | "planned_start" | "planned_end">;

export interface InsertionMove {
  jobId: string;
  odf: string;
  machine_id: string;
  planned_start: string;
  planned_end: string;
}

/** Insert at the requested time; push only the collision chain on the destination machine.
 * Existing elapsed durations and relative order are preserved. Gaps absorb delays.
 */
export function planInsertion(
  jobs: ScheduledJob[],
  jobId: string,
  machineId: string,
  startMs: number,
  endMs: number,
): InsertionMove[] {
  const anchor = jobs.find((job) => job.id === jobId);
  if (!anchor || !machineId || !Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    throw new Error("Horario de producción inválido");
  }
  const moves: InsertionMove[] = [{
    jobId, odf: anchor.odf, machine_id: machineId,
    planned_start: new Date(startMs).toISOString(),
    planned_end: new Date(endMs).toISOString(),
  }];
  const queue = jobs.flatMap((job) => {
    if (job.id === jobId || job.machine_id !== machineId || !job.planned_start || !job.planned_end) return [];
    const start = new Date(job.planned_start).getTime();
    const end = new Date(job.planned_end).getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || end <= startMs) return [];
    return [{ job, start, end }];
  }).sort((a, b) => a.start - b.start || a.job.id.localeCompare(b.job.id));

  let cursor = endMs;
  for (const { job, start, end } of queue) {
    if (start >= cursor) break;
    const nextEnd = cursor + end - start;
    moves.push({
      jobId: job.id, odf: job.odf, machine_id: machineId,
      planned_start: new Date(cursor).toISOString(),
      planned_end: new Date(nextEnd).toISOString(),
    });
    cursor = nextEnd;
  }
  return moves;
}

/** Validate explicit approval positions, including jobs not in the current viewport. */
export function assertNoMoveOverlaps(jobs: ScheduledJob[], moves: InsertionMove[]): void {
  const byId = new Map(moves.map((move) => [move.jobId, move]));
  const effective = jobs.map((job) => {
    const move = byId.get(job.id);
    return move ? { ...job, ...move } : job;
  });
  for (const move of moves) {
    const start = new Date(move.planned_start).getTime();
    const end = new Date(move.planned_end).getTime();
    if (!move.machine_id || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) throw new Error("Horario de producción inválido");
    const clash = effective.find((job) => job.id !== move.jobId && job.machine_id === move.machine_id &&
      job.planned_start && job.planned_end && new Date(job.planned_start).getTime() < end &&
      start < new Date(job.planned_end).getTime());
    if (clash) throw new Error(`El movimiento se superpone con ODT ${clash.odf}. Revisá la reprogramación.`);
  }
}