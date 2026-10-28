import { describe, expect, it } from "vitest";
import {
  baseName,
  maxNameLength,
  parsePattern,
  planFileNames,
  removeDiacritics,
  sanitizeName,
  truncate,
  validatePattern,
} from "./filename";

const rows = (...names: string[]) => names.map((ten, i) => ({ rowNumber: i + 1, values: { ten } }));
const plan = (names: string[], pattern = "{{ten}}", extra = {}) =>
  planFileNames(rows(...names), pattern, { extension: "docx", ...extra });

describe("pattern", () => {
  it("splits fixed text and fields, trimming spaces inside the braces", () => {
    expect(parsePattern("{{ ten }}_Thử việc")).toEqual([
      { type: "field", key: "ten" },
      { type: "text", value: "_Thử việc" },
    ]);
  });

  it("normalizes field keys to NFC", () => {
    expect(parsePattern("{{tên}}".normalize("NFD"))).toEqual([{ type: "field", key: "tên" }]);
  });

  it("rejects an empty pattern, path characters in fixed text, and unknown fields", () => {
    expect(validatePattern("  ", ["ten"])).toEqual([{ kind: "empty" }]);
    expect(validatePattern("a/{{ten}}", ["ten"])).toEqual([
      { kind: "path-characters", text: "a/" },
    ]);
    expect(validatePattern("{{ten}}\\b", ["ten"])).toHaveLength(1);
    expect(validatePattern("..{{ten}}", ["ten"])).toHaveLength(1);
    expect(validatePattern("{{ten}}_{{ma}}", ["ten"])).toEqual([
      { kind: "unknown-field", key: "ma" },
    ]);
    expect(validatePattern("{{ten}}_Thử việc", ["ten"])).toEqual([]);
  });
});

describe("sanitize", () => {
  it.each([
    ['a<b>c:d"e|f?g*h', "a_b_c_d_e_f_g_h"],
    ["A/B\\C", "A_B_C"],
    ["a..b", "a_b"],
    ["../x", "__x"],
    ["tên  hai   khoảng", "tên hai khoảng"],
    ["trailing. . ", "trailing"],
    ["  lead", "lead"],
    ["tab\there", "tab_here"],
  ])("%j -> %j", (input, expected) => {
    expect(sanitizeName(input)).toBe(expected);
  });

  it.each(["CON", "con", "NUL", "COM1", "lpt9", "AUX"])("prefixes the reserved name %s", (name) => {
    expect(sanitizeName(name)).toBe(`_${name}`);
  });

  it("does not touch names that merely start like a reserved word", () => {
    expect(sanitizeName("CONTRACT")).toBe("CONTRACT");
  });

  it("keeps Vietnamese letters composed", () => {
    expect(sanitizeName("Nguyễn Văn A".normalize("NFD"))).toBe("Nguyễn Văn A");
  });
});

describe("plan", () => {
  it("adds the extension and keeps order", () => {
    expect(plan(["Nguyễn A", "Trần B"])).toEqual(["Nguyễn A.docx", "Trần B.docx"]);
  });

  it("numbers duplicates, ignoring case and NFC/NFD differences", () => {
    expect(plan(["Nguyễn A", "NGUYỄN A", "Nguyễn A".normalize("NFD")])).toEqual([
      "Nguyễn A.docx",
      "NGUYỄN A (2).docx",
      "Nguyễn A (3).docx",
    ]);
  });

  it("does not reuse a name that an earlier numbered duplicate already took", () => {
    expect(plan(["A", "A (2)", "A"])).toEqual(["A.docx", "A (2).docx", "A (3).docx"]);
  });

  it("uses the row number when the name is empty", () => {
    expect(plan(["", "  ", "B"])).toEqual(["1.docx", "2.docx", "B.docx"]);
  });

  it("builds a name from several fields and fixed text", () => {
    const out = planFileNames(
      [{ rowNumber: 1, values: { ten: "A", ma: "07" } }],
      "{{ma}}_{{ten}}_Thử việc",
      {
        extension: ".docx",
      },
    );
    expect(out).toEqual(["07_A_Thử việc.docx"]);
  });

  it("removes Vietnamese diacritics on request, including đ", () => {
    expect(removeDiacritics("Đặng Thị Ngọc Ánh")).toBe("Dang Thi Ngoc Anh");
    expect(plan(["Đặng Văn Đức"], "{{ten}}", { removeDiacritics: true })).toEqual([
      "Dang Van Duc.docx",
    ]);
  });

  it("sanitizes values from the data, so one odd cell does not fail the row", () => {
    expect(plan(["A/B", "con"])).toEqual(["A_B.docx", "_con.docx"]);
  });

  it("truncates long names, keeps the extension and numbers still fit", () => {
    const long = "x".repeat(300);
    const [a, b] = plan([long, long], "{{ten}}", { maxLength: 40 });
    expect(a).toHaveLength(40);
    expect(a?.endsWith(".docx")).toBe(true);
    expect(b).toHaveLength(40);
    expect(b?.endsWith(" (2).docx")).toBe(true);
    expect(a).not.toBe(b);
  });

  it("never cuts between a letter and its combining marks", () => {
    const decomposed = "ễ".normalize("NFD").repeat(10); // each letter is 3 UTF-16 units
    const cut = truncate(decomposed, 7);
    expect(cut.normalize("NFC")).toBe("ễễ");
    expect(cut).toBe("ễễ".normalize("NFD"));
  });

  it("budgets the path as folder, zip name and file", () => {
    const folder = "C:\\Users\\hr\\Documents\\Hop dong";
    const max = maxNameLength(folder, "dot-1");
    expect(folder.length + 1 + "dot-1".length + 1 + max).toBeLessThanOrEqual(259);
    expect(maxNameLength("x".repeat(300), "z")).toBe(24);
  });
});

describe("baseName", () => {
  it("is empty-safe for a missing field value", () => {
    expect(baseName("{{ten}}", {}, { rowNumber: 5 })).toBe("5");
  });
});
