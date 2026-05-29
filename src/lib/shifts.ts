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

const SHIFT_LENGTH_MS = 8 * 60 * 60 * 1000;

/** Next 06:00 / 14:00 / 22:00 boundary at or after `from`. */
export function nextShiftBoundary(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setMinutes(0, 0, 0);
  const h = d.getHours();
  const boundaries = [6, 14, 22];
  const next = boundaries.find((b) => h < b);
  if (next !== undefined) {
    d.setHours(next);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(6);
  }
  return d;
}

/**
 * Next shift boundary that belongs to one of the machine's active shifts.
 * Walks forward in 8h steps until it finds an active slot. Falls back to the
 * generic boundary if no shifts are active (defensive).
 */
export function nextActiveShiftBoundary(
  from: Date = new Date(),
  activeShifts: Array<"manana" | "tarde" | "noche">,
): Date {
  if (!activeShifts || activeShifts.length === 0) return nextShiftBoundary(from);
  let d = nextShiftBoundary(from);
  for (let i = 0; i < 9; i++) {
    const idx = shiftIndexFromHour(d.getHours());
    if (activeShifts.includes(SHIFTS[idx].key)) return d;
    d = new Date(d.getTime() + SHIFT_LENGTH_MS);
  }
  return d;
}

/** Add N shifts (8h each) to a date. */
export function addShifts(d: Date, n: number): Date {
  return new Date(d.getTime() + n * SHIFT_LENGTH_MS);
}

/** Unique shift indices a [start, end) interval touches, in chronological order. */
export function shiftSpan(startISO: string, endISO: string): number[] {
  const s = new Date(startISO).getTime();
  const e = new Date(endISO).getTime();
  if (e <= s) return [shiftIndexFromDate(startISO)];
  const seen = new Set<number>();
  const out: number[] = [];
  // sample every 30 min — cheap and accurate enough for 8h bands
  for (let t = s; t < e; t += 30 * 60 * 1000) {
    const idx = shiftIndexFromHour(new Date(t).getHours());
    if (!seen.has(idx)) {
      seen.add(idx);
      out.push(idx);
    }
    if (seen.size === 3) break;
  }
  return out;
}

/** Snap a date to the start of a given shift on the same calendar day. */
export function snapToShift(d: Date, shiftIdx: number): Date {
  const out = new Date(d);
  out.setHours(SHIFTS[shiftIdx].startHour, 0, 0, 0);
  return out;
}