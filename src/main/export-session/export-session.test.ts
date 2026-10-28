import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DataTable } from "../data";
import { makeDocx, paragraph, run } from "../selftest/make-docx";
import { openStorage, type Storage } from "../storage";
import { buildRows, hasUnwritableCharacter } from "./rows";
import { ExportSession, effectivePattern, type SessionDeps, zipNameFor } from "./session";

const table: DataTable = {
  fileName: "x.csv",
  columns: ["Họ tên", "Chức vụ"],
  rows: [
    ["Nguyễn Văn An", "Kế toán"],
    ["Trần Thị Bình", ""],
    ["Lê Minh Châu", "Bảo\u0001vệ"],
  ],
  numericColumns: [false, false],
};

describe("buildRows", () => {
  const keys = ["ten", "chuc_vu", "ma"];
  const entries = {
    ten: { kind: "column" as const, column: "Họ tên" },
    chuc_vu: { kind: "column" as const, column: "Chức vụ" },
  };

  it("uses the preview's values: mapped-but-empty is an empty string, an unmapped tag has no value", () => {
    const rows = buildRows(table, keys, entries);
    expect(rows.map((r) => r.rowNumber)).toEqual([1, 2, 3]);
    expect(rows[0]?.values).toEqual({ ten: "Nguyễn Văn An", chuc_vu: "Kế toán" });
    expect(rows[1]?.values).toEqual({ ten: "Trần Thị Bình", chuc_vu: "" });
    expect("ma" in (rows[0]?.values ?? {})).toBe(false);
  });

  it("leaves out a value the Word file cannot hold, so that row is reported", () => {
    expect(buildRows(table, keys, entries)[2]?.values).toEqual({ ten: "Lê Minh Châu" });
  });

  it("a column missing from the data gives no value", () => {
    const rows = buildRows(table, ["ten"], { ten: { kind: "column", column: "Không có" } });
    expect(rows[0]?.values).toEqual({});
  });

  it("fixed text and the empty choice are values", () => {
    const rows = buildRows(table, ["a", "b"], {
      a: { kind: "fixed", text: "Hà Nội" },
      b: { kind: "empty" },
    });
    expect(rows[0]?.values).toEqual({ a: "Hà Nội", b: "" });
  });
});

describe("hasUnwritableCharacter", () => {
  it("accepts text, tab, newline and astral characters", () => {
    expect(hasUnwritableCharacter("Nguyễn\tVăn\nAn\r 😀")).toBe(false);
  });
  it("refuses controls, lone surrogates and U+FFFE", () => {
    for (const bad of ["a\u0000b", "a\u0008", "a\u000b", "a\u001f", "a\ud800", "\udc00a", "a￾"]) {
      expect(hasUnwritableCharacter(bad)).toBe(true);
    }
  });
});

