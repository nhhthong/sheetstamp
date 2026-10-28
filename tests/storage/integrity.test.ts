// Review findings 2, 5, 6, 7, 11: data integrity of the storage and the code that edits through it.
import * as fsp from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openMapping, setMappingEntry } from "../../src/main/mapping/session";
import { makeDocx, paragraph, run } from "../../src/main/selftest/make-docx";
import { openStorage, type Storage } from "../../src/main/storage";
import {
  createGroup,
  deleteGroup,
  renameGroup,
  updateTemplate,
} from "../../src/main/templates/edit";
import { getTemplate, listTemplates } from "../../src/main/templates/library";

let root: string;
let dataDir: string;
beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), "sheetstamp-integrity-"));
  dataDir = path.join(root, "data");
});
afterEach(() => fsp.rm(root, { recursive: true, force: true }));

const docxBytes = (text: string) => makeDocx({ body: paragraph(run(text)) });
const sources = () => fsp.readdir(path.join(dataDir, "sources"));
const table = { fileName: "f.csv", columns: ["C"], rows: [["1"]], numericColumns: [false] };

async function withTemplate(s: Storage) {
  return s.createTemplate({
    name: "Mẫu",
    kind: "word",
    tags: [{ name: "x", label: "X" }],
    source: { bytes: await docxBytes("{{x}}"), fileName: "a.docx" },
  });
}

describe("finding 2: replacing the source file", () => {
  it("a failed commit keeps the old record AND the old file; no new copy is left", async () => {
    const good = await openStorage(dataDir);
    const t = await withTemplate(good);
    const before = await good.readSource(t.id);

    let renames = 0;
    const flaky = await openStorage(dataDir, {
      // rename 1 stores the new copy, rename 2 would commit templates.json: fail that one.
      rename: async (from, to) => {
        if (++renames === 2) throw new Error("simulated crash");
        await fsp.rename(from, to);
      },
    });
    await expect(
      flaky.updateTemplate(
        t.id,
        { tags: [{ name: "y", label: "Y" }], mapping: {} },
        { bytes: Buffer.from("NEW FILE"), fileName: "b.docx" },
      ),
    ).rejects.toThrow("simulated crash");

    const reopened = await openStorage(dataDir);
    const after = await reopened.getTemplate(t.id);
    expect(after?.tags).toEqual(t.tags);
    expect(after?.sourceCopy).toBe(t.sourceCopy);
    expect(Buffer.compare(await reopened.readSource(t.id), before)).toBe(0);
    expect(await sources()).toEqual([path.basename(t.sourceCopy)]);
  });

  it("source, tags and mapping change together, and the old file goes only after the commit", async () => {
    const s = await openStorage(dataDir);
    const t = await withTemplate(s);
    const updated = await s.updateTemplate(
      t.id,
      { tags: [{ name: "y", label: "Y" }], mapping: { y: { kind: "empty" } } },
      { bytes: Buffer.from("V2"), fileName: "b.docx" },
    );
    const reopened = await openStorage(dataDir);
    expect(await reopened.getTemplate(t.id)).toEqual(updated);
    expect(updated.tags).toEqual([{ name: "y", label: "Y" }]);
    expect((await reopened.readSource(t.id)).toString()).toBe("V2");
    expect(await sources()).toEqual([path.basename(updated.sourceCopy)]);
  });

  it("the edit flow through templates/edit.ts keeps the old file when the commit fails", async () => {
    const good = await openStorage(dataDir);
    const t = await withTemplate(good);
    const before = await good.readSource(t.id);
    const next = path.join(root, "v2.docx");
    await fsp.writeFile(next, await docxBytes("{{x}} {{z}}"));
    let renames = 0;
    const flaky = await openStorage(dataDir, {
      rename: async (from, to) => {
        if (++renames === 2) throw new Error("simulated crash");
        await fsp.rename(from, to);
      },
    });
    const result = await updateTemplate(flaky, {
      id: t.id,
      name: "Mẫu mới",
      groupId: "ungrouped",
      note: "",
      filenamePattern: "{{x}}",
      labels: {},
      replacePath: next,
    });
    expect(result.ok).toBe(false);
    const reopened = await openStorage(dataDir);
    expect((await reopened.getTemplate(t.id))?.name).toBe("Mẫu");
    expect(Buffer.compare(await reopened.readSource(t.id), before)).toBe(0);
  });
});

