import { describe, expect, it } from "vitest";
import { odfProductionFields } from "./odf-fields";

describe("ODT production fields", () => {
  it("stores the manually entered tube number independently of the PO specification", () => {
    const fields = odfProductionFields({ tube_number: " T-1042 ", customer_date: null, export_date: null });
    expect(fields.tube_spec).toBe("T-1042");
  });

  it("requires a nonempty tube number", () => {
    expect(() => odfProductionFields({ tube_number: " ", customer_date: null, export_date: null })).toThrow();
  });

  it("keeps customer and export dates independent", () => {
    expect(odfProductionFields({ tube_number: "T-1042", customer_date: "2026-11-10", export_date: "2026-11-06" })).toEqual({
      tube_spec: "T-1042", customer_date: "2026-11-10", export_date: "2026-11-06",
    });
  });

  it("preserves a deliberately cleared export date", () => {
    expect(odfProductionFields({ tube_number: "T-1042", customer_date: "2026-11-10", export_date: null }).export_date).toBeNull();
  });
});