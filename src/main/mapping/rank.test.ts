import { describe, expect, it } from "vitest";
import { rankTemplates } from "./rank";

const tag = (name: string, label = name) => ({ name, label });

describe("rankTemplates", () => {
  it("counts fields that find a column", () => {
    const fits = rankTemplates(
      [
        { id: "a", tags: [tag("ho_ten", "Họ tên"), tag("cccd"), tag("luong")] },
        { id: "b", tags: [tag("ngay_sinh")] },
      ],
      ["Họ tên", "Ngày sinh"],
    );
    expect(fits).toEqual([
      { templateId: "a", matched: 1, total: 3 },
      { templateId: "b", matched: 1, total: 1 },
    ]);
  });
  it("matches an image template's fields to the columns by position", () => {
    const fits = rankTemplates(
      [{ id: "i", kind: "image", tags: [tag("a"), tag("b"), tag("c")] }],
      ["x", "y"],
    );
    expect(fits).toEqual([{ templateId: "i", matched: 2, total: 3 }]);
  });
  it("is 0 of total with no columns, and 0 of 0 with no fields", () => {
    expect(rankTemplates([{ id: "a", tags: [tag("ho_ten")] }], [])).toEqual([
      { templateId: "a", matched: 0, total: 1 },
    ]);
    expect(rankTemplates([{ id: "a", tags: [] }], ["Họ tên"])).toEqual([
      { templateId: "a", matched: 0, total: 0 },
    ]);
  });
});
