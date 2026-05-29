import type { Job, JobStatus } from "./fact-types";

export type UrgencyKind = "urgent" | "overdue" | "due_soon" | null;

export interface Urgency {
  kind: Exclude<UrgencyKind, null>;
  label: string;
  days: number;
}

const TERMINAL: JobStatus[] = ["YA_SE_ENVIO"];

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / 86400000);
}

/**
 * Returns the most relevant urgency badge for a job. Overdue beats due-soon
 * beats explicit urgent priority. Returns null when nothing notable.
 */
export function getUrgency(job: Pick<Job, "customer_date" | "priority" | "status">): Urgency | null {
  const days = daysUntil(job.customer_date ?? null);
  const terminal = TERMINAL.includes(job.status);

  if (days !== null && days < 0 && !terminal) {
    return { kind: "overdue", label: `ATRASO ${Math.abs(days)}d`, days };
  }
  if (days !== null && days <= 3 && days >= 0 && !terminal) {
    return { kind: "due_soon", label: days === 0 ? "VENCE HOY" : `VENCE ${days}d`, days };
  }
  if (job.priority === "urgent") {
    return { kind: "urgent", label: "URG", days: days ?? 0 };
  }
  return null;
}

export function urgencyColor(kind: Urgency["kind"]): string {
  switch (kind) {
    case "overdue":
      return "var(--status-risk)";
    case "due_soon":
      return "var(--primary)";
    case "urgent":
      return "var(--status-risk)";
  }
}