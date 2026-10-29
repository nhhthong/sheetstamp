import { pick, plural } from "../../shared/i18n";

/** Strings of Home step 4 (Xuất file). The close-window dialog text lives in src/shared/messages/export.ts. */
const NO_BOXES = pick(
  "Mẫu này chưa có khung chữ. Vào Mẫu, bấm Sửa ảnh để thêm.",
  "This template has no text boxes yet. Go to Templates and click Edit image to add some.",
);
const BAD_TEMPLATE = pick(
  "Không đọc được ảnh nền hoặc bố cục của mẫu này. Vào Mẫu, bấm Sửa ảnh để kiểm tra lại.",
  "Could not read the background image or the layout of this template. Go to Templates and click Edit image to check it.",
);

const viHomeExport = {
  loading: "Đang chuẩn bị…",
  loadError: "Không mở được bước xuất file.",
  retry: "Thử lại",
  change: "Đổi",
  fileName: "Tên file",
  saveTo: "Lưu vào",
  changeFileName: "Đổi tên file",
  changeFolder: "Đổi thư mục lưu",
  exampleLoading: "…",
  exampleNone: "(chưa có tên)",

  editor: {
    label: "Sửa tên file",
    patternLabel: "Mẫu tên file",
    chipsEmpty: "Chưa có gì. Thêm trường hoặc chữ bên dưới.",
    fieldChip: (label: string) => `Trường ${label}`,
    textChip: (text: string) => `Chữ cố định ${text}`,
    remove: (label: string) => `Bỏ ${label}`,
    add: "Thêm:",
    addField: (label: string) => `+ ${label}`,
    addFieldLabel: (label: string) => `Thêm trường ${label}`,
    textLabel: "Thêm chữ",
    textPlaceholder: "ví dụ _Thử việc",
    textAdd: "Thêm",
    removeDiacritics: "Bỏ dấu tiếng Việt trong tên file",
    savePattern: "Lưu mẫu tên này vào mẫu",
    saved: "Đã lưu mẫu tên file vào mẫu.",
    saveFailed: "Không lưu được vào mẫu. Thử lại.",
    done: "Xong",
  },

  problem: {
    empty: "Mẫu tên file đang trống. Thêm ít nhất một trường hoặc một đoạn chữ.",
    pathCharacters: (text: string) =>
      `Chữ cố định “${text}” có dấu /, \\ hoặc .. nên không dùng được trong tên file.`,
    unknownField: (key: string) =>
      `Trường “${key}” không có trong mẫu này. Bỏ nó đi hoặc chọn trường khác.`,
  },

  image: {
    formatLabel: "Định dạng ảnh",
    png: "PNG",
    jpg: "JPG",
    pngNote: "PNG tạo chậm hơn và file nặng hơn JPG nhiều lần. JPG hợp với ảnh chụp.",
    estimating: "Đang ước tính dung lượng…",
    estimate: (mb: string) =>
      `Ước tính khoảng ${mb} MB (tính từ vài dòng đầu, dung lượng thật có thể khác).`,
    estimateNone: "Chưa ước tính được dung lượng.",
  },

  blocked: {
    "no-boxes": NO_BOXES,
    "bad-template": BAD_TEMPLATE,
    fontMissing: (fonts: readonly string[]) =>
      `${fonts.length === 1 ? "Font" : "Các font"} ${fonts.map((f) => `“${f}”`).join(", ")} không còn trên máy này. Cài lại ${fonts.length === 1 ? "font đó" : "các font đó"}, hoặc vào Mẫu, bấm Sửa ảnh và chọn font khác cho khung chữ dùng ${fonts.length === 1 ? "nó" : "chúng"}.`,
  },

  folderFailed: "Không đọc được thư mục này. Chọn thư mục khác.",
  fixFirst: "Sửa tên file trước khi xuất.",
  export: (n: number) => `Xuất ${n} file`,

  running: {
    title: (done: number, total: number) => `Đang tạo file… ${done}/${total}`,
    barLabel: "Tiến độ tạo file",
    barText: (done: number, total: number) => `${done} trên ${total} file`,
    announce: (percent: number) => `Đã xong ${percent}%`,
    failedSoFar: (k: number) => `${k} dòng bị lỗi cho đến lúc này`,
    cancel: "Hủy",
    canceling: "Đang hủy…",
    keepOpen: "Đừng đóng ứng dụng cho đến khi xong.",
  },

  canceled: "Đã hủy. Chưa lưu gì cả: không có file ZIP nào được tạo.",
  failed: {
    "invalid-pattern": "Mẫu tên file chưa hợp lệ. Sửa lại rồi xuất.",
    "no-data": "Chưa có dữ liệu. Quay lại bước đầu để mở file dữ liệu.",
    "no-template": "Không tìm thấy mẫu này. Chọn lại mẫu ở bước trước.",
    busy: "Đang có một đợt xuất khác. Chờ cho xong.",
    "bad-folder": "Không ghi được vào thư mục này. Chọn thư mục khác.",
    "write-failed": "Không ghi được file ZIP. Kiểm tra chỗ trống của ổ đĩa rồi thử lại.",
    "no-boxes": NO_BOXES,
    "bad-template": BAD_TEMPLATE,
    "font-missing":
      "Có font không còn trên máy này. Cài lại font đó hoặc chọn font khác trong mẫu.",
    unknown: "Không xuất được file. Thử lại.",
  },

  done: {
    title: (n: number) => `Đã tạo ${n} file`,
    titleNone: "Không tạo được file nào",
    zipLabel: "File ZIP",
    open: "Mở thư mục",
    openFailed: "Không mở được thư mục.",
    back: "Quay lại",
    failedRows: (k: number) => `${k} dòng bị lỗi`,
    failedRowsHint: "Các dòng này không được xuất. Báo cáo chỉ có số dòng và mã lỗi.",
    invalidValueHint: (k: number) =>
      `${k} dòng có ô chứa ký tự mà Word không lưu được (ký tự điều khiển ẩn). Sửa ô đó trong file dữ liệu rồi xuất lại.`,
    reportFailed: "Không ghi được báo cáo lỗi, nhưng file ZIP đã xong.",
    report: "Xem báo cáo lỗi",
    newBatch: "Tạo đợt mới",
  },
};

