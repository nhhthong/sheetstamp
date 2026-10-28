import { mkdtemp, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  encodeWindows1258,
  fakeXls,
  makeXlsx,
  toCsv,
  VIETNAMESE_ROWS,
} from "../../../tests/fixtures/data/make-data";
import type { DataResult, DataSnapshot } from "../../shared/ipc/data";
import { DataSession, suggestWidth } from "./session";

let dir: string;
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "sheetstamp-session-"));
});
afterAll(() => rm(dir, { recursive: true, force: true }));

const write = async (name: string, bytes: Uint8Array) => {
  const path = join(dir, name);
  await writeFile(path, bytes);
  return path;
};
const snapshotOf = (result: DataResult): DataSnapshot => {
  if (!result.ok) throw new Error(`expected a snapshot, got ${JSON.stringify(result)}`);
  return result.snapshot;
};

describe("DataSession", () => {
  it("opens a Windows-1258 CSV, then re-decodes it with another encoding", async () => {
    const path = await write("w1258.csv", encodeWindows1258(toCsv(VIETNAMESE_ROWS)));
    const session = new DataSession();
    const first = snapshotOf(await session.open(path));
    expect(first.encoding).toBe("windows-1258");
    expect(first.previewRows[0]).toEqual(VIETNAMESE_ROWS[1]);
    expect(first.rowCount).toBe(3);
    expect(first.sheets).toEqual([]);

    const wrong = snapshotOf(await session.setEncoding("utf-8"));
    expect(wrong.encoding).toBe("utf-8");
    expect(wrong.previewRows[0]?.[0]).not.toBe("Nguyễn Thị Hương");
    expect(session.table?.encoding).toBe("utf-8");
  });

  it("lists sheets, switches them, and keeps the sheet on reload", async () => {
    const path = await write(
      "two.xlsx",
      await makeXlsx([
        { name: "Tháng 1", rows: [["Tên"], ["An"]] },
        {
          name: "Tháng 2",
          rows: [
            ["Tên", "Lương"],
            ["Bình", "5"],
            ["Chi", "6"],
          ],
        },
      ]),
    );
    const session = new DataSession();
    expect(snapshotOf(await session.open(path)).sheet).toBe("Tháng 1");
    const second = snapshotOf(await session.setSheet("Tháng 2"));
    expect(second.sheets).toEqual(["Tháng 1", "Tháng 2"]);
    expect(second.rowCount).toBe(2);
    expect(snapshotOf(await session.reload()).sheet).toBe("Tháng 2");
    const missing = await session.setSheet("Không có");
    expect(missing).toMatchObject({ ok: false, error: { code: "no-such-sheet" } });
    expect(session.table?.sheet).toBe("Tháng 2");
  });

  it("flags a numeric ID column and pads it, once", async () => {
    const path = await write(
      "ids.xlsx",
      await makeXlsx([
        {
          name: "A",
          rows: [
            ["Họ tên", "CCCD"],
            ["An", 1234567890],
            ["Bình", 79012345678],
          ],
        },
      ]),
    );
    const session = new DataSession();
    const opened = snapshotOf(await session.open(path));
    const warning = opened.warnings.find((w) => w.kind === "id-stored-as-number");
    expect(warning).toMatchObject({ column: "CCCD", columnIndex: 1, suggestedWidth: 12 });
    expect(await session.pad(0, 12)).toMatchObject({ ok: false, error: { code: "bad-column" } });
    const padded = snapshotOf(session.pad(1, 12));
    expect(padded.warnings.find((w) => w.kind === "id-stored-as-number")).toBeUndefined();
    expect(padded.paddedColumns).toEqual([1]);
    expect(padded.previewRows.map((r) => r[1])).toEqual(["001234567890", "079012345678"]);
    expect(session.table?.rows[0]?.[1]).toBe("001234567890");
  });

  it("answers a .xls, also a renamed one, with the Vietnamese message and keeps the old table", async () => {
    const good = await write("good.csv", encodeWindows1258(toCsv(VIETNAMESE_ROWS)));
    const session = new DataSession();
    await session.open(good);
    for (const name of ["old.xls", "renamed.xlsx", "renamed.csv"]) {
      const result = await session.open(await write(name, fakeXls()));
      expect(result).toMatchObject({ ok: false, error: { code: "xls-unsupported" } });
      expect(result.ok === false && "error" in result && result.error.message).toContain(".xls");
    }
    expect(session.table?.fileName).toBe("good.csv");
  });

  it("reports changes on disk and Reload reads them; dropping the same file again resets choices", async () => {
    const path = await write("live.csv", encodeWindows1258(toCsv(VIETNAMESE_ROWS)));
    const session = new DataSession();
    await session.open(path);
    await session.setEncoding("windows-1258");
    expect((await session.current())?.changedOnDisk).toBe(false);

    await write(
      "live.csv",
      encodeWindows1258(toCsv([...VIETNAMESE_ROWS, ["Lê Văn Tám", "Huế", "Kho"]])),
    );
    const later = new Date(Date.now() + 5000);
    await utimes(path, later, later);
    expect((await session.current())?.changedOnDisk).toBe(true);
    const reloaded = snapshotOf(await session.reload());
    expect(reloaded).toMatchObject({ rowCount: 4, changedOnDisk: false, encoding: "windows-1258" });

    const again = snapshotOf(await session.open(path));
    expect(again.encoding).toBe("windows-1258");
    await rm(path);
    expect(await session.reload()).toMatchObject({ ok: false, error: { code: "file-missing" } });
    expect((await session.current())?.changedOnDisk).toBe(true);
  });

  it("rejects relative paths, missing files and directories, and clears", async () => {
    const session = new DataSession();
    expect(await session.open("relative.csv")).toMatchObject({ ok: false });
    expect(await session.open(join(dir, "nope.csv"))).toMatchObject({
      error: { code: "file-missing" },
    });
    expect(await session.open(dir)).toMatchObject({ error: { code: "not-a-spreadsheet" } });
    const path = await write("c.csv", encodeWindows1258(toCsv(VIETNAMESE_ROWS)));
    await session.open(path);
    session.clear();
    expect(session.table).toBeUndefined();
    expect(await session.current()).toBeNull();
    expect(await session.reload()).toMatchObject({ error: { code: "no-file" } });
  });

  it("suggests a width from the header", () => {
    expect(suggestWidth("Số CCCD", 11)).toBe(12);
    expect(suggestWidth("SĐT", 9)).toBe(10);
    expect(suggestWidth("Mã nhân viên", 4)).toBe(4);
  });
});
