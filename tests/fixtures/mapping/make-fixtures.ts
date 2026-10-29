/**
 * Generates tests/fixtures/mapping/cases.json: realistic HR and accounting header rows, each with the column
 * every field must map to (or null when no column may be chosen). Run: node --experimental-strip-types
 * tests/fixtures/mapping/make-fixtures.ts. A test checks that the committed file equals this output.
 */
import { writeFileSync } from "node:fs";

export type FixtureField = { key: string; label?: string };
export type FixtureCase = {
  name: string;
  fields: FixtureField[];
  columns: string[];
  /** field key -> expected column and rule; null means the field must stay unmatched. */
  expected: Record<string, { column: string; rule: "exact" | "fuzzy" } | null>;
};

/** `none`: no rule may choose the header, because there is no synonym list. */
type Variant = [header: string, rule: "exact" | "fuzzy" | "none"];

/** Headers people really type for a field, with the rule that should find them. */
const VARIANTS: Record<string, Variant[]> = {
  ho_ten: [
    ["Họ và tên", "none"],
    ["Ho ten", "exact"],
    ["HỌ VÀ TÊN", "exact"],
    ["Họ & tên", "exact"],
    ["Tên đầy đủ", "none"],
    ["Hoten", "fuzzy"],
    ["Tên họ", "fuzzy"],
    ["Họ_và_tên", "none"],
  ],
  ten: [
    ["Tên", "exact"],
    ["Tên nhân viên", "none"],
    ["TEN", "exact"],
    ["Name", "none"],
  ],
  so_dien_thoai: [
    ["Số điện thoại", "exact"],
    ["SĐT", "none"],
    ["Sdt", "none"],
    ["Số điện thoại di động", "none"],
    ["Điện thoại", "none"],
    ["So dien thoai", "exact"],
    ["Số điện thoại ", "exact"],
    ["Phone", "none"],
    ["Số điện thoia", "fuzzy"],
    ["Thoại điện số", "fuzzy"],
  ],
  ma_nhan_vien: [
    ["Mã nhân viên", "exact"],
    ["MNV", "none"],
    ["Mã NV", "none"],
    ["Mã số nhân viên", "none"],
    ["Ma nhan vien", "exact"],
    ["Mã nhân viê", "fuzzy"],
    ["Nhân viên mã", "fuzzy"],
  ],
  ngay_sinh: [
    ["Ngày sinh", "exact"],
    ["Ngay sinh", "exact"],
    ["Ngày tháng năm sinh", "none"],
    ["DOB", "none"],
    ["Sinh nhật", "none"],
    ["ngày_sinh", "exact"],
    ["Sinh ngày", "fuzzy"],
    ["Ngày snh", "fuzzy"],
  ],
  gioi_tinh: [
    ["Giới tính", "exact"],
    ["Gender", "none"],
    ["GIOI TINH", "exact"],
  ],
  cccd: [
    ["CCCD", "exact"],
    ["Số CCCD", "none"],
    ["Số căn cước công dân", "none"],
    ["CMND", "none"],
    ["Căn cước", "none"],
  ],
  ngay_cap: [
    ["Ngày cấp", "exact"],
    ["Ngay cap", "exact"],
  ],
  noi_cap: [
    ["Nơi cấp", "exact"],
    ["Noi cap", "exact"],
  ],
  dia_chi: [
    ["Địa chỉ", "exact"],
    ["Address", "none"],
    ["Dia chi", "exact"],
    ["Nơi ở", "none"],
  ],
  thuong_tru: [
    ["Địa chỉ thường trú", "none"],
    ["Thường trú", "exact"],
  ],
  email: [
    ["Email", "exact"],
    ["E-mail", "none"],
    ["Mail", "fuzzy"],
    ["Thư điện tử", "none"],
  ],
  phong_ban: [
    ["Phòng ban", "exact"],
    ["Bộ phận", "none"],
    ["Department", "none"],
    ["Phong ban", "exact"],
  ],
  chuc_vu: [
    ["Chức vụ", "exact"],
    ["Chức danh", "none"],
    ["Position", "none"],
    ["Vị trí", "none"],
  ],
  ngay_vao_lam: [
    ["Ngày vào làm", "exact"],
    ["Ngày bắt đầu", "none"],
    ["Start date", "none"],
    ["Vào làm ngày", "fuzzy"],
  ],
  so_hop_dong: [
    ["Số hợp đồng", "exact"],
    ["Số HĐ", "none"],
    ["Hợp đồng số", "fuzzy"],
    ["So hop dong", "exact"],
    ["Số hợp đồg", "fuzzy"],
  ],
  loai_hop_dong: [
    ["Loại hợp đồng", "exact"],
    ["Loại HĐ", "none"],
  ],
  ngay_ky: [
    ["Ngày ký", "exact"],
    ["Ngày ký hợp đồng", "none"],
  ],
  luong: [
    ["Lương", "exact"],
    ["Mức lương", "none"],
    ["Lương cơ bản", "none"],
    ["Salary", "none"],
    ["LUONG", "exact"],
  ],
  phu_cap: [
    ["Phụ cấp", "exact"],
    ["Allowance", "none"],
  ],
  thuc_linh: [
    ["Thực lĩnh", "exact"],
    ["Thực nhận", "none"],
    ["Thuc linh", "exact"],
  ],
  so_tai_khoan: [
    ["Số tài khoản", "exact"],
    ["STK", "none"],
    ["Tài khoản ngân hàng", "none"],
    ["Số tài khoản ", "exact"],
  ],
  ngan_hang: [
    ["Ngân hàng", "exact"],
    ["Tên ngân hàng", "none"],
  ],
  ma_so_thue: [
    ["Mã số thuế", "exact"],
    ["MST", "none"],
    ["Mã số thế", "fuzzy"],
  ],
  so_tien: [
    ["Số tiền", "exact"],
    ["Amount", "none"],
    ["Giá trị", "none"],
  ],
  noi_dung: [
    ["Nội dung", "exact"],
    ["Diễn giải", "none"],
    ["Ghi chú", "none"],
  ],
  thang: [
    ["Tháng", "exact"],
    ["Kỳ lương", "none"],
  ],
  nam: [
    ["Năm", "exact"],
    ["Year", "none"],
  ],
  ten_cong_ty: [
    ["Tên công ty", "exact"],
    ["Công ty", "none"],
  ],
};

