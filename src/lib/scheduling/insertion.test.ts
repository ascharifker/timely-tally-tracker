import { describe, expect, it } from "vitest";
import { assertNoMoveOverlaps, planInsertion, type ScheduledJob } from "./insertion";

const H = 3_600_000;
const iso = (hour: number) => new Date(hour * H).toISOString();
const job = (id: string, start: number, end: number, machine = "mazak1"): ScheduledJob => ({
  id, odf: id, machine_id: machine, planned_start: iso(start), planned_end: iso(end),
});
const anchor = job("A", 40, 48);

describe("machine insertion cascade", () => {
  it("inserts the moved ODT and pushes subsequent conflicting orders in order", () => {
    const jobs = [anchor, job("B", 8, 16), job("C", 16, 24)];
    const moves = planInsertion(jobs, "A", "mazak1", 8 * H, 16 * H);
    expect(moves.map((m) => [m.jobId, m.planned_start, m.planned_end])).toEqual([
      ["A", iso(8), iso(16)], ["B", iso(16), iso(24)], ["C", iso(24), iso(32)],
    ]);
    expect(() => assertNoMoveOverlaps(jobs, moves)).not.toThrow();
  });
  it("does not move jobs on other machines or on the source machine", () => {
    const moves = planInsertion([anchor, job("B", 8, 16, "mazak2"), job("C", 48, 56)], "A", "mazak2", 8 * H, 16 * H);
    expect(moves.map((m) => m.jobId)).toEqual(["A", "B"]);
  });
  it("stops when a gap absorbs the delay, leaving unrelated later jobs unchanged", () => {
    const moves = planInsertion([anchor, job("B", 8, 12), job("C", 24, 32)], "A", "mazak1", 8 * H, 16 * H);
    expect(moves.map((m) => m.jobId)).toEqual(["A", "B"]);
    expect(moves[1].planned_end).toBe(iso(20));
  });
  it("preserves duration when the drop is inside an existing ODT", () => {
    const moves = planInsertion([anchor, job("B", 4, 12)], "A", "mazak1", 8 * H, 16 * H);
    expect(moves[1].planned_start).toBe(iso(16));
    expect(moves[1].planned_end).toBe(iso(24));
  });
  it("allows adjacent slots without cascading", () => {
    expect(planInsertion([anchor, job("B", 0, 8), job("C", 16, 24)], "A", "mazak1", 8 * H, 16 * H)).toHaveLength(1);
  });
  it("calculates from already staged positions without moving an ODT twice", () => {
    const jobs = [anchor, job("B", 8, 16), job("C", 16, 24)];
    const first = planInsertion(jobs, "A", "mazak1", 8 * H, 16 * H);
    const staged = jobs.map((j) => ({ ...j, ...first.find((m) => m.jobId === j.id) }));
    const second = planInsertion(staged, "A", "mazak1", 16 * H, 24 * H);
    expect(second.map((m) => [m.jobId, m.planned_start])).toEqual([["A", iso(16)], ["B", iso(24)], ["C", iso(32)]]);
  });
  it("rejects approval when removing a dependent move leaves an overlap", () => {
    const jobs = [anchor, job("B", 8, 16)];
    expect(() => assertNoMoveOverlaps(jobs, planInsertion(jobs, "A", "mazak1", 8 * H, 16 * H).slice(0, 1))).toThrow("ODT B");
  });
});