import { pick } from "../../shared/i18n";

/**
 * Every user-visible string, in English and Vietnamese, sentence case, plain verbs.
 * An action has one name everywhere. Errors say what happened and how to fix it, without apology.
 * The language is picked once per page load (src/shared/i18n.ts).
 */
const viStrings = {
  app: { name: "Sheetstamp" },
  nav: {
    label: "Điều hướng chính",
    close: "Đóng menu",
    open: "Mở menu",
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
};

export type Strings = typeof viStrings;

const enStrings: Strings = {
  app: { name: "Sheetstamp" },
  nav: {
    label: "Main navigation",
    close: "Close menu",
    open: "Open menu",
    home: "Create files",
    templates: "Templates",
    settings: "Settings",
  },
  pages: {
    home: { title: "Create files in bulk", subtitle: "Follow the steps. One thing at a time." },
    templates: { title: "Templates", subtitle: "Make one once, reuse it for every export." },
    settings: { title: "Settings", subtitle: "Only what you really need." },
  },
  common: {
    continue: "Continue",
    cancel: "Cancel",
    save: "Save",
    change: "Change",
    delete: "Delete",
    keep: "Keep",
    close: "Close",
    loading: "Loading…",
  },
  toast: { region: "Notifications" },
  errors: {
    generic: "Something went wrong. Try again; if it keeps failing, restart the app.",
  },
};

export const vi: Strings = pick(viStrings, enStrings);
