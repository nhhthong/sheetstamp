import { describe, expect, it } from "vitest";
import cases from "../../../tests/fixtures/mapping/cases.json";
import { buildCases, type FixtureCase } from "../../../tests/fixtures/mapping/make-fixtures";
import type { FieldMatch, MappingProfile } from "../../shared/ipc/mapping";
import { matchFields, reconcile, suggestLabel } from "./index";

const fixtures = cases as unknown as FixtureCase[];
const f = (...keys: string[]) => keys.map((key) => ({ key }));

describe("fixtures", () => {
  it("equal the output of the generator", () => {
    expect(fixtures).toEqual(buildCases());
  });

  it("every fixture field gets exactly the expected column and rule, no wrong guess anywhere", () => {
    for (const c of fixtures) {
      const got = matchFields(c.fields, c.columns);
      for (const m of got) {
        const want = c.expected[m.field];
        const actual = m.column === null ? null : { column: m.column, rule: m.rule };
        expect(actual, `${c.name}: ${m.field}`).toEqual(want);
      }
    }
  });
});

describe("matchFields", () => {
  it('maps "Họ tên" to ho_ten and leaves "SĐT" for so_dien_thoai unmatched', () => {
    const got = matchFields(f("ho_ten", "so_dien_thoai"), ["STT", "Họ tên", "SĐT"]);
    expect(got).toMatchObject([
      { field: "ho_ten", column: "Họ tên", rule: "exact" },
      { field: "so_dien_thoai", column: null },
    ]);
  });

  it("matches without diacritics, case, underscores or punctuation", () => {
    const got = matchFields(f("ngay_sinh"), ["NGAY-SINH"]);
    expect(got[0]).toMatchObject({ column: "NGAY-SINH", rule: "exact", score: 1 });
  });

  it("compares the column with the label as well as the tag", () => {
    const got = matchFields([{ key: "ma_hs", label: "Mã hồ sơ" }], ["Mã hồ sơ"]);
    expect(got[0]).toMatchObject({ rule: "exact" });
  });

  it("reports the rule and a score below 1 for fuzzy matches", () => {
    const [fuzzy] = matchFields(f("ngay_sinh"), ["Sinh ngày"]);
    expect(fuzzy).toMatchObject({ rule: "fuzzy" });
    const score = (m: FieldMatch | undefined) => (m && m.column !== null ? m.score : 0);
    expect(score(fuzzy)).toBeLessThan(1);
    expect(score(fuzzy)).toBeGreaterThan(0.75);
  });

  it("handles word order and does not guess abbreviations or longer names", () => {
    const cols = ["Tên họ", "MNV", "Số điện thoại di động"];
    expect(matchFields(f("ho_ten"), cols)[0]).toMatchObject({ column: "Tên họ", rule: "fuzzy" });
    expect(matchFields(f("ma_nhan_vien"), cols)[0]).toMatchObject({ column: null });
    expect(matchFields(f("so_dien_thoai"), cols)[0]).toMatchObject({ column: null });
  });

  it("leaves a field unmatched instead of guessing", () => {
    expect(matchFields(f("ho_ten"), ["Họ", "Tên"])).toEqual([{ field: "ho_ten", column: null }]);
    expect(matchFields(f("ngay_sinh"), ["Ngày cấp"])).toEqual([
      { field: "ngay_sinh", column: null },
    ]);
  });

  it("gives a column to one field only", () => {
    const got = matchFields([{ key: "ho_ten" }, { key: "ho_ten_2", label: "Ho ten" }], ["Ho ten"]);
    expect(got.filter((m) => m.column !== null)).toHaveLength(1);
    // The first field in template order wins the column.
    expect(got[0]).toMatchObject({ field: "ho_ten", column: "Ho ten" });
    expect(got[1]).toEqual({ field: "ho_ten_2", column: null });
  });

  it("refuses a fuzzy choice when two columns fit equally well", () => {
    const got = matchFields(f("ho_ten"), ["Hoten", "Ho-tenn"]);
    expect(got[0]).toEqual({ field: "ho_ten", column: null });
  });

  it("answers in the order of the fields", () => {
    const got = matchFields(f("email", "ho_ten"), ["Họ tên", "Email"]);
    expect(got.map((m) => m.field)).toEqual(["email", "ho_ten"]);
  });
});

