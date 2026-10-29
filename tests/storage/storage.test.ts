import { randomBytes } from "node:crypto";
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openStorage, SCHEMA_VERSION, StorageError, UNGROUPED_ID } from "../../src/main/storage";

let root: string;
let dataDir: string;
let sourceFile: string;
const sourceBytes = randomBytes(4096);

beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "sheetstamp-storage-"));
  dataDir = path.join(root, "data");
  await fsp.mkdir(dataDir);
  sourceFile = path.join(root, "Hợp đồng lao động.docx");
  await fsp.writeFile(sourceFile, sourceBytes);
});
afterEach(() => fsp.rm(root, { recursive: true, force: true }));

const listDir = (dir = dataDir) => fsp.readdir(dir);
const newTemplate = () => ({
  name: "Hợp đồng thử việc",
  kind: "word" as const,
  tags: [{ name: "ten", label: "Tên" }],
  mapping: { ten: { kind: "column" as const, column: "Họ tên" } },
  source: { bytes: sourceBytes, fileName: "Hợp đồng lao động.docx" },
});

describe("round trip", () => {
  it("keeps templates, groups, mapping and choices across reopen", async () => {
    const a = await openStorage(dataDir);
    expect(a.warnings).toEqual([]);
    const groups = await a.listGroups();
    expect(groups.map((g) => g.name)).toEqual(["Hợp đồng", "Nghỉ việc", "Tài liệu khác"]);

    const created = await a.createTemplate({ ...newTemplate(), groupId: groups[0]?.id, note: "n" });
    expect(created.filenamePattern).toBe("{{ten}}");
    expect(created.lastUsedAt).toBeNull();
    expect(created.sourceFileName).toBe("Hợp đồng lao động.docx");
    await a.markUsed(created.id);
    await a.setChoices({ lastOutputFolder: "/tmp/out", removeDiacritics: true });
    const extra = await a.createGroup("Khác");

    const b = await openStorage(dataDir);
    expect(await b.listGroups()).toEqual([...groups, extra]);
    const [t] = await b.listTemplates();
    expect(t?.name).toBe("Hợp đồng thử việc");
    expect(t?.tags).toEqual([{ name: "ten", label: "Tên" }]);
    expect(t?.mapping).toEqual({ ten: { kind: "column", column: "Họ tên" } });
    expect(t?.lastUsedAt).not.toBeNull();
    expect(await b.getChoices()).toEqual({
      lastOutputFolder: "/tmp/out",
      lastGroupFilter: null,
      removeDiacritics: true,
      imageFormat: null,
    });
  });

  it("deleting a group moves its templates to Chưa phân nhóm; deleting a template removes its copy", async () => {
    const s = await openStorage(dataDir);
    const [g] = await s.listGroups();
    const t = await s.createTemplate({ ...newTemplate(), groupId: g?.id });
    await s.setChoices({ lastGroupFilter: g?.id ?? null });
    await s.deleteGroup(g?.id ?? "");
    expect((await s.getTemplate(t.id))?.groupId).toBe(UNGROUPED_ID);
    expect((await s.getChoices()).lastGroupFilter).toBeNull();
    await s.deleteTemplate(t.id);
    expect(await s.listTemplates()).toEqual([]);
    expect(await listDir(path.join(dataDir, "sources"))).toEqual([]);
  });

  it("rejects an unknown group and an empty name", async () => {
    const s = await openStorage(dataDir);
    await expect(s.createTemplate({ ...newTemplate(), groupId: "nope" })).rejects.toMatchObject({
      code: "invalid",
    });
    await expect(s.createTemplate({ ...newTemplate(), name: "  " })).rejects.toMatchObject({
      code: "invalid",
    });
    expect(await listDir(path.join(dataDir, "sources"))).toEqual([]);
  });

  it("serializes concurrent writes", async () => {
    const s = await openStorage(dataDir);
    await Promise.all(Array.from({ length: 20 }, (_, i) => s.createGroup(`G${i}`)));
    const names = (await openStorage(dataDir).then((r) => r.listGroups())).map((g) => g.name);
    expect(names).toHaveLength(23);
    expect(new Set(names).size).toBe(23);
  });
});

