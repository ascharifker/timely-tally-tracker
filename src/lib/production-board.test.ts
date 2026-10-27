import { describe, it, expect } from "vitest";
import { productionColumns, belongsToColumn, planBoardAssignment } from "./production-board";
import type { Job, Machine } from "./fact-types";
const machine = (id: string, name: string, order: number): Machine => ({ id, name, type: "internal", display_order: order, hours_per_shift: 8, active_shifts: ["manana", "tarde", "noche"] });
const machines = [machine("m1", "MAZAK 1", 1), machine("m2", "MAZAK 2", 2)];
const job = (id: string, machineId: string | null, start = "2026-10-27T07:00:00.000Z"): Job => ({ id, odf: id, machine_id: machineId, status: "MAZAK", planned_start: start, planned_end: "2026-10-27T15:00:00.000Z", hours_override: 8, qty: 1, pir: null, tube_spec: null, priority: "normal", customer_date: null, export_date: null, notes: null, operator_name: null, po_musa: null, po_halliburton: null });
describe("production Kanban", () => {
  it("creates one column for each MAZAK machine", () => { expect(productionColumns(machines, []).filter((c) => c.status === "MAZAK").map((c) => c.label)).toEqual(["MAZAK 1", "MAZAK 2"]); });
  it("places ODTs only in their assigned machine column", () => { const cols = productionColumns(machines, []); const one = cols.find((c) => c.id === "m1"); const two = cols.find((c) => c.id === "m2"); if (!one || !two) throw new Error("Missing columns"); expect(belongsToColumn(job("A", "m1"), one, machines)).toBe(true); expect(belongsToColumn(job("A", "m1"), two, machines)).toBe(false); });
  it("keeps unassigned ODTs visible", () => { const columns = productionColumns(machines, [job("A", null)]); const col = columns.find((c) => c.unassigned); if (!col) throw new Error("Missing unassigned column"); expect(belongsToColumn(job("A", null), col, machines)).toBe(true); });
  it("assigns the destination machine and previews downstream conflicts", () => { const anchor = job("A", "m1"); const moves = planBoardAssignment([anchor, job("B", "m2")], anchor, machines[1], [], Date.parse("2026-10-27T07:00:00Z")); expect(moves.map((m) => m.jobId)).toEqual(["A", "B"]); expect(moves[0].machine_id).toBe("m2"); expect(moves[1].planned_start).toBe(moves[0].planned_end); });
});