describe("suggestLabel", () => {
  it("turns underscores into spaces and capitalises the first letter", () => {
    expect(suggestLabel("ho_ten")).toBe("Ho ten");
    expect(suggestLabel("Họ_Tên")).toBe("Họ Tên");
    expect(suggestLabel("ten_phuong_tien")).toBe("Ten phuong tien");
    expect(suggestLabel("ngày_vào")).toBe("Ngày vào");
    expect(suggestLabel("__x__")).toBe("X");
    expect(suggestLabel("___")).toBe("___");
  });
});

describe("reconcile", () => {
  const fields = f("ho_ten", "ngay_sinh", "dia_chi", "ghi_chu_rieng");
  const profile: MappingProfile = {
    version: 1,
    fields: {
      ho_ten: { kind: "column", column: "Tên khách" },
      ngay_sinh: { kind: "column", column: "Sinh" },
      dia_chi: { kind: "fixed", text: "Hà Nội" },
      ghi_chu_rieng: { kind: "empty" },
      removed_tag: { kind: "empty" },
    },
  };

  it("keeps valid choices, fixed texts and empty, drops tags that are gone", () => {
    const r = reconcile(profile, fields, ["Tên khách", "Sinh", "Khác"]);
    expect(r.profile.fields).toEqual({
      ho_ten: { kind: "column", column: "Tên khách" },
      ngay_sinh: { kind: "column", column: "Sinh" },
      dia_chi: { kind: "fixed", text: "Hà Nội" },
      ghi_chu_rieng: { kind: "empty" },
    });
    expect(r.lost).toEqual([]);
    expect(r.filled).toEqual([]);
    expect(r.unmatched).toEqual([]);
  });

  it("lists the fields that lost their column and keeps the rest", () => {
    const r = reconcile(profile, fields, ["Tên khách", "Khác"]);
    expect(r.lost).toEqual([{ field: "ngay_sinh", previous: "Sinh", replacedBy: null }]);
    expect(r.profile.fields.ngay_sinh).toBeUndefined();
    expect(r.profile.fields.ho_ten).toEqual({ kind: "column", column: "Tên khách" });
    expect(r.unmatched).toEqual(["ngay_sinh"]);
  });

  it("matches a lost field again when the new data has a fitting column", () => {
    const r = reconcile(profile, fields, ["Tên khách", "Ngày sinh"]);
    expect(r.lost).toEqual([{ field: "ngay_sinh", previous: "Sinh", replacedBy: "Ngày sinh" }]);
    expect(r.profile.fields.ngay_sinh).toEqual({ kind: "column", column: "Ngày sinh" });
    expect(r.filled).toMatchObject([{ field: "ngay_sinh", column: "Ngày sinh", rule: "exact" }]);
  });

  it("starts from nothing: fills what it can and lists the rest as unmatched", () => {
    const r = reconcile(null, fields, ["Ho ten", "Khác"]);
    expect(r.profile.fields).toEqual({ ho_ten: { kind: "column", column: "Ho ten" } });
    expect(r.unmatched).toEqual(["ngay_sinh", "dia_chi", "ghi_chu_rieng"]);
    expect(r.lost).toEqual([]);
  });

  it("does not hand a column the user chose to another field", () => {
    const p: MappingProfile = {
      version: 1,
      fields: { ten: { kind: "column", column: "Họ và tên" } },
    };
    const r = reconcile(p, f("ten", "ho_ten"), ["Họ và tên"]);
    expect(r.profile.fields.ten).toEqual({ kind: "column", column: "Họ và tên" });
    expect(r.profile.fields.ho_ten).toBeUndefined();
  });

  it("follows a column renamed only by case or diacritics", () => {
    const r = reconcile(profile, fields, ["TEN KHACH", "Sinh"]);
    expect(r.profile.fields.ho_ten).toEqual({ kind: "column", column: "TEN KHACH" });
    expect(r.lost).toEqual([]);
  });

  it("does not change its input and the profile survives JSON", () => {
    const before = JSON.stringify(profile);
    const r = reconcile(profile, fields, ["Tên khách"]);
    expect(JSON.stringify(profile)).toBe(before);
    expect(JSON.parse(JSON.stringify(r.profile))).toEqual(r.profile);
  });

  it("is not confused by tag keys such as __proto__", () => {
    const r = reconcile(null, f("__proto__", "constructor"), ["x"]);
    expect(r.unmatched).toEqual(["__proto__", "constructor"]);
  });
});