/** Columns that belong to no field of these templates. */
const DISTRACTORS = ["STT", "Trạng thái", "Ngày tạo bản ghi", "Số lượng", "Người tạo", "Dòng"];

const TEMPLATES: Record<string, string[]> = {
  "hop-dong-lao-dong": [
    "ho_ten",
    "ngay_sinh",
    "cccd",
    "ngay_cap",
    "noi_cap",
    "thuong_tru",
    "so_hop_dong",
    "loai_hop_dong",
    "ngay_ky",
    "chuc_vu",
    "luong",
  ],
  "quyet-dinh-nghi-viec": [
    "ma_nhan_vien",
    "ho_ten",
    "phong_ban",
    "chuc_vu",
    "ngay_vao_lam",
    "ngay_ky",
  ],
  "phieu-luong": [
    "ma_nhan_vien",
    "ho_ten",
    "phong_ban",
    "luong",
    "phu_cap",
    "thuc_linh",
    "thang",
    "nam",
    "so_tai_khoan",
    "ngan_hang",
  ],
  "thong-tin-lien-he": ["ten", "so_dien_thoai", "email", "dia_chi", "gioi_tinh", "ngay_sinh"],
  "ke-toan-thanh-toan": [
    "ten_cong_ty",
    "ma_so_thue",
    "so_tien",
    "noi_dung",
    "so_tai_khoan",
    "ngan_hang",
    "ngay_ky",
  ],
};

function tagsFor(tags: string[], sheet: number): string[] {
  // Rotate the start, so each sheet carries a different mix.
  const start = sheet % tags.length;
  return [...tags.slice(start), ...tags.slice(0, start)];
}

