import type { JobStep } from "@/hooks/useActiveJobs";
import type { ActiveJob } from "@/hooks/useActiveJobs";

export type OtdScore = "on_time" | "late" | "early" | "unknown";

export interface OdfOtd {
  score: OtdScore;
  shipped_at: string | null;
  customer_date: string | null;
  days_diff: number | null; // negative = early, positive = late
  planned_hours: number | null;
  actual_hours: number | null;
  within_estimate: boolean | null; // actual <= planned * 1.1
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MS_PER_HOUR = 1000 * 60 * 60;

export function computeOdfOtd(job: ActiveJob): OdfOtd {
  const steps = job.steps ?? [];
  const lastDone = [...steps]
    .filter((s) => s.completed_at)
    .sort((a, b) => (a.completed_at! < b.completed_at! ? 1 : -1))[0];
  const shipped_at = lastDone?.completed_at ?? null;

  const customer_date = job.customer_date ?? null;

  let score: OtdScore = "unknown";
  let days_diff: number | null = null;
  if (shipped_at && customer_date) {
    // Compare at day granularity
    const ship = new Date(shipped_at);
    const cust = new Date(customer_date + "T23:59:59Z");
    days_diff = Math.round((ship.getTime() - cust.getTime()) / MS_PER_DAY);
    if (days_diff > 0) score = "late";
    else if (days_diff < -2) score = "early";
    else score = "on_time";
  }

  const firstStart = steps
    .map((s) => s.started_at)
    .filter((x): x is string => !!x)
    .sort()[0];
  const actual_hours =
    firstStart && shipped_at
      ? Math.round(((new Date(shipped_at).getTime() - new Date(firstStart).getTime()) / MS_PER_HOUR) * 10) / 10
      : null;

  const planned_hours =
    job.planned_start && job.planned_end
      ? Math.round(((new Date(job.planned_end).getTime() - new Date(job.planned_start).getTime()) / MS_PER_HOUR) * 10) / 10
      : null;

  const within_estimate =
    planned_hours !== null && actual_hours !== null ? actual_hours <= planned_hours * 1.1 : null;

  return { score, shipped_at, customer_date, days_diff, planned_hours, actual_hours, within_estimate };
}

export function stepDurationHours(step: JobStep): number | null {
  if (!step.started_at || !step.completed_at) return null;
  return (
    Math.round(
      ((new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / MS_PER_HOUR) * 10,
    ) / 10
  );
}

export const OTD_TONE: Record<OtdScore, { label: string; color: string; bg: string }> = {
  on_time: { label: "A tiempo", color: "var(--status-ok)", bg: "color-mix(in oklab, var(--status-ok) 15%, transparent)" },
  early: { label: "Adelantado", color: "var(--status-expo)", bg: "color-mix(in oklab, var(--status-expo) 15%, transparent)" },
  late: { label: "Tarde", color: "var(--status-risk)", bg: "color-mix(in oklab, var(--status-risk) 15%, transparent)" },
  unknown: { label: "Sin fecha", color: "var(--muted-foreground)", bg: "color-mix(in oklab, var(--muted-foreground) 15%, transparent)" },
};