describe("atomic writes", () => {
  it("a crash between temp write and rename keeps the previous data and leaves no data temp file", async () => {
    const good = await openStorage(dataDir);
    await good.createTemplate(newTemplate());

    let crash = true;
    const flaky = await openStorage(dataDir, {
      rename: async (from, to) => {
        if (crash) throw new Error("simulated crash");
        await fsp.rename(from, to);
      },
    });
    await expect(
      flaky.updateTemplate((await flaky.listTemplates())[0]?.id ?? "", { name: "Mới" }),
    ).rejects.toThrow("simulated crash");
    crash = false;
    // memory was not committed either
    expect((await flaky.listTemplates())[0]?.name).toBe("Hợp đồng thử việc");

    const reopened = await openStorage(dataDir);
    expect(reopened.warnings).toEqual([]);
    expect((await reopened.listTemplates())[0]?.name).toBe("Hợp đồng thử việc");
    expect((await listDir()).filter((f) => f.endsWith(".tmp"))).toEqual([]);
  });

  it("a temp file left by a hard crash is never read as data and is swept on open", async () => {
    const s = await openStorage(dataDir);
    await s.createTemplate(newTemplate());
    const stale = path.join(dataDir, "templates.json.1234.tmp");
    await fsp.writeFile(stale, '{"schemaVersion":1,"data":[]}');
    const again = await openStorage(dataDir);
    expect(again.warnings).toEqual([]);
    expect(await again.listTemplates()).toHaveLength(1);
    expect(await listDir()).not.toContain("templates.json.1234.tmp");
  });
});

describe("corrupt files", () => {
  it("moves a corrupt file to .bak, starts empty and warns; a second time uses a counter", async () => {
    await openStorage(dataDir).then((s) => s.createTemplate(newTemplate()));
    await fsp.writeFile(path.join(dataDir, "templates.json"), "{ not json");
    const a = await openStorage(dataDir);
    expect(a.warnings).toHaveLength(1);
    expect(a.warnings[0]).toMatchObject({
      code: "corrupt-file",
      file: "templates.json",
      movedTo: "templates.json.bak",
    });
    expect(a.warnings[0]?.message).toContain("templates.json.bak");
    expect(await a.listTemplates()).toEqual([]);
    expect(await fsp.readFile(path.join(dataDir, "templates.json.bak"), "utf8")).toBe("{ not json");

    await a.createTemplate(newTemplate()); // writes a fresh templates.json
    await fsp.writeFile(path.join(dataDir, "templates.json"), "garbage 2");
    const b = await openStorage(dataDir);
    expect(b.warnings[0]?.movedTo).toBe("templates.json.bak.1");
    expect(await fsp.readFile(path.join(dataDir, "templates.json.bak"), "utf8")).toBe("{ not json");
    expect(await fsp.readFile(path.join(dataDir, "templates.json.bak.1"), "utf8")).toBe(
      "garbage 2",
    );
  });

  it("settings: default System, remembered across reopen, written atomically", async () => {
    const a = await openStorage(dataDir);
    expect(await a.getSettings()).toEqual({ theme: "system" });
    expect(await listDir()).not.toContain("settings.json");
    await a.setSettings({ theme: "dark" });
    expect((await listDir()).filter((f) => f.startsWith("settings"))).toEqual(["settings.json"]);
    expect(await (await openStorage(dataDir)).getSettings()).toEqual({ theme: "dark" });
    await expect(a.setSettings({ theme: "pink" as never })).rejects.toThrow(StorageError);
    expect(await a.getSettings()).toEqual({ theme: "dark" });
  });

  it("a corrupt or unknown-theme settings.json falls back to System and costs no other file", async () => {
    await fsp.writeFile(path.join(dataDir, "settings.json"), '{"schemaVersion": 1, "data": {oops');
    const s = await openStorage(dataDir);
    expect(s.warnings.map((w) => w.file)).toEqual(["settings.json"]);
    expect(await s.getSettings()).toEqual({ theme: "system" });
    expect(await listDir()).toContain("settings.json.bak");

    await fsp.writeFile(
      path.join(dataDir, "settings.json"),
      JSON.stringify({ schemaVersion: 1, data: { theme: "pink" } }),
    );
    const t = await openStorage(dataDir);
    expect(t.warnings.map((w) => w.file)).toEqual(["settings.json"]);
    expect(await t.getSettings()).toEqual({ theme: "system" });
  });

  it("loads a choices file written before the image format existed, and remembers a chosen format", async () => {
    await fsp.writeFile(
      path.join(dataDir, "choices.json"),
      JSON.stringify({
        schemaVersion: 1,
        data: { lastOutputFolder: "/x", lastGroupFilter: null, removeDiacritics: true },
      }),
    );
    const s = await openStorage(dataDir);
    expect(s.warnings).toEqual([]);
    expect(await s.getChoices()).toEqual({
      lastOutputFolder: "/x",
      lastGroupFilter: null,
      removeDiacritics: true,
      imageFormat: null,
    });
    await s.setChoices({ imageFormat: "jpg" });
    expect((await (await openStorage(dataDir)).getChoices()).imageFormat).toBe("jpg");
  });

  it("an unknown image format in the choices file is corrupt", async () => {
    await fsp.writeFile(
      path.join(dataDir, "choices.json"),
      JSON.stringify({
        schemaVersion: 1,
        data: {
          lastOutputFolder: null,
          lastGroupFilter: null,
          removeDiacritics: false,
          imageFormat: "gif",
        },
      }),
    );
    const s = await openStorage(dataDir);
    expect(s.warnings.map((w) => w.file)).toEqual(["choices.json"]);
  });

  it("treats valid JSON of the wrong shape as corrupt", async () => {
    await fsp.writeFile(
      path.join(dataDir, "choices.json"),
      JSON.stringify({ schemaVersion: 1, data: { x: 1 } }),
    );
    const s = await openStorage(dataDir);
    expect(s.warnings.map((w) => w.file)).toEqual(["choices.json"]);
    expect((await s.getChoices()).removeDiacritics).toBe(false);
  });

  it("templates whose groups file was lost fall back to Chưa phân nhóm", async () => {
    const a = await openStorage(dataDir);
    const [g] = await a.listGroups();
    const t = await a.createTemplate({ ...newTemplate(), groupId: g?.id });
    await fsp.writeFile(path.join(dataDir, "groups.json"), "oops");
    const b = await openStorage(dataDir);
    expect(b.warnings.map((w) => w.file)).toEqual(["groups.json"]);
    expect((await b.getTemplate(t.id))?.groupId).toBe(UNGROUPED_ID);
  });
});

