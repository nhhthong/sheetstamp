"""Spike for T-4: build Word files the way real Word, LibreOffice and pandoc build them (python-docx, raw OOXML
patterns Word writes: proof marks, bookmarks, hyperlinks, content controls, text boxes, tracked changes, footnotes,
first-page headers) with {{tags}} in them, so spike6-run.mjs can show which tags the engine can fill.

    python3 spike6-realistic-docx.py <output folder>
"""
import re
import subprocess
import sys
import zipfile
from pathlib import Path

from docx import Document
from docx.enum.text import WD_COLOR_INDEX
from docx.oxml import parse_xml
from docx.oxml.ns import nsdecls
from docx.shared import Pt, RGBColor

OUT = Path(sys.argv[1])
OUT.mkdir(parents=True, exist_ok=True)
W = nsdecls("w")


def contract() -> Document:
    d = Document()
    d.add_heading("HỢP ĐỒNG LAO ĐỘNG", 0)
    p = d.add_paragraph()
    p.add_run("Số: ").bold = True
    p.add_run("{{so_hop_dong}}")
    p = d.add_paragraph()
    r = p.add_run("Họ và tên: ")
    r.bold = True
    p.add_run("{{ho_ten}}")
    p = d.add_paragraph("Ngày sinh: {{ngay_sinh}}; CCCD: {{cccd}}; Địa chỉ: {{dia_chi}}.")
    t = d.add_table(rows=3, cols=2)
    t.style = "Table Grid"
    t.cell(0, 0).text = "Chức vụ"
    t.cell(0, 1).text = "{{chuc_vu}}"
    t.cell(1, 0).text = "Mức lương"
    t.cell(1, 1).text = "{{luong}} đồng/tháng"
    a = t.cell(2, 0).merge(t.cell(2, 1))
    a.text = "Phòng ban: {{phong_ban}}"
    s = d.sections[0]
    s.header.paragraphs[0].text = "Công ty - Hợp đồng {{so_hop_dong}}"
    s.footer.paragraphs[0].text = "{{ho_ten}} - trang"
    return d


# A: plain python-docx file
d = contract()
d.save(OUT / "A-python-docx.docx")

# B: tags split by character formatting (bold, colour, highlight, size) in the middle of the tag
d = Document()
p = d.add_paragraph()
p.add_run("Kính gửi ông/bà ")
r = p.add_run("{{ho_")
r.bold = True
r = p.add_run("ten")
r.font.color.rgb = RGBColor(0xC0, 0x00, 0x00)
r = p.add_run("}}")
r.font.size = Pt(20)
r.font.highlight_color = WD_COLOR_INDEX.YELLOW
p.add_run(", mã nhân viên ")
for piece in ["{", "{", "ma", "_nv", "}", "}"]:
    p.add_run(piece).italic = True
d.sections[0].header.paragraphs[0].text = "{{ho_ten}}"
d.save(OUT / "B-split-by-format.docx")


def patched(name, body_xml, header_xml=None, footnote=None):
    """A python-docx file whose body is replaced by raw OOXML paragraphs."""
    d = Document()
    body = d.element.body
    for child in list(body):
        if child.tag.endswith("}p") or child.tag.endswith("}tbl"):
            body.remove(child)
    sect = body[-1] if body.tag and len(body) else None
    for xml in body_xml:
        el = parse_xml(re.sub(r"^<(w:\w+)", rf"<\1 {W}", xml, count=1))
        if sect is not None and sect.tag.endswith("}sectPr"):
            sect.addprevious(el)
        else:
            body.append(el)
    if header_xml:
        h = d.sections[0].header
        hp = h.paragraphs[0]._p
        hp.getparent().replace(hp, parse_xml(re.sub(r"^<(w:\w+)", rf"<\1 {W}", header_xml, count=1)))
    d.save(OUT / name)


proof = (
    '<w:p><w:r><w:t xml:space="preserve">Họ tên: </w:t></w:r>'
    '<w:bookmarkStart w:id="1" w:name="_GoBack"/>'
    '<w:r><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:lang w:val="vi-VN"/></w:rPr><w:t>{{</w:t></w:r>'
    '<w:proofErr w:type="spellStart"/>'
    '<w:r w:rsidR="00A1B2C3"><w:rPr><w:lang w:val="en-US"/></w:rPr><w:t>ho_ten</w:t></w:r>'
    '<w:proofErr w:type="spellEnd"/>'
    '<w:bookmarkEnd w:id="1"/>'
    '<w:r><w:t>}}</w:t></w:r></w:p>'
)
patched("C-proof-bookmark-lang.docx", [proof])

hyper = (
    '<w:p><w:r><w:t xml:space="preserve">Email: </w:t></w:r>'
    '<w:hyperlink w:anchor="x"><w:r><w:rPr><w:color w:val="0563C1"/><w:u w:val="single"/></w:rPr><w:t>{{email}}</w:t></w:r></w:hyperlink></w:p>'
)
fld = (
    '<w:p><w:r><w:t xml:space="preserve">Ngày: </w:t></w:r>'
    '<w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText xml:space="preserve"> DATE </w:instrText></w:r>'
    '<w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>{{ngay_ky}}</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>'
)
patched("D-hyperlink-and-field.docx", [hyper, fld])

