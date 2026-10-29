import { lazy } from "../../shared/i18n";
export type DataErrorCode =
  | "xls-unsupported"
  | "not-a-spreadsheet"
  | "too-large"
  | "too-many-rows"
  | "empty"
  | "unreadable"
  | "no-such-sheet";

/** Messages are shown to users as written: what happened, then how to fix it. */
const MESSAGES: Record<DataErrorCode, string> = lazy<Record<DataErrorCode, string>>(
  {
    "xls-unsupported":
      "Không đọc được file .xls. Mở file trong Excel, chọn Lưu thành, rồi lưu lại dạng .xlsx hoặc .csv.",
    "not-a-spreadsheet": "File này không phải Excel (.xlsx) hoặc CSV. Chọn file khác.",
    "too-large": "File lớn hơn 20 MB. Tách file thành nhiều phần nhỏ hơn rồi thử lại.",
    "too-many-rows": "File có hơn 50.000 dòng. Tách file thành nhiều phần nhỏ hơn rồi thử lại.",
    empty: "File không có dữ liệu. Kiểm tra dòng tiêu đề và các dòng bên dưới.",
    unreadable:
      "Không đọc được file. Kiểm tra file có bị hỏng không, hoặc thử lưu lại rồi chọn lại.",
    "no-such-sheet": "Không tìm thấy bảng tính này trong file. Chọn một bảng khác.",
  },
  {
    "xls-unsupported":
      "Could not read the .xls file. Open it in Excel, choose Save As, and save it as .xlsx or .csv.",
    "not-a-spreadsheet": "This is not an Excel (.xlsx) or CSV file. Choose another file.",
    "too-large": "The file is larger than 20 MB. Split it into smaller files and try again.",
    "too-many-rows": "The file has more than 50,000 rows. Split it into smaller files and try again.",
    empty: "The file has no data. Check the header row and the rows below it.",
    unreadable: "Could not read the file. Check whether it is damaged, or save it again and choose it again.",
    "no-such-sheet": "This sheet was not found in the file. Choose another sheet.",
  },
);

export class DataError extends Error {
  constructor(readonly code: DataErrorCode) {
    super(MESSAGES[code]);
    this.name = "DataError";
  }
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ROWS = 50_000;
