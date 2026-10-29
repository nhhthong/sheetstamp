import { pick } from "../../shared/i18n";

/** Vietnamese strings of Home step 3 (Ghép cột). */
const viHomeMapping = {
  loading: "Đang ghép cột…",
  loadError: "Không mở được bước ghép cột.",
  retry: "Thử lại",
  continue: "Tiếp tục",
  continueFailed: "Không lưu được cách ghép cột. Thử lại.",
  saveFailed: "Không lưu được thay đổi vừa rồi. Thử lại.",
  noFields: "Mẫu này chưa có trường nào cần ghép.",
  needWork: (n: number) => `${n} trường cần bạn chọn cột.`,
  allDone: (n: number) => `Tất cả ${n} trường đã ghép.`,
  listLabel: "Các trường cần ghép",
  unmatchedMarker: "Cần chọn cột",
  takenAlert: "Cột này đã chuyển sang trường khác. Chọn cột khác.",
  firstValue: (value: string) => `Dòng đầu: ${value}`,
  emptyCell: "(trống)",
  resolvedMarker: "Đã chọn",
  explanation: (label: string) =>
    `Chưa có cột nào giống ‘${label}’. Chọn cột khác, nhập chữ cố định hoặc để trống.`,
  showMatched: (n: number) => `Xem ${n} trường đã khớp`,
  hideMatched: (n: number) => `Ẩn ${n} trường đã khớp`,
  matchedLabel: "Các trường đã khớp",
  columnFor: (label: string) => `Cột cho trường ${label}`,
  choose: "Chọn cột…",
  fixedOption: "Nhập chữ cố định",
  emptyOption: "Để trống",
  columnsGroup: "Cột trong file",
  fixedLabel: (label: string) => `Chữ cố định cho trường ${label}`,
  fixedPlaceholder: "Gõ chữ sẽ điền vào mọi dòng",
  lostTitle: "File dữ liệu mới không có một số cột đã chọn:",
  lost: (label: string, previous: string, replacedBy: string | null) =>
    replacedBy === null
      ? `Trường ‘${label}’ mất cột ‘${previous}’. Chọn cột khác.`
      : `Trường ‘${label}’ mất cột ‘${previous}’, đã tự ghép với cột ‘${replacedBy}’. Kiểm tra lại.`,
  previewTitle: "Xem trước",
  previewLabel: "Bản xem trước theo từng dòng",
  pagerLabel: "Chọn dòng xem trước",
  prev: "Dòng trước",
  next: "Dòng sau",
  row: (n: number, total: number) => `Dòng ${n}/${total}`,
  rowFailed: "Không đọc được dòng này.",
  imageAlt: "Ảnh xem trước của dòng này",
  drawing: "Đang vẽ…",
  imageUnmapped: (labels: string[]) => `Chưa ghép nên chưa có chữ trên ảnh: ${labels.join(", ")}.`,
  fontMissing: (family: string) =>
    `Font “${family}” không còn trên máy này. Cài lại font đó, hoặc vào Mẫu, bấm Sửa ảnh và chọn font khác cho khung chữ dùng nó.`,
  textTooLong: (field: string) =>
    `Chữ của trường ‘${field}’ ở dòng này quá dài so với khung. Vào Mẫu, bấm Sửa ảnh, tăng chiều rộng hoặc số dòng của khung.`,
  badBackground: "Không đọc được ảnh nền. Vào Mẫu, bấm Sửa ảnh và tải lại ảnh nền.",
  renderFailed: "Không vẽ được ảnh xem trước. Thử đổi dòng hoặc cách ghép.",
  summary: (n: number) => `${n} trường đã ghép`,
};

const enHomeMapping: typeof viHomeMapping = {
  loading: "Matching columns…",
  loadError: "Could not open the column matching step.",
  retry: "Try again",
  continue: "Continue",
  continueFailed: "Could not save how the columns are matched. Try again.",
  saveFailed: "Could not save the last change. Try again.",
  noFields: "This template has no fields to match.",
  needWork: (n: number) => `${n} fields need a column from you.`,
  allDone: (n: number) => `All ${n} fields are matched.`,
  listLabel: "Fields to match",
  unmatchedMarker: "Choose a column",
  takenAlert: "This column moved to another field. Choose another column.",
  firstValue: (value: string) => `First row: ${value}`,
  emptyCell: "(empty)",
  resolvedMarker: "Chosen",
  explanation: (label: string) =>
    `No column looks like ‘${label}’. Choose another column, type a fixed text or leave it empty.`,
  showMatched: (n: number) => `Show ${n} matched fields`,
  hideMatched: (n: number) => `Hide ${n} matched fields`,
  matchedLabel: "Matched fields",
  columnFor: (label: string) => `Column for field ${label}`,
  choose: "Choose a column…",
  fixedOption: "Type a fixed text",
  emptyOption: "Leave empty",
  columnsGroup: "Columns in the file",
  fixedLabel: (label: string) => `Fixed text for field ${label}`,
  fixedPlaceholder: "Type the text to fill in every row",
  lostTitle: "The new data file does not have some of the columns you chose:",
  lost: (label: string, previous: string, replacedBy: string | null) =>
    replacedBy === null
      ? `Field ‘${label}’ lost its column ‘${previous}’. Choose another column.`
      : `Field ‘${label}’ lost its column ‘${previous}’ and was matched to column ‘${replacedBy}’. Please check.`,
  previewTitle: "Preview",
  previewLabel: "Preview row by row",
  pagerLabel: "Choose the row to preview",
  prev: "Previous row",
  next: "Next row",
  row: (n: number, total: number) => `Row ${n}/${total}`,
  rowFailed: "Could not read this row.",
  imageAlt: "Preview image of this row",
  drawing: "Drawing…",
  imageUnmapped: (labels: string[]) =>
    `Not matched yet, so there is no text on the image: ${labels.join(", ")}.`,
  fontMissing: (family: string) =>
    `The font “${family}” is no longer on this computer. Install it again, or go to Templates, click Edit image and choose another font for the text boxes that use it.`,
  textTooLong: (field: string) =>
    `The text of field ‘${field}’ in this row is too long for its box. Go to Templates, click Edit image, and make the box wider or give it more lines.`,
  badBackground:
    "Could not read the background image. Go to Templates, click Edit image and load the background again.",
  renderFailed: "Could not draw the preview image. Try another row or another matching.",
  summary: (n: number) => `${n} fields matched`,
};

export const homeMapping: typeof viHomeMapping = pick(viHomeMapping, enHomeMapping);
