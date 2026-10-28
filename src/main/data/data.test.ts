import { describe, expect, it } from "vitest";
import {
  encodeWindows1258,
  fakeXls,
  makeXlsx,
  toCsv,
  utf16le,
  utf8,
  utf8Bom,
  VIETNAMESE_ROWS,
} from "../../../tests/fixtures/data/make-data";
import {
  DataError,
  listSheets,
  loadTable,
  MAX_FILE_BYTES,
  MAX_ROWS,
  padColumn,
  previewRows,
  scanTable,
} from "./index";

const text = toCsv(VIETNAMESE_ROWS);
const expectedRows = VIETNAMESE_ROWS.slice(1);
const code = async (promise: Promise<unknown>) =>
  promise.then(
    () => "no error",
    (error: unknown) => (error instanceof DataError ? error.code : String(error)),
  );

describe("encoding", () => {
  it.each([
    ["UTF-8 without BOM", utf8(text), "utf-8"],
    ["UTF-8 with BOM", utf8Bom(text), "utf-8"],
    ["UTF-16 LE with BOM", utf16le(text), "utf-16le"],
    ["Windows-1258", encodeWindows1258(text), "windows-1258"],
  ])("reads %s into the same NFC text", async (_name, bytes, encoding) => {
    const table = await loadTable("data.csv", bytes);
    expect(table.encoding).toBe(encoding);
    expect(table.columns).toEqual(VIETNAMESE_ROWS[0]);
    expect(table.rows).toEqual(expectedRows);
  });

  it("falls back to Windows-1258 only when the bytes are not valid UTF-8", () => {
    expect(() => new TextDecoder("utf-8", { fatal: true }).decode(encodeWindows1258(text))).toThrow();
  });

  it("lets the user override the guess", async () => {
    const table = await loadTable("data.csv", utf8(text), { encoding: "windows-1258" });
    expect(table.encoding).toBe("windows-1258");
    expect(table.rows).not.toEqual(expectedRows); // wrong choice shows garbled text, as the UI preview will
  });

  it("normalizes decomposed input to NFC", async () => {
    const table = await loadTable("data.csv", utf8(toCsv(VIETNAMESE_ROWS).normalize("NFD")));
    expect(table.rows).toEqual(expectedRows);
    expect(table.columns).toEqual(VIETNAMESE_ROWS[0]);
  });
});

describe("csv", () => {
  it.each([";", "\t", "|", ","])("detects the delimiter %j", async (delimiter) => {
    const table = await loadTable("data.csv", utf8(toCsv(VIETNAMESE_ROWS, delimiter)));
    expect(table.columns).toHaveLength(3);
    expect(table.rows).toEqual(expectedRows);
  });

  it("keeps quoted delimiters, pads short rows, drops empty rows", async () => {
    const raw = 'a,b,c\r\n"x, y",2\r\n\r\n,,\r\n4,5,6\r\n';
    const table = await loadTable("data.csv", utf8(raw));
    expect(table.rows).toEqual([["x, y", "2", ""], ["4", "5", "6"]]);
  });

  it("names blank and repeated headers", async () => {
    const table = await loadTable("data.csv", utf8("Tên,,Tên\r\na,b,c\r\n"));
    expect(table.columns).toEqual(["Tên", "Cột 2", "Tên (2)"]);
  });

  it("keeps leading zeros in text", async () => {
    const table = await loadTable("data.csv", utf8("CCCD\r\n001234567890\r\n"));
    expect(table.rows).toEqual([["001234567890"]]);
  });

  it("rejects a file with only a header", async () => {
    expect(await code(loadTable("data.csv", utf8("a,b\r\n")))).toBe("empty");
  });
});

describe("xlsx", () => {
  const workbook = () =>
    makeXlsx([
      {
        name: "Nhân viên",
        rows: [
          ["Mã", "Điện thoại", "Ngày sinh", "Lương", "Số HĐ"],
          [1234, 912345678, new Date(Date.UTC(2026, 9, 26)), 1234567.5, "001234"],
        ],
        numFmt: { 0: "00000", 1: "0000000000", 2: "dd/mm/yyyy", 3: "#,##0.00" },
      },
      { name: "Phụ", rows: [["X"], ["y"]] },
    ]);

  it("shows cells as Excel does, not as raw numbers", async () => {
    const table = await loadTable("data.xlsx", await workbook());
    expect(table.sheet).toBe("Nhân viên");
    expect(table.rows).toEqual([["01234", "0912345678", "26/10/2026", "1,234,567.50", "001234"]]);
  });

  it("lists sheets and reads the one chosen", async () => {
    const bytes = await workbook();
    expect(await listSheets(bytes)).toEqual(["Nhân viên", "Phụ"]);
    const table = await loadTable("data.xlsx", bytes, { sheet: "Phụ" });
    expect(table.rows).toEqual([["y"]]);
  });

  it("reports an unknown sheet", async () => {
    expect(await code(loadTable("data.xlsx", await workbook(), { sheet: "Không có" }))).toBe("no-such-sheet");
  });

  it("reads formula results and rich text", async () => {
    const bytes = await makeXlsx([
      {
        name: "S",
        rows: [["A", "B"], [{ formula: "1+1", result: 2 }, { richText: [{ text: "Xin " }, { text: "chào" }] }]],
      },
    ]);
    const table = await loadTable("data.xlsx", bytes);
    expect(table.rows).toEqual([["2", "Xin chào"]]);
  });
});

