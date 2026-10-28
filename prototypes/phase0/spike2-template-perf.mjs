import {TemplateHandler} from 'easy-template-x';
import JSZip from 'jszip';
import {build,r,p} from './mkdocx.mjs';
const h=new TemplateHandler({delimiters:{tagStart:'{{',tagEnd:'}}',containerTagOpen:'#',containerTagClose:'/'}});
// missing value + formatting kept
let buf=await build('x',p(r('A {{t'),r('en',true),r('}} B {{missing}} C')),p(r('h')),p(r('f')));
let o=await h.process(buf,{ten:'X'});
let z=await JSZip.loadAsync(o); console.log((await z.file('word/document.xml').async('string')).match(/<w:body>.*<\/w:body>/s)[0].slice(0,500));
// perf: 4000 renders with a body of ~50 paragraphs
const body=Array.from({length:60},(_,i)=>p(r(`Dòng ${i} {{ten}} - {{luong}} - {{cccd}} lorem ipsum dolor sit amet`))).join('');
buf=await build('x',body,p(r('H {{ten}}')),p(r('F {{luong}}')));
const t0=performance.now(); const N=500;
for(let i=0;i<N;i++){ await h.process(buf,{ten:'Nguyễn '+i,luong:'1',cccd:'001'}); }
const dt=performance.now()-t0; console.log('process x',N,'=',dt.toFixed(0),'ms ->',(dt/N).toFixed(1),'ms/doc; 4000 =>',(dt/N*4).toFixed(1),'s single thread; size',buf.length);
