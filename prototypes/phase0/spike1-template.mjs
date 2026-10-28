import {TemplateHandler, MimeType} from 'easy-template-x';
import JSZip from 'jszip';
import {build,r,p} from './mkdocx.mjs';
const tbl=`<w:tbl><w:tr><w:tc><w:p>${r('Lương: {{luong}}')}</w:p></w:tc></w:tr></w:tbl>`;
const cases={
 simple: p(r('Xin chào {{ten}}')),
 split: p(r('Xin chào {{t'),r('en',true),r('}}')),
 split3: p(r('{'),r('{'),r('ten'),r('}'),r('}')),
 table: tbl,
 diacritic: p(r('Họ {{tên}} và {{họ_tên}}')),
 nfd: p(r('{{ten̂}}'.normalize('NFD'))),
 empty: p(r('Email: {{email}}.')),
 repeated: p(r('{{ten}} - {{ten}}')),
 spaces: p(r('{{ ten }}')),
 loop: p(r('{{#ds}}{{ten}}{{/ds}}')),
};
const hdr=p(r('Header {{ten}}')), ftr=p(r('Footer {{luong}} {{t'),r('ên}}'));
for(const [name,body] of Object.entries(cases)){
  const buf=await build('x',body,hdr,ftr);
  const h=new TemplateHandler({delimiters:{tagStart:'{{',tagEnd:'}}',containerTagOpen:'#',containerTagClose:'/'}});
  let tags,out;
  try{tags=(await h.parseTags(buf)).map(t=>t.rawText+'|'+t.disposition);}catch(e){tags='PARSE ERR '+e.message}
  try{
    const o=await h.process(buf,{ten:'Nguyễn Văn A','tên':'TÊN','họ_tên':'HT',luong:'10.000.000',email:'',ds:[{ten:'A'},{ten:'B'}], 'ten̂':'NFD'});
    const z=await JSZip.loadAsync(o);
    const txt=async f=>(await z.file(f).async('string')).replace(/<[^>]+>/g,'');
    out={body:await txt('word/document.xml'),header:await txt('word/header1.xml'),footer:await txt('word/footer1.xml')};
  }catch(e){out='PROCESS ERR '+e.message}
  console.log('##',name,'\ntags:',JSON.stringify(tags),'\nout:',JSON.stringify(out));
}