describe("schema version", () => {
  it("refuses a newer version and never overwrites the file", async () => {
    const file = path.join(dataDir, "templates.json");
    const text = JSON.stringify({ schemaVersion: SCHEMA_VERSION + 1, data: [{ future: true }] });
    await fsp.writeFile(file, text);
    await expect(openStorage(dataDir)).rejects.toMatchObject({
      code: "newer-schema",
      file: "templates.json",
    });
    await expect(openStorage(dataDir)).rejects.toBeInstanceOf(StorageError);
    expect(await fsp.readFile(file, "utf8")).toBe(text);
    expect((await listDir()).filter((f) => f.includes(".bak"))).toEqual([]);
  });

  it("stores the version in every file", async () => {
    const s = await openStorage(dataDir);
    await s.createTemplate(newTemplate());
    await s.setChoices({ removeDiacritics: true });
    for (const f of ["templates.json", "groups.json", "choices.json"]) {
      const parsed = JSON.parse(await fsp.readFile(path.join(dataDir, f), "utf8"));
      expect(parsed.schemaVersion).toBe(SCHEMA_VERSION);
    }
  });

  it("runs migrations from an older version, keeps a copy of the old file and rewrites at the new version", async () => {
    const file = path.join(dataDir, "choices.json");
    const old = JSON.stringify({
      schemaVersion: 1,
      data: { outputFolder: "/x", removeDiacritics: true },
    });
    await fsp.writeFile(file, old);
    const s = await openStorage(dataDir, {
      schemaVersion: 2,
      migrations: {
        "choices.json": {
          1: (d) => {
            const o = d as { outputFolder: string; removeDiacritics: boolean };
            return {
              lastOutputFolder: o.outputFolder,
              lastGroupFilter: null,
              removeDiacritics: o.removeDiacritics,
            };
          },
        },
      },
    });
    expect(s.warnings).toEqual([]);
    expect(await s.getChoices()).toEqual({
      lastOutputFolder: "/x",
      lastGroupFilter: null,
      removeDiacritics: true,
      imageFormat: null,
    });
    expect(JSON.parse(await fsp.readFile(file, "utf8")).schemaVersion).toBe(2);
    expect(await fsp.readFile(path.join(dataDir, "choices.json.v1.bak"), "utf8")).toBe(old);
  });

  it("a missing migration step counts as an unreadable file", async () => {
    await fsp.writeFile(
      path.join(dataDir, "choices.json"),
      JSON.stringify({ schemaVersion: 1, data: {} }),
    );
    const s = await openStorage(dataDir, { schemaVersion: 2 });
    expect(s.warnings.map((w) => w.file)).toEqual(["choices.json"]);
  });
});

