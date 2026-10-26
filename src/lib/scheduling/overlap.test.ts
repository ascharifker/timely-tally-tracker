import { describe, it, expect } from "vitest";
import { findOverlap } from "./overlap";
const H = 3_600_000;
const job = { id: "a", odf: "1/26", machine_id: "m1", planned_start: new Date(10 * H).toISOString(), planned_end: new Date(20 * H).toISOString() };
describe("findOverlap", () => {
  it("blocks overlapping slot on same machine", () => expect(findOverlap([job], "m1", 15 * H, 25 * H)?.id).toBe("a"));
  it("allows adjacent slot", () => expect(findOverlap([job], "m1", 20 * H, 25 * H)).toBeNull());
  it("allows other machine", () => expect(findOverlap([job], "m2", 15 * H, 25 * H)).toBeNull());
  it("ignores the job being moved", () => expect(findOverlap([job], "m1", 15 * H, 25 * H, "a")).toBeNull());
});
