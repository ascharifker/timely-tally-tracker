// Santiago's 8 downstream stages after machining (SEGUIMIENTO_MAQUINADOS sheet).
export const STAGES = [
  { key: "inspeccion", label: "Inspección" },
  { key: "troquelado", label: "Troquelado" },
  { key: "fosfato", label: "Fosfato" },
  { key: "cem_armado", label: "Cementación · Armado de válvula" },
  { key: "cem_limpieza", label: "Cementación · Limpieza y desmolde" },
  { key: "etiquetas", label: "Identificación · Etiquetas" },
  { key: "liberacion", label: "Liberación final" },
  { key: "almacen", label: "Material entregado · Almacén" },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];

export interface ShiftLogLike {
  job_id: string;
  log_date: string;
  shift_number: number;
  machine_id: string | null;
  pieces_machined: number;
  stage_counts: Partial<Record<StageKey, number>> | null;
}

export interface JobProgress {
  machined: number; // capped at required
  machinedRaw: number;
  pct: number;
  stages: Record<StageKey, { count: number; pct: number | null }>; // pct null = no aplica
  overall: number; // average of machining + applicable stages
}

/** Totals for one ODT. Counts are capped at the required qty, like the sheet. */
export function jobProgress(
  required: number,
  logs: ShiftLogLike[],
  notApplicable: string[] = [],
): JobProgress {
  const req = Math.max(0, required);
  const pct = (n: number) => (req === 0 ? 0 : Math.round((Math.min(n, req) / req) * 100));
  const machinedRaw = logs.reduce((s, l) => s + (l.pieces_machined || 0), 0);
  const stages = {} as JobProgress["stages"];
  const pcts: number[] = [pct(machinedRaw)];
  for (const st of STAGES) {
    const count = logs.reduce((s, l) => s + (l.stage_counts?.[st.key] ?? 0), 0);
    if (notApplicable.includes(st.key)) {
      stages[st.key] = { count, pct: null };
    } else {
      const p = pct(count);
      stages[st.key] = { count: Math.min(count, req), pct: p };
      pcts.push(p);
    }
  }
  return {
    machinedRaw,
    machined: Math.min(machinedRaw, req),
    pct: pct(machinedRaw),
    stages,
    overall: Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length),
  };
}

/** Pieces machined per machine per shift on one day. */
export function machineDayTotals(logs: ShiftLogLike[], day: string) {
  const out = new Map<string, [number, number, number]>();
  for (const l of logs) {
    if (l.log_date !== day || !l.machine_id) continue;
    const row = out.get(l.machine_id) ?? [0, 0, 0];
    if (l.shift_number >= 1 && l.shift_number <= 3) row[l.shift_number - 1] += l.pieces_machined || 0;
    out.set(l.machine_id, row);
  }
  return out;
}

/** Current shift by local hour: 1 = 06–14, 2 = 14–22, 3 = 22–06. */
export function currentShiftNumber(d = new Date()): 1 | 2 | 3 {
  const h = d.getHours();
  if (h >= 6 && h < 14) return 1;
  if (h >= 14 && h < 22) return 2;
  return 3;
}