sdt = (
    '<w:sdt><w:sdtPr><w:alias w:val="Họ tên"/><w:tag w:val="ho_ten"/></w:sdtPr>'
    '<w:sdtContent><w:p><w:r><w:t>Họ tên: {{ho_ten}}</w:t></w:r></w:p></w:sdtContent></w:sdt>'
)
patched("E-content-control.docx", [sdt])

textbox = (
    '<w:p><w:r><w:t>Nội dung thường</w:t></w:r>'
    '<w:r><w:pict><v:shape xmlns:v="urn:schemas-microsoft-com:vml" style="width:200pt;height:40pt" type="#_x0000_t202">'
    '<v:textbox><w:txbxContent><w:p><w:r><w:t>Người nhận: {{ho_ten}}</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape></w:pict></w:r></w:p>'
)
patched("F-text-box-vml.docx", [textbox])

tracked = (
    '<w:p><w:r><w:t xml:space="preserve">Lương: </w:t></w:r>'
    '<w:ins w:id="10" w:author="HR" w:date="2026-10-01T00:00:00Z"><w:r><w:t>{{lu</w:t></w:r></w:ins>'
    '<w:r><w:t>ong}}</w:t></w:r></w:p>'
)
deleted = (
    '<w:p><w:del w:id="11" w:author="HR" w:date="2026-10-01T00:00:00Z"><w:r><w:delText>{{cu_ten}}</w:delText></w:r></w:del>'
    '<w:r><w:t>{{ho_ten}}</w:t></w:r></w:p>'
)
patched("G-tracked-changes.docx", [tracked, deleted])

nbsp = '<w:p><w:r><w:t>Họ tên: {{ ho_ten }} và {{ho ten}}</w:t></w:r></w:p>'
patched("M-nbsp-inside-braces.docx", [nbsp])

# L: different first-page header, odd/even headers, two sections
d = Document()
d.add_paragraph("Trang đầu {{ho_ten}}")
sec = d.sections[0]
sec.different_first_page_header_footer = True
sec.first_page_header.paragraphs[0].text = "Đầu trang đầu: {{so_hop_dong}}"
sec.header.paragraphs[0].text = "Đầu trang thường: {{so_hop_dong}}"
sec.footer.paragraphs[0].text = "Chân trang: {{ho_ten}}"
d.add_section()
d.add_paragraph("Mục hai {{chuc_vu}}")
d.sections[1].header.is_linked_to_previous = False
d.sections[1].header.paragraphs[0].text = "Đầu trang mục hai: {{phong_ban}}"
d.save(OUT / "L-first-page-and-sections.docx")

# I: footnote (python-docx has no API: add the part by hand)
d = contract()
tmp = OUT / "I-footnote.docx"
d.save(tmp)
with zipfile.ZipFile(tmp) as zin:
    items = {n: zin.read(n) for n in zin.namelist()}
items["word/footnotes.xml"] = (
    f'<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:footnotes {W}>'
    '<w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote>'
    '<w:footnote w:id="1"><w:p><w:r><w:t>Ghi chú cho {{ho_ten}}</w:t></w:r></w:p></w:footnote></w:footnotes>'
).encode()
ct = items["[Content_Types].xml"].decode().replace(
    "</Types>",
    '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/></Types>',
)
items["[Content_Types].xml"] = ct.encode()
rels = items["word/_rels/document.xml.rels"].decode().replace(
    "</Relationships>",
    '<Relationship Id="rIdFn" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/></Relationships>',
)
items["word/_rels/document.xml.rels"] = rels.encode()
with zipfile.ZipFile(tmp, "w", zipfile.ZIP_DEFLATED) as zout:
    for n, b in items.items():
        zout.writestr(n, b)

# K: pandoc; J: LibreOffice round trip of A
md = OUT / "K.md"
md.write_text("# Quyết định nghỉ việc\n\nTên: **{{ho_ten}}**, chức vụ *{{chuc_vu}}*.\n\n| Mục | Giá trị |\n|---|---|\n| Lương | {{luong}} |\n", encoding="utf-8")
subprocess.run(["pandoc", str(md), "-o", str(OUT / "K-pandoc.docx")], check=True)
md.unlink()
subprocess.run(
    ["soffice", "--headless", "--convert-to", "docx:MS Word 2007 XML", "--outdir", str(OUT / "lo"), str(OUT / "A-python-docx.docx")],
    check=True, capture_output=True, timeout=120,
)
(OUT / "lo" / "A-python-docx.docx").rename(OUT / "J-libreoffice-roundtrip.docx")
(OUT / "lo").rmdir()
print(sorted(p.name for p in OUT.glob("*.docx")))