function generated(): FixtureCase[] {
  const cases: FixtureCase[] = [];
  for (const [templateName, tags] of Object.entries(TEMPLATES)) {
    for (let sheet = 0; sheet < 10; sheet++) {
      const keys = tagsFor(tags, sheet);
      const columns: string[] = [];
      const expected: FixtureCase["expected"] = {};
      keys.forEach((key, i) => {
        const variants = VARIANTS[key] ?? [];
        // Deterministic spread over the variants of each field.
        const variant = variants[(sheet * 3 + i) % variants.length];
        if (!variant) throw new Error(`no variants for ${key}`);
        columns.push(variant[0]);
        expected[key] = variant[1] === "none" ? null : { column: variant[0], rule: variant[1] };
      });
      DISTRACTORS.slice(0, 1 + (sheet % DISTRACTORS.length)).forEach((d, i) => {
        columns.splice((sheet * 2 + i * 3) % (columns.length + 1), 0, d);
      });
      cases.push({
        name: `${templateName} #${sheet + 1}`,
        fields: keys.map((key) => ({ key })),
        columns,
        expected,
      });
    }
  }
  return cases;
}

const pos = (column: string, rule: "exact" | "fuzzy") => ({ column, rule });

/** Near misses: a similar name that is a different thing must not be chosen. */
function nearMisses(): FixtureCase[] {
  const c = (
    name: string,
    fields: FixtureField[] | string[],
    columns: string[],
    expected: FixtureCase["expected"],
  ): FixtureCase => ({
    name: `near miss: ${name}`,
    fields: fields.map((f) => (typeof f === "string" ? { key: f } : f)),
    columns,
    expected,
  });
  return [
    c("Họ and Tên columns do not make Họ và tên", ["ho_ten"], ["Họ", "Tên"], { ho_ten: null }),
    c("Họ does not match Họ tên when both exist", ["ho", "ten", "ho_ten"], ["Họ", "Họ tên"], {
      ho: pos("Họ", "exact"),
      ten: null,
      ho_ten: pos("Họ tên", "exact"),
    }),
    c("Họ alone does not take Họ tên", ["ho"], ["Họ tên"], { ho: null }),
    c("Họ và tên field, only Họ", ["ho_ten"], ["Họ"], { ho_ten: null }),
    c("Ngày sinh vs Ngày cấp", ["ngay_sinh"], ["Ngày cấp", "Ngày ký"], { ngay_sinh: null }),
    c("Ngày cấp field, only Ngày sinh", ["ngay_cap", "ngay_sinh"], ["Ngày sinh"], {
      ngay_cap: null,
      ngay_sinh: pos("Ngày sinh", "exact"),
    }),
    c("Ngày sinh con", ["ngay_sinh"], ["Ngày sinh con", "Ngày sinh của vợ"], { ngay_sinh: null }),
    c("Số điện thoại người thân", ["so_dien_thoai"], ["Số điện thoại người thân"], {
      so_dien_thoai: null,
    }),
    c("Số điện thoại khẩn cấp", ["so_dien_thoai"], ["Số điện thoại khẩn cấp", "SĐT khẩn cấp"], {
      so_dien_thoai: null,
    }),
    c("Mã khách hàng is not Mã nhân viên", ["ma_nhan_vien"], ["Mã khách hàng", "Mã số thuế"], {
      ma_nhan_vien: null,
    }),
    c("Lương thử việc is not Lương", ["luong"], ["Lương thử việc"], { luong: null }),
    c("Lương is not Lương thử việc", ["luong_thu_viec"], ["Lương"], { luong_thu_viec: null }),
    c("Đến ngày vs Từ ngày", ["den_ngay"], ["Từ ngày"], { den_ngay: null }),
    c("Từ ngày vs Đến ngày", ["tu_ngay"], ["Đến ngày"], { tu_ngay: null }),
    c("Ngày nghỉ phép is not Ngày nghỉ việc", ["ngay_nghi_viec"], ["Ngày nghỉ phép"], {
      ngay_nghi_viec: null,
    }),
    c("Tạm trú vs thường trú", ["tam_tru"], ["Địa chỉ thường trú"], { tam_tru: null }),
    c("Thường trú vs tạm trú", ["thuong_tru"], ["Địa chỉ tạm trú"], { thuong_tru: null }),
    c("Người thụ hưởng", ["so_tai_khoan"], ["Số tài khoản người thụ hưởng"], {
      so_tai_khoan: null,
    }),
    c("Chi nhánh vs Ngân hàng", ["chi_nhanh"], ["Ngân hàng"], { chi_nhanh: null }),
    c("Tên công ty con", ["ten_cong_ty"], ["Tên công ty con"], { ten_cong_ty: null }),
    c("Người nhận is not Người ký", ["nguoi_ky"], ["Người nhận"], { nguoi_ky: null }),
    c("unknown tag Tên người thân", ["ten_nguoi_than"], ["Tên", "Họ tên"], {
      ten_nguoi_than: null,
    }),
    c("Họ tên người thân", ["ho_ten"], ["Họ tên người thân"], { ho_ten: null }),
    c("Phòng ban cũ", ["phong_ban"], ["Phòng ban cũ"], { phong_ban: null }),
    c("Năm sinh is not Năm", ["nam"], ["Năm sinh"], { nam: null }),
    c("Tháng lương is not Tháng", ["thang"], ["Tháng lương tháng trước"], { thang: null }),
    c("Loại hợp đồng vs Số hợp đồng", ["loai_hop_dong"], ["Số hợp đồng"], { loai_hop_dong: null }),
    c("Số hợp đồng vs Loại hợp đồng", ["so_hop_dong"], ["Loại hợp đồng"], { so_hop_dong: null }),
    c("Số hợp đồng lao động", ["so_hop_dong"], ["Số hợp đồng lao động"], { so_hop_dong: null }),
    c("Mã số thuế vs Mã số BHXH", ["ma_so_thue"], ["Mã số BHXH"], { ma_so_thue: null }),
    c("Ngày kết thúc thử việc", ["ngay_nghi_viec"], ["Ngày kết thúc thử việc"], {
      ngay_nghi_viec: null,
    }),
    c("Giới tính vs Giới thiệu", ["gioi_tinh"], ["Giới thiệu"], { gioi_tinh: null }),
    c("Email vs Email người giới thiệu", ["email"], ["Email người giới thiệu"], { email: null }),
    c("Chức vụ vs Chức vụ cũ", ["chuc_vu"], ["Chức vụ cũ"], { chuc_vu: null }),
    c("abbreviations one letter apart", ["ma_so_thue", "ma_nhan_vien"], ["MNT", "MNB"], {
      ma_so_thue: null,
      ma_nhan_vien: null,
    }),
    c("empty and blank column names", ["ho_ten"], ["", "  ", "-"], { ho_ten: null }),
    c("no columns", ["ho_ten"], [], { ho_ten: null }),
    // The tag label is compared as well as the tag key.
    c("custom label exact", [{ key: "ma_hs", label: "Mã hồ sơ" }], ["STT", "Mã hồ sơ"], {
      ma_hs: pos("Mã hồ sơ", "exact"),
    }),
    c("custom tag key exact", [{ key: "ma_hs", label: "Mã hồ sơ" }], ["ma_hs"], {
      ma_hs: pos("ma_hs", "exact"),
    }),
    c(
      "custom label, no diacritics",
      [{ key: "ten_phuong_tien", label: "Tên phương tiện" }],
      ["Ten phuong tien"],
      {
        ten_phuong_tien: pos("Ten phuong tien", "exact"),
      },
    ),
    c(
      "custom label typo",
      [{ key: "ten_phuong_tien", label: "Tên phương tiện" }],
      ["Tên phương tiệt"],
      {
        ten_phuong_tien: pos("Tên phương tiệt", "fuzzy"),
      },
    ),
    c(
      "custom label, longer column",
      [{ key: "ten_phuong_tien", label: "Tên phương tiện" }],
      ["Tên phương tiện giao hàng"],
      {
        ten_phuong_tien: null,
      },
    ),
    c("diacritics in the tag", ["họ_tên"], ["Họ tên"], { họ_tên: pos("Họ tên", "exact") }),
    c("two fields, one column", ["ten", "ho_ten"], ["Ho ten"], {
      ten: null,
      ho_ten: pos("Ho ten", "exact"),
    }),
    c("no synonym list", ["so_dien_thoai", "ma_nhan_vien"], ["SĐT", "MNV"], {
      so_dien_thoai: null,
      ma_nhan_vien: null,
    }),
  ];
}

export function buildCases(): FixtureCase[] {
  return [...generated(), ...nearMisses()];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const target = new URL("./cases.json", import.meta.url);
  writeFileSync(target, `${JSON.stringify(buildCases(), null, 1)}\n`);
  console.log(`wrote ${buildCases().length} cases to ${target.pathname}`);
}