describe("rejections", () => {
  it("rejects .xls by extension", async () => {
    expect(await code(loadTable("old.xls", fakeXls()))).toBe("xls-unsupported");
  });

  it.each(["renamed.xlsx", "renamed.csv"])("rejects a legacy .xls renamed to %s", async (name) => {
    expect(await code(loadTable(name, fakeXls()))).toBe("xls-unsupported");
  });

  it("rejects an .xlsx that is not a zip", async () => {
    expect(await code(loadTable("a.xlsx", utf8("hello")))).toBe("not-a-spreadsheet");
  });

  it("rejects a zip named .csv and unknown extensions", async () => {
    const zip = await makeXlsx([{ name: "S", rows: [["a"], ["b"]] }]);
    expect(await code(loadTable("a.csv", zip))).toBe("not-a-spreadsheet");
    expect(await code(loadTable("a.pdf", utf8("x")))).toBe("not-a-spreadsheet");
  });

  it("reports a corrupt .xlsx as unreadable", async () => {
    const bytes = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3, 4]);
    expect(await code(loadTable("a.xlsx", bytes))).toBe("unreadable");
  });

  it("refuses a file over 20 MB", async () => {
    expect(await code(loadTable("a.csv", new Uint8Array(MAX_FILE_BYTES + 1)))).toBe("too-large");
  });

  it("refuses more than 50,000 data rows", async () => {
    const rows = Array.from({ length: MAX_ROWS + 1 }, (_, i) => `${i}`).join("\n");
    expect(await code(loadTable("a.csv", utf8(`n\n${rows}`)))).toBe("too-many-rows");
  });
});

describe("scan and zero padding", () => {
  it("warns about empty cells and mixed types", async () => {
    const table = await loadTable("a.csv", utf8("Tên,Tuổi\r\nA,30\r\nB,\r\nC,abc\r\n"));
    const { warnings } = scanTable(table);
    expect(warnings).toContainEqual({ kind: "empty-cells", column: "Tuổi", count: 1 });
    expect(warnings).toContainEqual({ kind: "mixed-types", column: "Tuổi" });
  });

  it("flags an ID column stored as a number and pads it on request", async () => {
    const bytes = await makeXlsx([
      { name: "S", rows: [["Họ tên", "CCCD", "Số lượng"], ["A", 1234567890, 3], ["B", 98765432101, 4]] },
    ]);
    const table = await loadTable("a.xlsx", bytes);
    const { warnings } = scanTable(table);
    expect(warnings).toContainEqual({ kind: "id-stored-as-number", column: "CCCD", width: 11 });
    expect(warnings.some((w) => w.kind === "id-stored-as-number" && w.column === "Số lượng")).toBe(false);

    const padded = padColumn(table, 1, 12);
    expect(padded.rows).toEqual([["A", "001234567890", "3"], ["B", "098765432101", "4"]]);
    expect(table.rows[0]?.[1]).toBe("1234567890"); // the original table is untouched
  });

  it("does not flag an ID column read as text", async () => {
    const table = await loadTable("a.csv", utf8("CCCD\r\n001234567890\r\n"));
    expect(scanTable(table).warnings).toEqual([]);
  });
});

describe("size", () => {
  const rows = Array.from({ length: 4000 }, (_, i) => [`NV${i}`, `Nguyễn Văn ${i}`, "Hà Nội", `${i}`]);

  it("shows five preview rows", async () => {
    const table = await loadTable("a.csv", utf8(toCsv([["Mã", "Tên", "Nơi", "Số"], ...rows])));
    expect(previewRows(table)).toHaveLength(5);
    expect(table.rows).toHaveLength(4000);
  });

  it("loads 4,000 rows in under a second", async () => {
    const header = ["Mã", "Tên", "Nơi", "Số"];
    const csv = utf8(toCsv([header, ...rows]));
    const xlsx = await makeXlsx([{ name: "S", rows: [header, ...rows] }]);
    for (const [name, bytes] of [["a.csv", csv], ["a.xlsx", xlsx]] as const) {
      const start = performance.now();
      const table = await loadTable(name, bytes);
      expect(table.rows).toHaveLength(4000);
      expect(performance.now() - start).toBeLessThan(1000);
    }
  });
});
