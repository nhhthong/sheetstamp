import { describe, expect, it } from "vitest";
import {
  baseName,
  maxNameLength,
  parsePattern,
  planFileNames,
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

  it.each(["con.report", "COM1.txt", "Nul.tar.gz", "aux .x"])(
    "prefixes a reserved name that has an extension: %s",
    (name) => {
      expect(sanitizeName(name)).toBe(`_${name}`);
    },
  );

  it("strips bidi controls and zero-width characters", () => {
    expect(sanitizeName("a\u202Eb\u2066c\u2069d\u200Be\u200Df\uFEFFg")).toBe("abcdefg");
    expect(sanitizeName("\u200Bcon")).toBe("_con");
  });

  it("does not let a leading dot make a hidden file", () => {
    expect(sanitizeName(" .hid")).toBe("_hid");
    expect(sanitizeName(".env")).toBe("_env");
    expect(sanitizeName("a.b")).toBe("a.b");
  });

  it("does not touch names that merely start like a reserved word", () => {
    expect(sanitizeName("CONTRACT")).toBe("CONTRACT");
  });

  it("keeps Vietnamese letters composed", () => {
    expect(sanitizeName("Nguyễn Văn A".normalize("NFD"))).toBe("Nguyễn Văn A");
  });
});

describe("plan speed", () => {
  it("gives the same names as before for a small case with clashes between bases", () => {
    expect(plan(["A", "A", "a", "A (2)", "A", "B", "A (2)"])).toEqual([
      "A.docx",
      "A (2).docx",
      "a (3).docx",
      "A (2) (2).docx",
      "A (4).docx",
      "B.docx",
      "A (2) (3).docx",
    ]);
  });

  it.each([4000, 20000])("plans %i identical names well under a second", (count) => {
    const started = performance.now();
    const names = plan(Array.from({ length: count }, () => "Nguyễn Văn An"));
    expect(performance.now() - started).toBeLessThan(1000);
    expect(new Set(names).size).toBe(count);
    expect(names[0]).toBe("Nguyễn Văn An.docx");
    expect(names[count - 1]).toBe(`Nguyễn Văn An (${count}).docx`);
  });

  it("cuts by characters and by UTF-8 bytes at grapheme boundaries", () => {
    const text = "ệ".repeat(100); // 3 bytes each
    const cut = truncate(text, 100, 200);
    expect(new TextEncoder().encode(cut).length).toBeLessThanOrEqual(200);
    expect(cut).toBe("ệ".repeat(66));
    const decomposed = "e\u0323\u0302".repeat(10); // one letter, two marks
    expect(truncate(decomposed, 100, 7)).toBe("e\u0323\u0302");
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
