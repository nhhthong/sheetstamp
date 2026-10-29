/** User-visible strings of the Cài đặt page. */
export const settingsStrings = {
  appearance: {
    legend: "Giao diện",
    light: "Sáng",
    dark: "Tối",
    system: "Theo hệ thống",
  },
  about: {
    legend: "Giới thiệu",
    version: (version: string) => `Sheetstamp phiên bản ${version}`,
    localLine: "Chạy hoàn toàn trên máy này, không gửi dữ liệu đi đâu.",
    electronEnd: (date: string) =>
      `Phiên bản Electron đi kèm được hỗ trợ bảo mật đến ${date}; hãy cập nhật Sheetstamp trước thời điểm đó.`,
    downloadPage: "Trang tải về",
    checkUpdate: "Kiểm tra bản mới",
    openFailed: "Không mở được trình duyệt. Thử lại.",
    loadFailed: "Không đọc được thông tin giới thiệu.",
  },
  saveFailed: "Không lưu được lựa chọn giao diện. Thử lại.",
} as const;