describe("source copies", () => {
  it("copies the source byte for byte and reads it back; replace keeps the mapping", async () => {
    const s = await openStorage(dataDir);
    const t = await s.createTemplate(newTemplate());
    expect(t.sourceCopy).toMatch(new RegExp(`^sources/${t.id}-[0-9a-f-]{36}\\.docx$`));
    expect(Buffer.compare(await s.readSource(t.id), sourceBytes)).toBe(0);
    expect(Buffer.compare(await fsp.readFile(path.join(dataDir, t.sourceCopy)), sourceBytes)).toBe(
      0,
    );

    const bytes2 = randomBytes(1000);
    const r = await s.updateTemplate(t.id, {}, { bytes: bytes2, fileName: "khac.docx" });
    expect(r.sourceFileName).toBe("khac.docx");
    expect(r.mapping).toEqual(t.mapping);
    expect(r.sourceCopy).not.toBe(t.sourceCopy);
    expect(Buffer.compare(await s.readSource(t.id), bytes2)).toBe(0);
    expect(await listDir(path.join(dataDir, "sources"))).toEqual([path.basename(r.sourceCopy)]);
  });

  it("a failed source write is an error and leaves nothing behind", async () => {
    const s = await openStorage(dataDir, {
      rename: async (from, to) => {
        if (to.includes("sources")) throw new Error("disk full");
        await fsp.rename(from, to);
      },
    });
    await expect(s.createTemplate(newTemplate())).rejects.toThrow("disk full");
    expect(await listDir(path.join(dataDir, "sources"))).toEqual([]);
    expect(await s.listTemplates()).toEqual([]);
  });
});

describe("no spreadsheet data", () => {
  it("nothing from an imported CSV reaches the data folder", async () => {
    const secrets = ["Nguyễn Văn Sentinel", "0912345678-SENTINEL", "luong-9999999-SENTINEL"];
    const csv = path.join(root, "nhan-vien.csv");
    await fsp.writeFile(csv, `Họ tên,SĐT,Lương\n${secrets[0]},${secrets[1]},${secrets[2]}\n`);

    // The app reads the CSV in memory; storage only ever sees headers (mapping) and the template file.
    const s = await openStorage(dataDir);
    await s.createTemplate({
      ...newTemplate(),
      mapping: { ten: { kind: "column", column: "Họ tên" } },
    });
    await s.setChoices({ lastOutputFolder: path.join(root, "out"), removeDiacritics: true });
    await s.markUsed((await s.listTemplates())[0]?.id ?? "");

    const walk = async (dir: string): Promise<string[]> => {
      const out: string[] = [];
      for (const e of await fsp.readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) out.push(...(await walk(p)));
        else out.push(p);
      }
      return out;
    };
    const files = await walk(dataDir);
    expect(files.some((f) => /\.(csv|xlsx|xls)$/i.test(f))).toBe(false);
    for (const f of files) {
      const text = (await fsp.readFile(f)).toString("latin1") + (await fsp.readFile(f, "utf8"));
      for (const secret of secrets) expect(text).not.toContain(secret);
    }
    // Only the expected files exist.
    expect(files.map((f) => path.relative(dataDir, f)).sort()).toEqual(
      ["choices.json", "groups.json", "templates.json"]
        .concat(
          files
            .filter((f) => f.includes(`${path.sep}sources${path.sep}`))
            .map((f) => path.relative(dataDir, f)),
        )
        .sort(),
    );
  });
});
