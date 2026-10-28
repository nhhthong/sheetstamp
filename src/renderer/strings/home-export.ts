/** Vietnamese strings of Home step 4 (Xuất file). Main imports the close-window dialog text from here too. */
export const homeExport = {
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

  folderFailed: "Không đọc được thư mục này. Chọn thư mục khác.",
  fixFirst: "Sửa tên file trước khi xuất.",
  export: (n: number) => `Xuất ${n} file`,
  summary: (n: number) => `${n} file`,

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
    report: "Xem báo cáo lỗi",
    newBatch: "Tạo đợt mới",
    summary: (n: number, k: number) =>
      k > 0 ? `Đã tạo ${n} file, ${k} dòng lỗi` : `Đã tạo ${n} file`,
  },

  closeDialog: {
    title: "Đang tạo file",
    message: "Đang tạo file. Đóng ứng dụng bây giờ sẽ hủy và không lưu gì cả.",
    stay: "Ở lại",
    close: "Hủy và đóng",
  },
} as const;