describe("finding 5: group rules run inside the storage queue", () => {
  it("two concurrent creates of the same name (any case) leave exactly one", async () => {
    const s = await openStorage(dataDir);
    const results = await Promise.all([
      createGroup(s, "Hop dong x"),
      createGroup(s, "hop dong X"),
      createGroup(s, " HOP DONG x "),
    ]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok).map((r) => !r.ok && r.message)).toEqual([
      "Đã có nhóm tên này. Đặt tên khác.",
      "Đã có nhóm tên này. Đặt tên khác.",
    ]);
    expect(
      (await s.listGroups()).filter((g) => g.name.toLowerCase().startsWith("hop")),
    ).toHaveLength(1);
  });

  it("two concurrent deletes: one succeeds with the right count, the other says the group is gone", async () => {
    const s = await openStorage(dataDir);
    const g = await s.createGroup("G");
    await s.createTemplate({
      name: "A",
      kind: "word",
      groupId: g.id,
      source: { bytes: await docxBytes("a"), fileName: "a.docx" },
    });
    const results = await Promise.all([deleteGroup(s, g.id), deleteGroup(s, g.id)]);
    expect(results.find((r) => r.ok)).toEqual({ ok: true, value: { moved: 1 } });
    expect(results.find((r) => !r.ok)).toEqual({
      ok: false,
      message: "Nhóm không tồn tại. Có thể nhóm đã bị xóa.",
    });
  });

  it("maps empty, reserved, duplicate and missing to their messages", async () => {
    const s = await openStorage(dataDir);
    const g = await s.createGroup("Khác");
    const msg = async (p: Promise<{ ok: boolean }>) => {
      const r = (await p) as { ok: false; message: string };
      return r.message;
    };
    expect(await msg(createGroup(s, "   "))).toBe("Nhập tên nhóm.");
    expect(await msg(createGroup(s, "chưa phân nhóm"))).toContain("dành cho mẫu không có nhóm");
    expect(await msg(renameGroup(s, g.id, "HỢP ĐỒNG"))).toBe("Đã có nhóm tên này. Đặt tên khác.");
    expect(await msg(renameGroup(s, "nope", "Mới"))).toBe(
      "Nhóm không tồn tại. Có thể nhóm đã bị xóa.",
    );
    await expect(s.createGroup("Khác")).rejects.toMatchObject({ code: "duplicate" });
  });
});

describe("finding 6: mapping writes go through the storage queue", () => {
  it("an edit that started before a mapping change does not overwrite it", async () => {
    const s = await openStorage(dataDir);
    const t = await withTemplate(s);
    const group = (await s.listGroups())[0]?.id as string;

    let release: () => void = () => {};
    const gate = new Promise<void>((r) => {
      release = r;
    });
    // The edit stalls after it read the template, exactly where a stale write used to come from.
    const slow = Object.create(s) as Storage;
    slow.listGroups = async () => {
      await gate;
      return s.listGroups();
    };
    const editing = updateTemplate(slow, {
      id: t.id,
      name: "Mẫu",
      groupId: group,
      note: "n",
      filenamePattern: "{{x}}",
      labels: {},
      replacePath: null,
    });
    await new Promise((r) => setTimeout(r, 20));
    await setMappingEntry(s, table, {
      templateId: t.id,
      key: "x",
      entry: { kind: "column", column: "C" },
    });
    release();
    expect((await editing).ok).toBe(true);
    const saved = await s.getTemplate(t.id);
    expect(saved?.mapping).toEqual({ x: { kind: "column", column: "C" } });
    expect(saved?.note).toBe("n");
  });

  it("concurrent entry saves and an open all survive", async () => {
    const s = await openStorage(dataDir);
    const t = await s.createTemplate({
      name: "Hai trường",
      kind: "word",
      tags: [
        { name: "a", label: "A" },
        { name: "b", label: "B" },
      ],
      source: { bytes: await docxBytes("{{a}}{{b}}"), fileName: "a.docx" },
    });
    const two = { ...table, columns: ["C", "D"] };
    await Promise.all([
      setMappingEntry(s, two, {
        templateId: t.id,
        key: "a",
        entry: { kind: "column", column: "C" },
      }),
      setMappingEntry(s, two, {
        templateId: t.id,
        key: "b",
        entry: { kind: "column", column: "D" },
      }),
      s.updateTemplate(t.id, { note: "x" }),
    ]);
    expect((await s.getTemplate(t.id))?.mapping).toEqual({
      a: { kind: "column", column: "C" },
      b: { kind: "column", column: "D" },
    });
    expect((await openMapping(s, two, t.id)).ok).toBe(true);
  });

  it("patchMapping refuses an invalid result and writes nothing for null", async () => {
    const s = await openStorage(dataDir);
    const t = await withTemplate(s);
    await expect(
      s.patchMapping(t.id, () => ({ x: { kind: "nope" } }) as never),
    ).rejects.toMatchObject({
      code: "invalid",
    });
    expect(await s.patchMapping(t.id, () => null)).toEqual(t);
    await expect(s.patchMapping("missing", () => null)).rejects.toMatchObject({
      code: "not-found",
    });
  });
});

