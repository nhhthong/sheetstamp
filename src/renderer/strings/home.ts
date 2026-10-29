import { pick, plural } from "../../shared/i18n";

/** Vietnamese strings of the Home page: the stepper and step 1 (Dữ liệu). Later steps keep their own strings files. */
const viHome = {
  steps: {
    data: "Dữ liệu",
    template: "Mẫu",
    mapping: "Ghép cột",
    export: "Xuất file",
  },
  stepper: {
    label: "Các bước tạo file",
    change: "Đổi",
    stateDone: "Đã xong",
    stateActive: "Đang làm",
    stateLocked: "Chưa mở",
    stepPrefix: (n: number) => `Bước ${n}: `,
  },
  later: "Bước này chưa dùng được trong bản hiện tại.",
  data: {
    continue: "Tiếp tục",
    dropTitle: "Thả file Excel hoặc CSV vào đây",
    dropHint: "hoặc bấm để chọn file",
    dropActive: "Thả file để đọc",
    reading: "Đang đọc file…",
    pickAnother: "Chọn file khác",
    summary: (fileName: string, rows: number, columns: number) =>
      `${fileName}, ${rows} dòng, ${columns} cột`,
    counts: (rows: number, columns: number) => `${rows} dòng, ${columns} cột`,
    previewCaption: (n: number) => `${n} dòng đầu tiên của file`,
    sheetLabel: "Bảng tính",
    encodingNow: (label: string) => `Bảng mã đang dùng: ${label}`,
    encodingHint: "Chữ hiển thị sai?",
    encodingLink: "Đổi bảng mã",
    encodingLabel: "Bảng mã",
    encodingHelp: "Chọn bảng mã khác cho đến khi chữ tiếng Việt hiển thị đúng.",
    encodings: {
      "utf-8": "Unicode (UTF-8)",
      "windows-1258": "Windows-1258 (tiếng Việt)",
      "utf-16le": "UTF-16 LE",
      "utf-16be": "UTF-16 BE",
    },
    emptyCells: (count: number, column: string) => `${count} ô trống ở cột ${column}`,
    mixedTypes: (column: string) => `Cột ${column} lẫn số và chữ. Kiểm tra lại dữ liệu cột này.`,
    idAsNumber: (column: string) => `Cột ${column} đang là số nên có thể mất số 0 ở đầu.`,
    padLabel: (column: string) => `Số chữ số của cột ${column}`,
    padAction: "Thêm số 0 ở đầu",
    padded: (column: string) => `Đã thêm số 0 ở đầu cột ${column}.`,
    warningsTitle: "Cần kiểm tra",
    changed: "File đã thay đổi trên ổ đĩa. Bấm Đọc lại để cập nhật.",
    reload: "Đọc lại",
    reloaded: "Đã đọc lại file.",
    reloadHint: "Đọc lại file từ ổ đĩa, giữ nguyên bảng tính và bảng mã đã chọn.",
    errors: {
      "file-missing": "Không tìm thấy file. File có thể đã bị di chuyển hoặc xóa. Chọn file khác.",
      "read-failed":
        "Không mở được file. Đóng file nếu đang mở trong chương trình khác, rồi thử lại.",
      "no-file": "Chưa có file nào. Thả hoặc chọn một file.",
      "bad-column": "Cột này không cần thêm số 0.",
      generic: "Không đọc được file. Thử lại hoặc chọn file khác.",
    },
  },
};

const enHome: typeof viHome = {
  steps: {
    data: "Data",
    template: "Template",
    mapping: "Match columns",
    export: "Export",
  },
  stepper: {
    label: "Steps to create files",
    change: "Change",
    stateDone: "Done",
    stateActive: "In progress",
    stateLocked: "Not open yet",
    stepPrefix: (n: number) => `Step ${n}: `,
  },
  later: "This step is not available in the current version.",
  data: {
    continue: "Continue",
    dropTitle: "Drop an Excel or CSV file here",
    dropHint: "or click to choose a file",
    dropActive: "Drop the file to read it",
    reading: "Reading the file…",
    pickAnother: "Choose another file",
    summary: (fileName: string, rows: number, columns: number) =>
      `${fileName}, ${rows} ${plural(rows, "row")}, ${columns} ${plural(columns, "column")}`,
    counts: (rows: number, columns: number) =>
      `${rows} ${plural(rows, "row")}, ${columns} ${plural(columns, "column")}`,
    previewCaption: (n: number) => `First ${n} ${plural(n, "row")} of the file`,
    sheetLabel: "Sheet",
    encodingNow: (label: string) => `Encoding in use: ${label}`,
    encodingHint: "Text looks wrong?",
    encodingLink: "Change encoding",
    encodingLabel: "Encoding",
    encodingHelp: "Pick another encoding until the Vietnamese text looks right.",
    encodings: {
      "utf-8": "Unicode (UTF-8)",
      "windows-1258": "Windows-1258 (Vietnamese)",
      "utf-16le": "UTF-16 LE",
      "utf-16be": "UTF-16 BE",
    },
    emptyCells: (count: number, column: string) => `${count} empty cells in column ${column}`,
    mixedTypes: (column: string) =>
      `Column ${column} mixes numbers and text. Check the data in this column.`,
    idAsNumber: (column: string) =>
      `Column ${column} is read as numbers, so leading zeros may be lost.`,
    padLabel: (column: string) => `Number of digits in column ${column}`,
    padAction: "Add leading zeros",
    padded: (column: string) => `Leading zeros added to column ${column}.`,
    warningsTitle: "Needs a check",
    changed: "The file changed on disk. Click Reload to update.",
    reload: "Reload",
    reloaded: "File reloaded.",
    reloadHint: "Read the file from disk again, keeping the sheet and encoding you chose.",
    errors: {
      "file-missing": "File not found. It may have been moved or deleted. Choose another file.",
      "read-failed":
        "Could not open the file. Close it if it is open in another program, then try again.",
      "no-file": "No file yet. Drop or choose one.",
      "bad-column": "This column does not need leading zeros.",
      generic: "Could not read the file. Try again or choose another file.",
    },
  },
};

export const home: typeof viHome = pick(viHome, enHome);
