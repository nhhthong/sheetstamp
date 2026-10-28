import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExportProgress } from "../../shared/ipc/export";
import type { DataTable } from "../data";
import type { BatchRequest } from "../export/batch";
import { ExportCancelledError, type ExportResult } from "../export/zip";
import { makeDocx, paragraph, run } from "../selftest/make-docx";
import { openStorage, type Storage } from "../storage";
import { buildRows, hasUnwritableCharacter } from "./rows";
import { ExportSession, effectivePattern, type SessionDeps, zipNameFor } from "./session";
import { throttle } from "./throttle";

describe("throttle", () => {
  it("lets the first call through and holds the rest of the same interval", () => {
    let t = 0;
    const seen: number[] = [];
    const send = throttle(
      (v: number) => seen.push(v),
      100,
      () => t,
    );
    for (let i = 0; i < 4000; i++) send(i);
    expect(seen).toEqual([0]);
    t = 100;
    send(4000);
    expect(seen).toEqual([0, 4000]);
  });

  it("sends about ten a second for 4,000 rows spread over ten seconds", () => {
    let t = 0;
    let count = 0;
    const send = throttle(
      () => count++,
      100,
      () => t,
    );
    for (let i = 0; i < 4000; i++) {
      t = i * 2.5;
      send(i);
    }
    expect(count).toBeGreaterThanOrEqual(95);
    expect(count).toBeLessThanOrEqual(101);
  });

  it("flush sends the held value once", () => {
    let t = 0;
    const seen: number[] = [];
    const send = throttle(
      (v: number) => seen.push(v),
      100,
      () => t,
    );
    send(1);
    send(2);
    send.flush();
    send.flush();
    expect(seen).toEqual([1, 2]);
  });
});

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
  let requests: BatchRequest[];
  let progress: ExportProgress[];
  let gate: Promise<void> | undefined;
  let behaviour: (request: BatchRequest) => Promise<ExportResult>;

  const deps = (): SessionDeps => ({
    storage: async () => storage,
    table: () => current,
    run: async (request) => {
      requests.push(request);
      if (gate) await gate;
      return behaviour(request);
    },
    defaultFolder: () => join(dir, "documents"),
    onProgress: (p) => progress.push(p),
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
    requests = [];
    progress = [];
    gate = undefined;
    behaviour = async (request) => ({
      zipPath: join(request.folder, request.zipName),
      written: request.rows.length,
      failed: [],
    });
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

  it("runs the batch with the mapped rows, the stored template and the dated ZIP name, then marks the template used", async () => {
    const session = new ExportSession(deps());
    const result = await session.start({
      templateId,
      pattern: "{{ho_ten}}",
      removeDiacritics: true,
    });
    expect(result).toEqual({
      ok: true,
      done: {
        zipPath: join(dir, "documents", "Giấy xác nhận 2026-10-28.zip"),
        written: 2,
        failed: 0,
        hasReport: false,
      },
    });
    const [request] = requests;
    expect(request?.rows).toEqual([
      { rowNumber: 1, values: { ho_ten: "Nguyễn Văn An", chuc_vu: "Kế toán" } },
      { rowNumber: 2, values: { ho_ten: "Trần Thị Bình", chuc_vu: "" } },
    ]);
    expect(request).toMatchObject({
      pattern: "{{ho_ten}}",
      extension: ".docx",
      removeDiacritics: true,
      folder: join(dir, "documents"),
      zipName: "Giấy xác nhận 2026-10-28.zip",
    });
    expect(request?.init.kind).toBe("word");
    expect(request?.signal).toBeInstanceOf(AbortSignal);
    expect(progress[0]).toEqual({ done: 0, total: 2, failed: 0 });
    const stored = await storage.getTemplate(templateId);
    expect(stored?.lastUsedAt).not.toBeNull();
    expect((await storage.getChoices()).lastOutputFolder).toBe(join(dir, "documents"));
    expect(session.pathToReveal("zip")).toBe(
      join(dir, "documents", "Giấy xác nhận 2026-10-28.zip"),
    );
  });

  it("refuses an invalid pattern, no data and an unknown template before any work", async () => {
    const session = new ExportSession(deps());
    expect(await session.start({ templateId, pattern: "{{x}}", removeDiacritics: false })).toEqual({
      ok: false,
      code: "invalid-pattern",
    });
    expect(
      await session.start({ templateId: "nope", pattern: "{{ho_ten}}", removeDiacritics: false }),
    ).toEqual({
      ok: false,
      code: "no-template",
    });
    current = undefined;
    expect(
      await session.start({ templateId, pattern: "{{ho_ten}}", removeDiacritics: false }),
    ).toEqual({
      ok: false,
      code: "no-data",
    });
    expect(requests).toEqual([]);
    expect(session.running).toBe(false);
  });

  it("refuses a second start while one runs, then accepts one", async () => {
    let release = () => {};
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const session = new ExportSession(deps());
    const first = session.start({ templateId, pattern: "{{ho_ten}}", removeDiacritics: false });
    const second = await session.start({
      templateId,
      pattern: "{{ho_ten}}",
      removeDiacritics: false,
    });
    expect(second).toEqual({ ok: false, code: "busy" });
    expect(session.running).toBe(true);
    release();
    expect((await first).ok).toBe(true);
    expect(session.running).toBe(false);
    gate = undefined;
    expect(
      (await session.start({ templateId, pattern: "{{ho_ten}}", removeDiacritics: false })).ok,
    ).toBe(true);
  });

  it("copies the rows at the start: a data or mapping change during the run does not reach it", async () => {
    let release = () => {};
    gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const session = new ExportSession(deps());
    const running = session.start({ templateId, pattern: "{{ho_ten}}", removeDiacritics: false });
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    const taken = requests[0]?.rows.map((r) => ({ ...r.values }));
    current = { ...table, rows: [["Người Khác", "x"]] };
    await storage.updateTemplate(templateId, { mapping: {} });
    release();
    await running;
    expect(requests[0]?.rows.map((r) => r.values)).toEqual(taken);
    expect(requests[0]?.rows).toHaveLength(2);
  });

  it("cancel aborts the batch signal and the result is canceled, with the session free again", async () => {
    gate = undefined;
    behaviour = (request) =>
      new Promise((_resolve, reject) => {
        request.signal?.addEventListener("abort", () => reject(new ExportCancelledError()));
      });
    const session = new ExportSession(deps());
    const running = session.start({ templateId, pattern: "{{ho_ten}}", removeDiacritics: false });
    await vi.waitFor(() => expect(requests).toHaveLength(1));
    session.cancel();
    expect(await running).toEqual({ ok: false, canceled: true });
    await session.settled();
    expect(session.running).toBe(false);
    expect((await storage.getTemplate(templateId))?.lastUsedAt).toBeNull();
    expect(session.pathToReveal("zip")).toBeNull();
  });

  it("maps a disk problem to a code and keeps the session usable", async () => {
    behaviour = async () => {
      throw Object.assign(new Error("full"), { code: "ENOSPC" });
    };
    const session = new ExportSession(deps());
    expect(
      await session.start({ templateId, pattern: "{{ho_ten}}", removeDiacritics: false }),
    ).toEqual({
      ok: false,
      code: "write-failed",
    });
    behaviour = async () => {
      throw Object.assign(new Error("denied"), { code: "EACCES" });
    };
    expect(
      await session.start({ templateId, pattern: "{{ho_ten}}", removeDiacritics: false }),
    ).toEqual({
      ok: false,
      code: "bad-folder",
    });
  });

  it("reports failed rows and the report, and drops an empty ZIP", async () => {
    behaviour = async (request) => ({
      zipPath: join(request.folder, request.zipName),
      written: 1,
      failed: [{ row: 2, code: "missing-tag" }],
      reportPath: join(request.folder, "r-errors.csv"),
    });
    const session = new ExportSession(deps());
    expect(
      await session.start({ templateId, pattern: "{{ho_ten}}", removeDiacritics: false }),
    ).toMatchObject({
      ok: true,
      done: { written: 1, failed: 1, hasReport: true },
    });
    expect(session.pathToReveal("report")).toBe(join(dir, "documents", "r-errors.csv"));

    const empty = join(dir, "documents", "empty.zip");
    await writeFile(empty, "");
    behaviour = async (request) => ({
      zipPath: empty,
      written: 0,
      failed: [
        { row: 1, code: "missing-tag" },
        { row: 2, code: "missing-tag" },
      ],
      reportPath: join(request.folder, "e-errors.csv"),
    });
    const none = await session.start({
      templateId,
      pattern: "{{ho_ten}}",
      removeDiacritics: false,
    });
    expect(none).toMatchObject({ ok: true, done: { zipPath: null, written: 0, failed: 2 } });
    const { existsSync } = await import("node:fs");
    expect(existsSync(empty)).toBe(false);
  });

  it("a 4,000-row progress storm reaches the renderer at about ten a second", async () => {
    vi.useFakeTimers();
    try {
      current = { ...table, rows: Array.from({ length: 4000 }, () => ["A", "B"]) };
      behaviour = async (request) => {
        for (let i = 1; i <= 4000; i++) {
          vi.setSystemTime(Date.now() + 2.5);
          request.onProgress?.({ done: i, total: 4000, failed: 0 });
        }
        return { zipPath: join(request.folder, request.zipName), written: 4000, failed: [] };
      };
      const session = new ExportSession(deps());
      await session.start({ templateId, pattern: "{{ho_ten}}", removeDiacritics: false });
      expect(progress.length).toBeGreaterThan(80);
      expect(progress.length).toBeLessThan(110);
    } finally {
      vi.useRealTimers();
    }
  });
});