describe("zipNameFor and effectivePattern", () => {
  it("names the ZIP from the template and the local date, with the filename rules", () => {
    expect(zipNameFor("Hợp đồng thử việc", new Date(2026, 9, 28))).toBe(
      "Hợp đồng thử việc 2026-10-28.zip",
    );
    const odd = zipNameFor('A/B: "C"?', new Date(2026, 0, 5));
    expect(odd).toBe("A_B_ _C__ 2026-01-05.zip");
    expect(/[\\/:*?"<>|]/.test(odd)).toBe(false);
  });

  it("falls back from the default {{ten}} to the first field", () => {
    const tags = [{ name: "ho_ten", label: "Họ tên" }];
    expect(effectivePattern({ filenamePattern: "{{ten}}", tags })).toBe("{{ho_ten}}");
    expect(
      effectivePattern({
        filenamePattern: "{{ten}}",
        tags: [{ name: "ten", label: "Tên" }, ...tags],
      }),
    ).toBe("{{ten}}");
    expect(effectivePattern({ filenamePattern: "{{ho_ten}}_x", tags })).toBe("{{ho_ten}}_x");
    expect(effectivePattern({ filenamePattern: "{{ten}}", tags: [] })).toBe("");
  });
});

describe("ExportSession", () => {
  let dir: string;
  let storage: Storage;
  let templateId: string;
  let current: DataTable | undefined;

  const deps = (): SessionDeps => ({
    storage: async () => storage,
    table: () => current,
    defaultFolder: () => join(dir, "documents"),
    now: () => new Date(2026, 9, 28),
  });

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "sheetstamp-export-session-"));
    await mkdir(join(dir, "documents"));
    const docx = join(dir, "mau.docx");
    await writeFile(docx, await makeDocx({ body: paragraph(run("{{ho_ten}} {{chuc_vu}}")) }));
    storage = await openStorage(join(dir, "data"));
    const made = await storage.createTemplate({
      name: "Giấy xác nhận",
      kind: "word",
      sourcePath: docx,
      tags: [
        { name: "ho_ten", label: "Họ tên" },
        { name: "chuc_vu", label: "Chức vụ" },
      ],
      mapping: {
        ho_ten: { kind: "column", column: "Họ tên" },
        chuc_vu: { kind: "column", column: "Chức vụ" },
      },
    });
    templateId = made.id;
    current = { ...table, rows: table.rows.slice(0, 2) };
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("opens with the default pattern for this template, the stored options and the documents folder", async () => {
    const opened = await new ExportSession(deps()).open(templateId);
    expect(opened).toMatchObject({
      ok: true,
      view: {
        templateName: "Giấy xác nhận",
        pattern: "{{ho_ten}}",
        removeDiacritics: false,
        folder: join(dir, "documents"),
        rowCount: 2,
      },
    });
  });

  it("refuses without data or with an unknown template", async () => {
    const session = new ExportSession(deps());
    expect(await session.open("nope")).toEqual({ ok: false, code: "no-template" });
    current = undefined;
    expect(await session.open(templateId)).toEqual({ ok: false, code: "no-data" });
  });

  it("builds the example from the first row with the real planner and the option", async () => {
    const session = new ExportSession(deps());
    expect(
      await session.example({
        templateId,
        pattern: "{{ho_ten}}_Thử việc",
        removeDiacritics: false,
      }),
    ).toEqual({
      ok: true,
      problems: [],
      example: "Nguyễn Văn An_Thử việc.docx",
    });
    expect(
      await session.example({ templateId, pattern: "{{ho_ten}}_Thử việc", removeDiacritics: true }),
    ).toMatchObject({
      example: "Nguyen Van An_Thu viec.docx",
    });
  });

  it("returns the problems of the pattern and no example", async () => {
    const session = new ExportSession(deps());
    for (const [pattern, problem] of [
      ["", { kind: "empty" }],
      ["{{ho_ten}}/x", { kind: "path-characters", text: "/x" }],
      ["a\\b", { kind: "path-characters", text: "a\\b" }],
      ["{{ho_ten}}..", { kind: "path-characters", text: ".." }],
      ["{{khong_co}}", { kind: "unknown-field", key: "khong_co" }],
    ] as const) {
      const result = await session.example({ templateId, pattern, removeDiacritics: false });
      expect(result).toEqual({ ok: true, problems: [problem], example: null });
    }
  });

  it("saves a valid pattern with the template and refuses an invalid one", async () => {
    const session = new ExportSession(deps());
    expect(await session.savePattern(templateId, "{{chuc_vu}}_{{ho_ten}}")).toEqual({ ok: true });
    expect((await storage.getTemplate(templateId))?.filenamePattern).toBe("{{chuc_vu}}_{{ho_ten}}");
    expect(await session.savePattern(templateId, "../x")).toEqual({
      ok: false,
      code: "invalid-pattern",
    });
    expect((await storage.getTemplate(templateId))?.filenamePattern).toBe("{{chuc_vu}}_{{ho_ten}}");
  });

  it("remembers a folder only when it is a directory", async () => {
    const session = new ExportSession(deps());
    expect(await session.rememberFolder(join(dir, "missing"))).toBe(false);
    expect(await session.rememberFolder(dir)).toBe(true);
    expect(await session.folder()).toBe(dir);
    await rm(dir, { recursive: true, force: true });
    expect(await session.folder()).toBe(join(dir, "documents"));
  });
});
