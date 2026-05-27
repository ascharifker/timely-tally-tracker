// Pure OTD (On-Time Delivery) calculations. No AI.
import type { Job } from "../fact-types";

export interface OTDSummary {
  total: number;
  on_time: number;
  at_risk: number;
  late: number;
  otd_pct: number;
}

/**
 * A job is at risk when export_date > customer_date (would deliver late)
 * or when it's still upstream of EXPO and customer_date is within 5 days.
 */
export function classify(job: Job): "on_time" | "at_risk" | "late" {
  if (!job.customer_date) return "on_time";
  const customer = new Date(job.customer_date).getTime();
  const export_ = job.export_date ? new Date(job.export_date).getTime() : null;

  if (export_ !== null && export_ > customer) return "late";

  const now = Date.now();
  const daysToCustomer = (customer - now) / (1000 * 60 * 60 * 24);
  const isUpstream =
    job.status === "PLANNED" ||
    job.status === "MAZAK" ||
    job.status === "MAQUINADO_LISTO" ||
    job.status === "CEMENTACION";
  if (isUpstream && daysToCustomer < 5) return "at_risk";

  return "on_time";
}

export function summarize(jobs: Job[]): OTDSummary {
  const total = jobs.length;
  let on_time = 0,
    at_risk = 0,
    late = 0;
  for (const j of jobs) {
    const c = classify(j);
    if (c === "on_time") on_time++;
    else if (c === "at_risk") at_risk++;
    else late++;
  }
  const otd_pct = total === 0 ? 100 : Math.round((on_time / total) * 1000) / 10;
  return { total, on_time, at_risk, late, otd_pct };
}