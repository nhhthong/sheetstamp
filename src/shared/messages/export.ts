import { lazy } from "../i18n";

// Text the main process shows itself (native dialogs); shared so main never imports renderer strings.
export const exportMessages = lazy(
  {
    closeDialog: {
      title: "Đang tạo file",
      message: "Đang tạo file. Đóng ứng dụng bây giờ sẽ hủy và không lưu gì cả.",
      stay: "Ở lại",
      close: "Hủy và đóng",
    },
  },
  {
    closeDialog: {
      title: "Creating files",
      message: "Files are being created. Closing the app now cancels the export and saves nothing.",
      stay: "Stay",
      close: "Cancel and close",
    },
  },
);
