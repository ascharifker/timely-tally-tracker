// Shared production shift definitions (24h coverage across Mañana / Tarde / Noche).
// Used by the Gantt, the job detail view, and the approve-moves dialog so
// labels and colors stay consistent everywhere.

export interface ShiftDef {
  key: "manana" | "tarde" | "noche";
  label: "M" | "T" | "N";
  name: string;
  startHour: number;
  hours: number;
  /** Subtle background tint for the day grid cell. */
  tint: string;
  /** Solid color used for badges, headers and drag overlays. */
  color: string;
}

export const SHIFTS: ShiftDef[] = [
  { key: "manana", label: "M", name: "Mañana", startHour: 6,  hours: 8, tint: "rgba(250, 204, 21, 0.10)", color: "#eab308" },
  { key: "tarde",  label: "T", name: "Tarde",  startHour: 14, hours: 8, tint: "rgba(56, 189, 248, 0.10)", color: "#38bdf8" },
  { key: "noche",  label: "N", name: "Noche",  startHour: 22, hours: 8, tint: "rgba(139, 92, 246, 0.14)", color: "#8b5cf6" },
];

/** Hour of day → shift index (0=M, 1=T, 2=N). Night wraps 22→06. */
export function shiftIndexFromHour(hour: number): number {
  if (hour >= 6 && hour < 14) return 0;
  if (hour >= 14 && hour < 22) return 1;
  return 2;
}

export function shiftIndexFromDate(d: Date | string): number {
  const date = typeof d === "string" ? new Date(d) : d;
  return shiftIndexFromHour(date.getHours());
}

/** Absolute ms for the start of a given shift on a given day. */
export function shiftStartMs(day: Date, shiftIdx: number): number {
  const d = new Date(day);
  d.setHours(SHIFTS[shiftIdx].startHour, 0, 0, 0);
  return d.getTime();
}

/** Format a date as a friendly shift label, e.g. "Lun 28 · Tarde 14:00". */
export function formatShiftLabel(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const s = SHIFTS[shiftIndexFromDate(d)];
  const day = d.toLocaleDateString("es", { weekday: "short", day: "2-digit", month: "short" });
  return `${day} · ${s.name} ${String(s.startHour).padStart(2, "0")}:00`;
}