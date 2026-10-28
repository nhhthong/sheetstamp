import {ZipArchive} from 'archiver'; import fs from 'node:fs'; import JSZip from 'jszip';
import ExcelJS from 'exceljs';
await new Promise((res)=>{const o=fs.createWriteStream('t.zip');const a=new ZipArchive({zlib:{level:6}});a.pipe(o);o.on('close',res);
 for(const n of ['Nguyễn A.docx','Nguyễn A.docx'.normalize('NFD').replace('A','B')]) a.append(Buffer.from('x'),{name:n}); a.finalize();});
const b=fs.readFileSync('t.zip');
// parse local file headers
let off=0,i=0; while((off=b.indexOf(Buffer.from([0x50,0x4b,3,4]),off))>=0){const flag=b.readUInt16LE(off+6);const nl=b.readUInt16LE(off+26);console.log('entry',b.slice(off+30,off+30+nl).toString(),'flag bit11(UTF-8)=',(flag&0x800)!==0);off+=4}
// large xlsx
const rows=Number(process.argv[2]||20000);
const wb=new ExcelJS.stream.xlsx.WorkbookWriter({filename:'big.xlsx'}); const ws=wb.addWorksheet('S');
for(let i=0;i<rows;i++) ws.addRow([i,'Nguyễn Văn '+i,'0912345'+i,'Hà Nội','a@b.vn',1234567.5,'x','y','z','w']).commit();
await ws.commit(); await wb.commit();
console.log('xlsx bytes',fs.statSync('big.xlsx').size);
let t=performance.now(); let m0=process.memoryUsage().rss;
const wb2=new ExcelJS.Workbook(); await wb2.xlsx.readFile('big.xlsx'); console.log('load',rows,'rows',(performance.now()-t).toFixed(0),'ms; rss +',((process.memoryUsage().rss-m0)/1e6).toFixed(0),'MB');
t=performance.now(); let n=0; const rd=new ExcelJS.stream.xlsx.WorkbookReader('big.xlsx',{}); for await(const s of rd){for await(const r of s){n++}} console.log('stream',n,'rows',(performance.now()-t).toFixed(0),'ms');
