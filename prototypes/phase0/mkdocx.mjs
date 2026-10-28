import JSZip from 'jszip';
const W='xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
const r=(t,b)=>`<w:r>${b?'<w:rPr><w:b/></w:rPr>':''}<w:t xml:space="preserve">${t}</w:t></w:r>`;
const p=(...runs)=>`<w:p>${runs.join('')}</w:p>`;
export async function build(file, bodyParas, header, footer){
  const z=new JSZip();
  z.file('[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/><Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/></Types>`);
  z.file('_rels/.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  z.file('word/_rels/document.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/></Relationships>`);
  z.file('word/document.xml',`<?xml version="1.0" encoding="UTF-8"?><w:document ${W}><w:body>${bodyParas}<w:sectPr><w:headerReference w:type="default" r:id="rId2"/><w:footerReference w:type="default" r:id="rId3"/></w:sectPr></w:body></w:document>`);
  z.file('word/header1.xml',`<?xml version="1.0" encoding="UTF-8"?><w:hdr ${W}>${header}</w:hdr>`);
  z.file('word/footer1.xml',`<?xml version="1.0" encoding="UTF-8"?><w:ftr ${W}>${footer}</w:ftr>`);
  const buf=await z.generateAsync({type:'nodebuffer'});
  return buf;
}
export {r,p};