describe("finding 7: the stored bytes are the bytes that were checked", () => {
  it("createTemplate stores exactly the bytes it was given; the file on disk is not consulted", async () => {
    const onDisk = path.join(root, "a.docx");
    await fsp.writeFile(onDisk, "CHECKED");
    const checked = await fsp.readFile(onDisk);
    await fsp.writeFile(onDisk, "SWAPPED AFTER THE CHECK");
    const s = await openStorage(dataDir);
    const t = await s.createTemplate({
      name: "T",
      kind: "word",
      source: { bytes: checked, fileName: onDisk },
    });
    expect((await s.readSource(t.id)).toString()).toBe("CHECKED");
    expect(t.sourceFileName).toBe("a.docx");
  });

  it("a hostile file name cannot change where the copy goes", async () => {
    const s = await openStorage(dataDir);
    const t = await s.createTemplate({
      name: "T",
      kind: "word",
      source: { bytes: Buffer.from("x"), fileName: "../../evil.d/../ocx" },
    });
    expect(t.sourceCopy).toMatch(/^sources\/[^/\\]+$/);
    expect(await fsp.readdir(root)).toEqual(["data"]);
  });
});

describe("finding 11: one bad record does not hide the others", () => {
  it("skips records with bad tags, bad mapping or an escaping sourceCopy; keeps the rest and warns", async () => {
    const s = await openStorage(dataDir);
    const keep = await withTemplate(s);
    const bad = await Promise.all(
      ["tags", "mapping", "sourceCopy", "traversal"].map(() => withTemplate(s)),
    );
    const file = path.join(dataDir, "templates.json");
    const json = JSON.parse(await fsp.readFile(file, "utf8"));
    const byId = (id: string) => json.data.find((t: { id: string }) => t.id === id);
    byId(bad[0]?.id as string).tags = [null];
    byId(bad[1]?.id as string).mapping = { x: { kind: "column" } };
    byId(bad[2]?.id as string).sourceCopy = "../../etc/passwd";
    byId(bad[3]?.id as string).sourceCopy = "sources/..";
    const edited = `${JSON.stringify(json)}\n`;
    await fsp.writeFile(file, edited);

    const reopened = await openStorage(dataDir);
    expect(reopened.warnings).toHaveLength(1);
    expect(reopened.warnings[0]).toMatchObject({ code: "invalid-record", file: "templates.json" });
    expect(reopened.warnings[0]?.message).toContain("4 mục");
    expect((await reopened.listTemplates()).map((t) => t.id)).toEqual([keep.id]);
    // The library code that used to throw on tags:[null] works.
    expect(await listTemplates(reopened)).toHaveLength(1);
    expect(await getTemplate(reopened, keep.id)).not.toBeNull();
    // The hand-edited original is kept aside, and the next start is clean.
    expect(await fsp.readFile(path.join(dataDir, "templates.json.bak"), "utf8")).toBe(edited);
    expect((await openStorage(dataDir)).warnings).toEqual([]);
  });

  it("a plain valid library gives no warning", async () => {
    const s = await openStorage(dataDir);
    await withTemplate(s);
    expect((await openStorage(dataDir)).warnings).toEqual([]);
  });
});
