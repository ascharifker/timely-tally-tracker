import { describe, it, expect } from "vitest";
import { rankPlans, folderLabel } from "./plan-search";

const f = (name: string, rev: string | null = null) => ({
  name,
  path_display: `/Files and PIR Master Folder/Planos/${name}`,
  rev_from_name: rev,
});

describe("rankPlans", () => {
  it("drops files whose name and folder lack the query", () => {
    const out = rankPlans([f("4540049108.pdf"), f("103321049-B.pdf")], "103321049-B");
    expect(out.map((x) => x.name)).toEqual(["103321049-B.pdf"]);
  });
  it("matches '103216693 Rev-A' to the PIR, BOM and REV A folder like Dropbox does", () => {
    const dir = "/DOCUMENTACIÓN/Drawings and PIRs/103216693/103216693 REV A";
    const files = [
      { name: "PIR-103216693-A.doc", path_display: `${dir}/PIR-103216693-A.doc`, rev_from_name: null },
      { name: "BOMReport-103216693-A.doc", path_display: `${dir}/BOMReport-103216693-A.doc`, rev_from_name: null },
      { name: "103216693 REV A", path_display: dir, rev_from_name: "A", is_folder: true },
      { name: "4540076773.pdf", path_display: "/MUSA/4540076773.pdf", rev_from_name: null },
    ];
    const out = rankPlans(files, "103216693 Rev-A").map((x) => x.name);
    expect(out).toHaveLength(3);
    expect(out[0]).toBe("103216693 REV A");
  });
  it("puts exact name and matching revision first", () => {
    const out = rankPlans([f("old 103321049 copy.pdf"), f("103321049 REV A.pdf", "A"), f("103321049.pdf")], "103321049", "A");
    expect(out[0].name).toBe("103321049.pdf");
    expect(out[1].name).toBe("103321049 REV A.pdf");
  });
});

it("folderLabel shows the last two folders", () => {
  expect(folderLabel("/A/B/C/x.pdf")).toBe("B › C");
});
