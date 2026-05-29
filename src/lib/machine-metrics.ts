// Pure metric calculations over machine_runs + jobs + part_times.
// Real data only — keeps "measured" separate from "override" everywhere.

import type { Job, Machine, MachineRun, PartTime, Vendor } from "./fact-types";

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

export function runDurationHours(run: MachineRun, now = Date.now()): number {
  const start = new Date(run.started_at).getTime();
  const end = run.ended_at ? new Date(run.ended_at).getTime() : now;
  return Math.max(0, (end - start) / HOUR_MS);
}

export function totalRealHours(runs: MachineRun[]): number {
  return runs.reduce((a, r) => a + runDurationHours(r), 0);
}

/** Real h/pieza per PIR for one machine (only closed runs with pieces > 0). */
export interface PirRealStat {
  pir: string;
  runs: number;
  pieces: number;
  hours: number;
  hoursPerPieceAvg: number;
  stdDev: number;
}

export function realHoursPerPiece(
  runs: MachineRun[],
  jobs: Job[],
): PirRealStat[] {
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const byPir = new Map<string, { hpp: number[]; pieces: number; hours: number }>();
  for (const r of runs) {
    if (!r.ended_at || r.pieces_completed <= 0) continue;
    const job = jobById.get(r.job_id);
    if (!job?.pir) continue;
    const hrs = runDurationHours(r);
    const hpp = hrs / r.pieces_completed;
    const entry = byPir.get(job.pir) ?? { hpp: [], pieces: 0, hours: 0 };
    entry.hpp.push(hpp);
    entry.pieces += r.pieces_completed;
    entry.hours += hrs;
    byPir.set(job.pir, entry);
  }
  return [...byPir.entries()].map(([pir, e]) => {
    const avg = e.hpp.reduce((a, x) => a + x, 0) / e.hpp.length;
    const variance =
      e.hpp.reduce((a, x) => a + (x - avg) ** 2, 0) / e.hpp.length;
    return {
      pir,
      runs: e.hpp.length,
      pieces: e.pieces,
      hours: e.hours,
      hoursPerPieceAvg: avg,
      stdDev: Math.sqrt(variance),
    };
  });
}

/** Deviation real vs catalog: positive % means slower than catalog. */
export interface DeviationRow extends PirRealStat {
  catalogHpp: number | null;
  deviationPct: number | null;
}

export function catalogDeviation(
  runs: MachineRun[],
  jobs: Job[],
  partTimes: PartTime[],
  machineId: string,
): DeviationRow[] {
  const stats = realHoursPerPiece(runs, jobs);
  return stats.map((s) => {
    const pt = partTimes.find(
      (p) => p.pir === s.pir && p.machine_id === machineId,
    );
    const catalog = pt?.hours_per_piece ?? null;
    const deviationPct =
      catalog && catalog > 0
        ? ((s.hoursPerPieceAvg - catalog) / catalog) * 100
        : null;
    return { ...s, catalogHpp: catalog, deviationPct };
  });
}

/** Utilization = real hours run / available hours in window. */
export function utilization(
  runs: MachineRun[],
  machine: Machine,
  windowDays = 7,
  now = Date.now(),
): { realHours: number; availableHours: number; pct: number } {
  const since = now - windowDays * DAY_MS;
  const inWindow = runs.filter((r) => {
    const start = new Date(r.started_at).getTime();
    const end = r.ended_at ? new Date(r.ended_at).getTime() : now;
    return end >= since;
  });
  let realHours = 0;
  for (const r of inWindow) {
    const start = Math.max(new Date(r.started_at).getTime(), since);
    const end = r.ended_at ? new Date(r.ended_at).getTime() : now;
    realHours += Math.max(0, (end - start) / HOUR_MS);
  }
  const shiftsPerDay = (machine.active_shifts ?? []).length || 3;
  const availableHours = windowDays * shiftsPerDay * (machine.hours_per_shift ?? 8);
  return {
    realHours,
    availableHours,
    pct: availableHours > 0 ? (realHours / availableHours) * 100 : 0,
  };
}

export function monthlyCost(
  runs: MachineRun[],
  rate: number,
  now = Date.now(),
): { hours: number; cost: number } {
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const since = monthStart.getTime();
  let hours = 0;
  for (const r of runs) {
    const start = Math.max(new Date(r.started_at).getTime(), since);
    const end = r.ended_at ? new Date(r.ended_at).getTime() : now;
    if (end <= since) continue;
    hours += Math.max(0, (end - start) / HOUR_MS);
  }
  return { hours, cost: hours * (rate ?? 0) };
}

export function openRuns(runs: MachineRun[]): MachineRun[] {
  return runs.filter((r) => r.ended_at === null);
}

/** Lead time real for vendor jobs = avg(ended_at − started_at) per completed ODF. */
export function vendorLeadTimeAvgDays(
  runs: MachineRun[],
  jobs: Job[],
): number | null {
  const jobById = new Map(jobs.map((j) => [j.id, j]));
  const byJob = new Map<string, MachineRun[]>();
  for (const r of runs) {
    if (!jobById.has(r.job_id)) continue;
    const arr = byJob.get(r.job_id) ?? [];
    arr.push(r);
    byJob.set(r.job_id, arr);
  }
  const spans: number[] = [];
  for (const [, arr] of byJob) {
    const closed = arr.every((r) => r.ended_at);
    if (!closed) continue;
    const starts = arr.map((r) => new Date(r.started_at).getTime());
    const ends = arr.map((r) => new Date(r.ended_at!).getTime());
    const span = (Math.max(...ends) - Math.min(...starts)) / DAY_MS;
    spans.push(span);
  }
  if (spans.length === 0) return null;
  return spans.reduce((a, x) => a + x, 0) / spans.length;
}

/** Quick comparator for vendor cost vs equivalent in-house cost on same job set. */
export function vendorVsInhouse(
  vendorRuns: MachineRun[],
  vendor: Vendor,
  internalAvgHourlyCost: number,
): { vendorCost: number; equivalentInhouseCost: number; diff: number } {
  const hours = totalRealHours(vendorRuns);
  const vendorCost = hours * (vendor.hourly_rate ?? 0);
  const equivalentInhouseCost = hours * internalAvgHourlyCost;
  return {
    vendorCost,
    equivalentInhouseCost,
    diff: vendorCost - equivalentInhouseCost,
  };
}