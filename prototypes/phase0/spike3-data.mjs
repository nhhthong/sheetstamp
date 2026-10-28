import ExcelJS from 'exceljs';
import chardet from 'chardet';
import iconv from 'iconv-lite';
const wb=new ExcelJS.Workbook(); const ws=wb.addWorksheet('S');
ws.addRow(['num00000','text','phone','date','money']);
const c=ws.addRow([1234,'001234',912345678,new Date('2026-10-26'),1234567.5]);
c.getCell(1).numFmt='00000'; c.getCell(3).numFmt='0000000000'; c.getCell(4).numFmt='dd/mm/yyyy'; c.getCell(5).numFmt='#,##0.00';
await wb.xlsx.writeFile('t.xlsx');
const wb2=new ExcelJS.Workbook(); await wb2.xlsx.readFile('t.xlsx');
wb2.getWorksheet('S').getRow(2).eachCell((cell,i)=>console.log(i,'value=',JSON.stringify(cell.value),'text=',JSON.stringify(cell.text),'fmt=',cell.numFmt));
// chardet on short Vietnamese
const samples={short:'Họ tên,Địa chỉ\nNguyễn Văn A,Hà Nội\nTrần Thị B,Đà Nẵng\n',
 one:'Nguyễn Văn A',
 long:Array.from({length:40},(_,i)=>`Nhân viên ${i},Phạm Thị Hương,Số ${i} đường Lê Lợi, Thành phố Hồ Chí Minh`).join('\n')};
for(const [k,s] of Object.entries(samples)){
  for(const enc of ['utf8','windows-1258']){
    const buf= enc==='utf8'?Buffer.from(s,'utf8'):iconv.encode(s,'windows-1258');
    const lossy = enc==='windows-1258' && iconv.decode(buf,'windows-1258')!==s;
    const top=chardet.analyse(buf).slice(0,3).map(x=>x.name+':'+x.confidence).join(' ');
    let utf8ok=true; try{ new TextDecoder('utf-8',{fatal:true}).decode(buf);}catch{utf8ok=false}
    console.log(k,enc,'lossy?',lossy,'strictUTF8valid=',utf8ok,'| chardet:',top);
  }
}
