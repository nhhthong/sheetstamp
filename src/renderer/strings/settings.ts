import { pick } from "../../shared/i18n";

/** User-visible strings of the Cài đặt page. */
const viSettingsStrings = {
  appearance: {
    legend: "Giao diện",
    light: "Sáng",
    dark: "Tối",
    system: "Theo hệ thống",
  },
  language: {
    legend: "Ngôn ngữ",
    en: "English",
    vi: "Tiếng Việt",
    saveFailed: "Không lưu được lựa chọn ngôn ngữ. Thử lại.",
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
};

const enSettingsStrings: typeof viSettingsStrings = {
  appearance: {
    legend: "Appearance",
    light: "Light",
    dark: "Dark",
    system: "Follow the system",
  },
  language: {
    legend: "Language",
    en: "English",
    vi: "Tiếng Việt",
    saveFailed: "Could not save the language. Try again.",
  },
  about: {
    legend: "About",
    version: (version: string) => `Sheetstamp version ${version}`,
    localLine: "Runs entirely on this computer and sends no data anywhere.",
    electronEnd: (date: string) =>
      `The bundled Electron version gets security support until ${date}; update Sheetstamp before then.`,
    downloadPage: "Download page",
    checkUpdate: "Check for a new version",
    openFailed: "Could not open the browser. Try again.",
    loadFailed: "Could not read the about information.",
  },
  saveFailed: "Could not save the appearance. Try again.",
};

export const settingsStrings: typeof viSettingsStrings = pick(viSettingsStrings, enSettingsStrings);
