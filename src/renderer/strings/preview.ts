import { pick } from "../../shared/i18n";

/** Strings of the Word preview. Vietnamese, sentence case. */
const viPreview = {
  label: "Xem trước tài liệu Word",
  loading: "Đang tạo bản xem trước…",
  empty: "(trống)",
  missing: "(thiếu)",
  missingTitle: (key: string) => `Chưa có cột cho {{${key}}}`,
  fallbackNotice: "Không vẽ được tài liệu này như trong Word, nên chỉ hiện nội dung dạng chữ.",
  failed: "Không tạo được bản xem trước. Kiểm tra lại file mẫu rồi thử lại.",
  fallbackLabel: "Nội dung dạng chữ",
};

const enPreview: typeof viPreview = {
  label: "Word document preview",
  loading: "Creating the preview…",
  empty: "(empty)",
  missing: "(missing)",
  missingTitle: (key: string) => `No column for {{${key}}}`,
  fallbackNotice: "This document cannot be drawn as in Word, so only its text is shown.",
  failed: "Could not create the preview. Check the template file and try again.",
  fallbackLabel: "Text content",
};

export const preview: typeof viPreview = pick(viPreview, enPreview);
