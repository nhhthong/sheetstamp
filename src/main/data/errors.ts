export type DataErrorCode =
  | "xls-unsupported"
  | "not-a-spreadsheet"
  | "too-large"
  | "too-many-rows"
  | "empty"
  | "unreadable"
  | "no-such-sheet";

/** Messages are shown to users as written: what happened, then how to fix it. */
const MESSAGES: Record<DataErrorCode, string> = {
  "xls-unsupported":
    "Không đọc được file .xls. Mở file trong Excel, chọn Lưu thành, rồi lưu lại dạng .xlsx hoặc .csv.",
  "not-a-spreadsheet": "File này không phải Excel (.xlsx) hoặc CSV. Chọn file khác.",
  "too-large": "File lớn hơn 20 MB. Tách file thành nhiều phần nhỏ hơn rồi thử lại.",
  "too-many-rows": "File có hơn 50.000 dòng. Tách file thành nhiều phần nhỏ hơn rồi thử lại.",
  empty: "File không có dữ liệu. Kiểm tra dòng tiêu đề và các dòng bên dưới.",
  unreadable: "Không đọc được file. Kiểm tra file có bị hỏng không, hoặc thử lưu lại rồi chọn lại.",
  "no-such-sheet": "Không tìm thấy bảng tính này trong file. Chọn một bảng khác.",
};

export class DataError extends Error {
  constructor(readonly code: DataErrorCode) {
    super(MESSAGES[code]);
    this.name = "DataError";
  }
}

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_ROWS = 50_000;
