/** Strings of the Word preview. Vietnamese, sentence case. */
export const preview = {
  label: "Xem trước tài liệu Word",
  loading: "Đang tạo bản xem trước…",
  empty: "(trống)",
  missing: "(thiếu)",
  missingTitle: (key: string) => `Chưa có cột cho {{${key}}}`,
  fallbackNotice: "Không vẽ được tài liệu này như trong Word, nên chỉ hiện nội dung dạng chữ.",
  failed: "Không tạo được bản xem trước. Kiểm tra lại file mẫu rồi thử lại.",
  fallbackLabel: "Nội dung dạng chữ",
} as const;
