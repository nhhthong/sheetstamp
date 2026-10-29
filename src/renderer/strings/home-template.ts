import { pick, plural } from "../../shared/i18n";

/** Vietnamese strings of Home step 2 (Mẫu). */
const viHomeTemplate = {
  search: "Tìm mẫu theo tên, nhóm hoặc ghi chú",
  groupsLabel: "Lọc theo nhóm",
  all: "Tất cả",
  listLabel: "Các mẫu tài liệu",
  newTemplate: "+ Mẫu mới",
  createFirst: "Tạo mẫu đầu tiên",
  empty: "Chưa có mẫu tài liệu nào. Tạo mẫu đầu tiên để tiếp tục.",
  noResults: "Không có mẫu nào khớp. Đổi từ khóa hoặc chọn nhóm khác.",
  loading: "Đang tải danh sách mẫu…",
  loadError: "Không tải được danh sách mẫu. Thử lại, hoặc khởi động lại ứng dụng.",
  retry: "Thử lại",
  continue: "Tiếp tục",
  selected: "Đã chọn",
  fit: (matched: number, total: number) => `Khớp ${matched}/${total} trường`,
  noFields: "Chưa có trường nào",
  fieldsOnly: (total: number) => `${total} trường`,
  neverUsed: "chưa dùng",
  usedOn: (date: string) => `dùng ${date}`,
  summary: (name: string, group: string) => `${name} (${group})`,
  useFailed: "Không chọn được mẫu này. Thử lại.",
};

const enHomeTemplate: typeof viHomeTemplate = {
  search: "Search templates by name, group or note",
  groupsLabel: "Filter by group",
  all: "All",
  listLabel: "Document templates",
  newTemplate: "+ New template",
  createFirst: "Create your first template",
  empty: "No document templates yet. Create your first one to continue.",
  noResults: "No template matches. Change the keyword or pick another group.",
  loading: "Loading templates…",
  loadError: "Could not load the templates. Try again, or restart the app.",
  retry: "Try again",
  continue: "Continue",
  selected: "Selected",
  fit: (matched: number, total: number) => `Matches ${matched}/${total} ${plural(total, "field")}`,
  noFields: "No fields yet",
  fieldsOnly: (total: number) => `${total} ${plural(total, "field")}`,
  neverUsed: "never used",
  usedOn: (date: string) => `used ${date}`,
  summary: (name: string, group: string) => `${name} (${group})`,
  useFailed: "Could not choose this template. Try again.",
};

export const homeTemplate: typeof viHomeTemplate = pick(viHomeTemplate, enHomeTemplate);
