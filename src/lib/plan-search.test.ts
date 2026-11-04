import { describe, it, expect } from "vitest";
import { rankPlans, folderLabel } from "./plan-search";

const f = (name: string, rev: string | null = null) => ({
  name,
  path_display: `/Files and PIR Master Folder/Planos/${name}`,
  rev_from_name: rev,
});

describe("rankPlans", () => {
  it("drops spreadsheets and files whose name lacks the query", () => {
    const out = rankPlans([f("4540049108.pdf"), f("103321049-B.xlsx"), f("103321049-B.pdf")], "103321049-B");
    expect(out.map((x) => x.name)).toEqual(["103321049-B.pdf"]);
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
