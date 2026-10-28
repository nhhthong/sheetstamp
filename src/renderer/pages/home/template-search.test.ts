import { describe, expect, it } from "vitest";
import {
  compareTemplates,
  fold,
  matchesQuery,
  type RankedTemplate,
  visibleTemplates,
} from "./template-search";

const make = (over: Partial<RankedTemplate>): RankedTemplate => ({
  id: "x",
  name: "Mẫu",
  kind: "word",
  groupId: "g1",
  groupName: "Hợp đồng",
  note: "",
  sourceFileName: "a.docx",
  tagCount: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  lastUsedAt: null,
  matched: 0,
  total: 0,
  ...over,
});

describe("fold", () => {
  it("ignores diacritics, case, đ and combining marks", () => {
    expect(fold("Hợp đồng")).toBe("hop dong");
    expect(fold("ĐỒNG")).toBe("dong");
    expect(fold("Hợ́p")).toBe("hop"); // decomposed
    expect(fold("  a   b ")).toBe("a b");
  });
});

describe("matchesQuery", () => {
  const t = make({ name: "Thử việc", groupName: "Nghỉ việc", note: "Dùng cho kế toán" });
  it("matches name, group and note without diacritics", () => {
    expect(matchesQuery(t, "thu viec")).toBe(true);
    expect(matchesQuery(t, "nghi")).toBe(true);
    expect(matchesQuery(t, "ke toan")).toBe(true);
    expect(matchesQuery(t, "viec ke")).toBe(true);
    expect(matchesQuery(t, "hop dong")).toBe(false);
    expect(matchesQuery(t, "  ")).toBe(true);
  });
});

describe("order", () => {
  it("matches first, then last used, never used last", () => {
    const a = make({ id: "a", name: "A", matched: 1, lastUsedAt: "2026-05-01" });
    const b = make({ id: "b", name: "B", matched: 3, lastUsedAt: null });
    const c = make({ id: "c", name: "C", matched: 1, lastUsedAt: "2026-06-01" });
    const d = make({ id: "d", name: "D", matched: 1, lastUsedAt: null });
    expect(visibleTemplates([a, b, c, d], "", null).map((t) => t.id)).toEqual(["b", "c", "a", "d"]);
    expect(compareTemplates(a, a)).toBe(0);
  });
  it("filters by group", () => {
    const a = make({ id: "a", groupId: "g1" });
    const b = make({ id: "b", groupId: "g2", groupName: "Khác" });
    expect(visibleTemplates([a, b], "", "g2").map((t) => t.id)).toEqual(["b"]);
  });
});