const enHomeExport: typeof viHomeExport = {
  loading: "Getting ready…",
  loadError: "Could not open the export step.",
  retry: "Try again",
  change: "Change",
  fileName: "File name",
  saveTo: "Save to",
  changeFileName: "Change file name",
  changeFolder: "Change save folder",
  exampleLoading: "…",
  exampleNone: "(no name yet)",

  editor: {
    label: "Edit the file name",
    patternLabel: "File name pattern",
    chipsEmpty: "Nothing yet. Add a field or text below.",
    fieldChip: (label: string) => `Field ${label}`,
    textChip: (text: string) => `Fixed text ${text}`,
    remove: (label: string) => `Remove ${label}`,
    add: "Add:",
    addField: (label: string) => `+ ${label}`,
    addFieldLabel: (label: string) => `Add field ${label}`,
    textLabel: "Add text",
    textPlaceholder: "for example _Probation",
    textAdd: "Add",
    removeDiacritics: "Remove Vietnamese diacritics from file names",
    savePattern: "Save this pattern to the template",
    saved: "File name pattern saved to the template.",
    saveFailed: "Could not save to the template. Try again.",
    done: "Done",
  },

  problem: {
    empty: "The file name pattern is empty. Add at least one field or some text.",
    pathCharacters: (text: string) =>
      `The fixed text “${text}” has /, \\ or .. so it cannot be used in a file name.`,
    unknownField: (key: string) =>
      `The field “${key}” is not in this template. Remove it or choose another field.`,
  },

  image: {
    formatLabel: "Image format",
    png: "PNG",
    jpg: "JPG",
    pngNote:
      "PNG is slower to make and the files are many times larger than JPG. JPG suits photos.",
    estimating: "Estimating the size…",
    estimate: (mb: string) =>
      `About ${mb} MB (estimated from the first few rows, the real size may differ).`,
    estimateNone: "Could not estimate the size.",
  },

  blocked: {
    "no-boxes": NO_BOXES,
    "bad-template": BAD_TEMPLATE,
    fontMissing: (fonts: readonly string[]) =>
      `The ${fonts.length === 1 ? "font" : "fonts"} ${fonts.map((f) => `“${f}”`).join(", ")} ${fonts.length === 1 ? "is" : "are"} no longer on this computer. Install ${fonts.length === 1 ? "it" : "them"} again, or go to Templates, click Edit image and choose another font for the text boxes that use ${fonts.length === 1 ? "it" : "them"}.`,
  },

  folderFailed: "Could not read this folder. Choose another folder.",
  fixFirst: "Fix the file name before exporting.",
  export: (n: number) => `Export ${n} ${plural(n, "file")}`,

  running: {
    title: (done: number, total: number) => `Creating files… ${done}/${total}`,
    barLabel: "Progress of creating files",
    barText: (done: number, total: number) => `${done} of ${total} ${plural(total, "file")}`,
    announce: (percent: number) => `${percent}% done`,
    failedSoFar: (k: number) => `${k} ${plural(k, "row")} failed so far`,
    cancel: "Cancel",
    canceling: "Canceling…",
    keepOpen: "Do not close the app until it is done.",
  },

  canceled: "Canceled. Nothing was saved: no ZIP file was created.",
  failed: {
    "invalid-pattern": "The file name pattern is not valid. Fix it and export again.",
    "no-data": "No data yet. Go back to the first step to open a data file.",
    "no-template": "This template was not found. Choose the template again in the previous step.",
    busy: "Another export is running. Wait for it to finish.",
    "bad-folder": "Could not write to this folder. Choose another folder.",
    "write-failed": "Could not write the ZIP file. Check the free space on the disk and try again.",
    "no-boxes": NO_BOXES,
    "bad-template": BAD_TEMPLATE,
    "font-missing":
      "Some fonts are no longer on this computer. Install them again or choose other fonts in the template.",
    unknown: "Could not export the files. Try again.",
  },

  done: {
    title: (n: number) => `Created ${n} ${plural(n, "file")}`,
    titleNone: "No file could be created",
    zipLabel: "ZIP file",
    open: "Open folder",
    openFailed: "Could not open the folder.",
    back: "Back",
    failedRows: (k: number) => `${k} ${plural(k, "row")} failed`,
    failedRowsHint:
      "These rows were not exported. The report has only the row numbers and the error codes.",
    invalidValueHint: (k: number) =>
      `${k} ${plural(k, "row has", "rows have")} a cell with a character Word cannot store (a hidden control character). Fix that cell in the data file and export again.`,
    reportFailed: "Could not write the error report, but the ZIP file is done.",
    report: "Show the error report",
    newBatch: "Start a new batch",
  },
};

export const homeExport: typeof viHomeExport = pick(viHomeExport, enHomeExport);
