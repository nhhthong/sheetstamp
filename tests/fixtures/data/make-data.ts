import ExcelJS from "exceljs";
import iconv from "iconv-lite";

/**
 * Windows-1258 writes most Vietnamese letters as a base letter plus a combining mark
 * (for example ễ is ê and a combining tilde), so iconv-lite cannot encode composed text directly.
 * This encoder composes as far as the code page allows and emits the rest as combining marks.
 */
export function encodeWindows1258(text: string): Uint8Array {
  const encodable = (char: string) => iconv.decode(iconv.encode(char, "windows-1258"), "windows-1258") === char;
  const out: Buffer[] = [];
  for (const char of text) {
    if (encodable(char)) {
      out.push(iconv.encode(char, "windows-1258"));
      continue;
    }
    const [base, ...marks] = [...char.normalize("NFD")];
    let current = base as string;
    const rest = [...marks];
    // Fold in any mark that gives a letter the code page has (ộ is ô plus a dot below), whatever the order.
    for (let again = true; again; ) {
      again = false;
      for (const [i, mark] of rest.entries()) {
        const composed = (current + mark).normalize("NFC");
        if ([...composed].length === 1 && encodable(composed)) {
          current = composed;
          rest.splice(i, 1);
          again = true;
          break;
        }
      }
    }
    out.push(iconv.encode(current, "windows-1258"));
    for (const mark of rest) out.push(iconv.encode(mark, "windows-1258"));
  }
  return new Uint8Array(Buffer.concat(out));
}

export const VIETNAMESE_ROWS: string[][] = [
  ["Họ tên", "Địa chỉ", "Phòng ban"],
  ["Nguyễn Thị Hương", "Số 12 Lê Lợi, Hà Nội", "Kế toán"],
  ["Trần Văn Đức", "45 Nguyễn Huệ, TP. Hồ Chí Minh", "Nhân sự"],
  ["Phạm Thị Ngọc Ánh", "Đà Nẵng", "Kinh doanh"],
];

export const toCsv = (rows: string[][], delimiter = ",") =>
  rows.map((row) => row.map((cell) => (/[",;\t\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell)).join(delimiter)).join("\r\n");

export const utf8 = (text: string) => new Uint8Array(Buffer.from(text, "utf8"));
export const utf8Bom = (text: string) => new Uint8Array(Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(text, "utf8")]));
export const utf16le = (text: string) =>
  new Uint8Array(Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(text, "utf16le")]));

export type SheetSpec = {
  name: string;
  rows: ExcelJS.CellValue[][];
  /** Number formats by column index (0-based), applied to every body row. */
  numFmt?: Record<number, string>;
};

export async function makeXlsx(sheets: SheetSpec[]): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  for (const spec of sheets) {
    const sheet = workbook.addWorksheet(spec.name);
    spec.rows.forEach((values, r) => {
      const row = sheet.addRow(values);
      if (r > 0) {
        for (const [col, fmt] of Object.entries(spec.numFmt ?? {})) row.getCell(Number(col) + 1).numFmt = fmt;
      }
    });
  }
  return new Uint8Array(await workbook.xlsx.writeBuffer());
}

/** Minimal legacy `.xls` header (OLE2) followed by padding. */
export const fakeXls = () =>
  new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...new Array(512).fill(0)]);
