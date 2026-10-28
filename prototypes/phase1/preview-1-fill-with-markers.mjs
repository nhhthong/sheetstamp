import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { TemplateHandler } from "easy-template-x";
const S = "", E = "";
const values = { ho_ten: "Nguyễn Văn A", so_hop_dong: "HD-01", ngay_sinh: "01/02/1990", cccd: "001234567890", dia_chi: "Hà Nội", chuc_vu: "Kế toán", luong: "10.000.000", phong_ban: "Tài chính", email: "a@b.vn", ngay_ky: "28/10/2026", ma_nv: "NV01" };
const sentinel = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, `${S}${v}${E}`]));
sentinel.chuc_vu = `${S}${E}`; // empty value
const h = new TemplateHandler({ delimiters: { tagStart: "{{", tagEnd: "}}", containerTagOpen: "#", containerTagClose: "/" } });
mkdirSync("filled", { recursive: true });
for (const f of ["A-python-docx.docx", "J-libreoffice-roundtrip.docx", "K-pandoc.docx", "L-first-page-and-sections.docx", "F-text-box-vml.docx"]) {
  writeFileSync(`filled/${f}`, await h.process(readFileSync(`../real/${f}`), sentinel));
}
console.log(readdirSync("filled"));
