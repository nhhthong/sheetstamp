import {createCanvas, GlobalFonts} from '@napi-rs/canvas';
import {Worker, isMainThread, parentPort} from 'node:worker_threads';
import fs from 'node:fs';
const fam=GlobalFonts.families;
console.log('families:',fam.length, JSON.stringify(fam.slice(0,3)));
const dj=fam.find(f=>f.family==='DejaVu Sans'); console.log('DejaVu Sans styles',JSON.stringify(dj));
const inter=fam.find(f=>f.family==='Inter'); console.log('Inter styles count',inter?.styles.length, JSON.stringify(inter?.styles.map(s=>s.weight+'/'+s.style)));
function render(font,text){
  const c=createCanvas(600,80); const x=c.getContext('2d'); x.fillStyle='#fff'; x.fillRect(0,0,600,80); x.fillStyle='#000'; x.font=font; x.textBaseline='top'; x.fillText(text,10,10);
  return c;
}
const t='Nguyễn Thị Hương ệ ẫ ộ Đ';
for(const f of ['32px DejaVu Sans','bold 32px DejaVu Sans','italic 32px DejaVu Sans','bold italic 32px DejaVu Sans','32px Inter','bold 32px Inter']) fs.writeFileSync(`out-${f.replace(/\W+/g,'_')}.png`,render(f,t).toBuffer('image/png'));
// glyph coverage probe: compare a face to a tofu rendering of a private-use char
function sig(font,ch){const c=createCanvas(60,60);const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,60,60);x.fillStyle='#000';x.font=font;x.textBaseline='top';x.fillText(ch,5,5);return Buffer.from(x.getImageData(0,0,60,60).data).toString('base64');}
for(const family of ['DejaVu Sans','Inter','FreeSans','Noto Sans','Liberation Sans']){
  const tofu=sig(`40px "${family}"`,''); 
  const miss=[...'ệẫộĐươạ'].filter(ch=>sig(`40px "${family}"`,ch)===tofu);
  console.log(family,'exists?',fam.some(f=>f.family===family),'missing VN glyphs (same as tofu):',JSON.stringify(miss));
}
// bold synthesis: family with only regular face
const only=fam.find(f=>f.styles.length===1&&f.styles[0].weight===400&&f.styles[0].style==='normal');
console.log('regular-only family:',only?.family);
if(only){const a=sig(`40px "${only.family}"`,'Hg'),b=sig(`bold 40px "${only.family}"`,'Hg'); console.log('bold differs from regular (synthetic?)',a!==b);}
// worker test
if(isMainThread){
  const w=new Worker(new URL(import.meta.url)); w.on('message',m=>console.log('worker:',m)); w.on('error',e=>console.log('worker err',e.message));
} else { const c=render('32px DejaVu Sans',t); parentPort.postMessage('rendered in worker, bytes='+c.toBuffer('image/png').length); }
