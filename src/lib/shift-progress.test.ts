import { describe, it, expect } from "vitest";
import { jobProgress, machineDayTotals } from "./shift-progress";

const log = (p: number, stage: Record<string, number> = {}, extra = {}) => ({
  job_id: "j", log_date: "2026-11-13", shift_number: 1, machine_id: "m1",
  pieces_machined: p, stage_counts: stage, ...extra,
});

describe("shift progress", () => {
  it("sums machined pieces across shifts and caps at required", () => {
    const r = jobProgress(10, [log(6), log(7)]);
    expect(r.machinedRaw).toBe(13);
    expect(r.machined).toBe(10);
    expect(r.pct).toBe(100);
  });
  it("excludes 'no aplica' stages from the overall average", () => {
    const na = ["troquelado", "fosfato", "cem_armado", "cem_limpieza", "etiquetas", "liberacion", "almacen"];
    const r = jobProgress(4, [log(4, { inspeccion: 2 })], na);
    expect(r.stages.fosfato.pct).toBeNull();
    expect(r.overall).toBe(75); // (100 + 50) / 2
  });
  it("splits a day's output by machine and shift", () => {
    const t = machineDayTotals([log(3), log(2, {}, { shift_number: 3 }), log(9, {}, { log_date: "2026-11-12" })], "2026-11-13");
    expect(t.get("m1")).toEqual([3, 0, 2]);
  });
});
