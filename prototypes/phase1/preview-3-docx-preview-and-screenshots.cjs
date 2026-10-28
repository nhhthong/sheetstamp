const { chromium } = require("/opt/node-tools/node_modules/playwright");
const fs = require("fs");
(async () => {
  const browser = await chromium.launch({ args: ["--no-sandbox"] });
  const page = await browser.newPage({ viewport: { width: 900, height: 1100 } });
  await page.goto("file://" + process.cwd() + "/mammoth.html");
  await page.screenshot({ path: "mammoth.png", fullPage: true });
  // docx-preview
  const jszip = fs.readFileSync("node_modules/jszip/dist/jszip.min.js", "utf8");
  const dp = fs.readFileSync("node_modules/docx-preview/dist/docx-preview.min.js", "utf8");
  await page.setContent("<meta charset=utf-8><body style='background:#ddd'><div id=out></div>");
  await page.addScriptTag({ content: jszip });
  await page.addScriptTag({ content: dp });
  const results = [];
  for (const f of fs.readdirSync("filled")) {
    const b64 = fs.readFileSync("filled/" + f).toString("base64");
    const ms = await page.evaluate(async ({ b64, f }) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const host = document.createElement("div");
      host.innerHTML = `<h3>${f}</h3>`;
      const body = document.createElement("div");
      host.appendChild(body);
      document.getElementById("out").appendChild(host);
      const t0 = performance.now();
      await docx.renderAsync(bytes, body, null, { inWrapper: true, renderHeaders: true, renderFooters: true, ignoreLastRenderedPageBreak: true });
      const render = performance.now() - t0;
      // highlight sentinels in text nodes
      const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
      const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
      let marks = 0;
      for (const n of nodes) {
        if (!/[]/.test(n.nodeValue)) continue;
        const span = document.createElement("span");
        span.innerHTML = n.nodeValue.replace(//g, '<mark style="color:#c00;font-style:italic;background:none">(trống)</mark>').replace(/(.*?)/g, '<mark style="background:#ffe08a">$1</mark>');
        marks += span.querySelectorAll("mark").length;
        n.parentNode.replaceChild(span, n);
      }
      return { render: Math.round(render), marks, left: /[]/.test(body.textContent) };
    }, { b64, f });
    results.push({ f, ...ms });
  }
  await page.screenshot({ path: "docxpreview.png", fullPage: true });
  console.log(JSON.stringify(results, null, 1));
  await browser.close();
})();
