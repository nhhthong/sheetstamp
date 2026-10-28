/**
 * Every user-visible string, in Vietnamese, sentence case, plain verbs.
 * An action has one name everywhere. Errors say what happened and how to fix it, without apology.
 */
export const vi = {
  app: { name: "Sheetstamp" },
  nav: {
    label: "Điều hướng chính",
    home: "Tạo file",
    templates: "Mẫu",
    settings: "Cài đặt",
  },
  pages: {
    home: { title: "Tạo file hàng loạt", subtitle: "Làm theo từng bước. Mỗi lần chỉ một việc." },
    templates: { title: "Mẫu", subtitle: "Tạo một lần, dùng lại cho mọi lần xuất." },
    settings: { title: "Cài đặt", subtitle: "Chỉ những gì thật sự cần." },
  },
  common: {
    continue: "Tiếp tục",
    cancel: "Hủy",
    save: "Lưu",
    change: "Đổi",
    delete: "Xóa",
    keep: "Giữ lại",
    close: "Đóng",
    loading: "Đang tải…",
  },
  toast: { region: "Thông báo" },
  errors: {
    generic: "Có lỗi xảy ra. Thử lại; nếu vẫn lỗi, khởi động lại ứng dụng.",
  },
} as const;

export type Strings = typeof vi;
