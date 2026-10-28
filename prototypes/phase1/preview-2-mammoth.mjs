import mammoth from "mammoth";
import { readdirSync, writeFileSync } from "node:fs";
const S = "", E = "";
let page = "<meta charset=utf-8><style>mark{background:#ffe08a}mark.empty{background:none;color:#c00;font-style:italic}body{font:16px Georgia;max-width:700px;margin:20px}</style>";
for (const f of readdirSync("filled")) {
  const t0 = performance.now();
  const { value, messages } = await mammoth.convertToHtml({ path: `filled/${f}` });
  const html = value.replace(new RegExp(`${S}${E}`, "g"), '<mark class="empty">(trống)</mark>').replace(new RegExp(`${S}(.*?)${E}`, "g"), "<mark>$1</mark>");
  page += `<h3>${f} (${(performance.now() - t0).toFixed(0)} ms, ${messages.length} warnings)</h3><div style="border:1px solid #999;padding:8px">${html}</div>`;
}
writeFileSync("mammoth.html", page);
