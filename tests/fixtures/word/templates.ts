import { type DocxParts, paragraph, run, table } from "../../../src/main/selftest/make-docx";

export type Case = {
  name: string;
  parts: DocxParts;
  values: Record<string, string>;
  /** Tag keys expected from parseTags, in order of first appearance. */
  tags: string[];
  /** Expected visible text of the body after rendering. */
  body: string;
};

const HEADER = paragraph(run("Phòng nhân sự – {{ten}}"));
const FOOTER = paragraph(run("Số: {{so_hop_dong}}"));

const row = {
  ten: "Nguyễn Thị Hương",
  so_hop_dong: "HD-001",
  luong: "10.000.000",
  cccd: "001234567890",
  tên: "Tên có dấu",
  họ_tên: "Họ tên đầy đủ",
  ngay: "28/10/2026",
};

/** The 10 self-written templates of Phase 0: split runs, tables, header and footer, diacritics, NFD, leading zeros. */
export const CASES: Case[] = [
  {
    name: "01-simple",
    parts: { body: paragraph(run("Xin chào {{ten}}.")), header: HEADER, footer: FOOTER },
    values: row,
    tags: ["ten", "so_hop_dong"],
    body: "Xin chào Nguyễn Thị Hương.",
  },
  {
    name: "02-split-two-runs",
    parts: {
      body: paragraph(run("Xin chào {{t"), run("en", true), run("}}.")),
      header: HEADER,
      footer: FOOTER,
    },
    values: row,
    tags: ["ten", "so_hop_dong"],
    body: "Xin chào Nguyễn Thị Hương.",
  },
  {
    name: "03-split-many-runs",
    parts: {
      body: paragraph(run("{"), run("{"), run("lu"), run("ong", true), run("}"), run("}")),
      header: HEADER,
      footer: FOOTER,
    },
    values: row,
    tags: ["luong", "ten", "so_hop_dong"],
    body: "10.000.000",
  },
  {
    name: "04-table",
    parts: {
      body: table(paragraph(run("Lương: {{luong}}")), paragraph(run("Số: {{so_hop_dong}}"))),
      header: HEADER,
      footer: FOOTER,
    },
    values: row,
    tags: ["luong", "so_hop_dong", "ten"],
    body: "Lương: 10.000.000\nSố: HD-001",
  },
  {
    name: "05-header-and-footer-only",
    parts: { body: paragraph(run("Nội dung cố định")), header: HEADER, footer: FOOTER },
    values: row,
    tags: ["ten", "so_hop_dong"],
    body: "Nội dung cố định",
  },
  {
    name: "06-diacritic-tags",
    parts: { body: paragraph(run("{{tên}} và {{họ_tên}}")), header: HEADER, footer: FOOTER },
    values: row,
    tags: ["tên", "họ_tên", "ten", "so_hop_dong"],
    body: "Tên có dấu và Họ tên đầy đủ",
  },
  {
    name: "07-nfd-tag",
    // The tag is written decomposed in the file; the key given to render is composed.
    parts: { body: paragraph(run("{{tên}}".normalize("NFD"))), header: HEADER, footer: FOOTER },
    values: row,
    tags: ["tên", "ten", "so_hop_dong"],
    body: "Tên có dấu",
  },
  {
    name: "08-leading-zeros",
    parts: { body: paragraph(run("CCCD: {{cccd}}")), header: HEADER, footer: FOOTER },
    values: { ...row, cccd: "001234567890" },
    tags: ["cccd", "ten", "so_hop_dong"],
    body: "CCCD: 001234567890",
  },
  {
    name: "09-repeated-and-spaced",
    parts: {
      body: paragraph(run("{{ten}} / {{ ten }} / {{ngay}}")),
      header: HEADER,
      footer: FOOTER,
    },
    values: row,
    tags: ["ten", "ngay", "so_hop_dong"],
    body: "Nguyễn Thị Hương / Nguyễn Thị Hương / 28/10/2026",
  },
  {
    name: "10-empty-value",
    parts: { body: paragraph(run("Ghi chú: {{ghi_chu}}.")), header: HEADER, footer: FOOTER },
    values: { ...row, ghi_chu: "" },
    tags: ["ghi_chu", "ten", "so_hop_dong"],
    body: "Ghi chú: .",
  },
];
