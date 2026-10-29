// Generates build/icon.png (1024 px) and build/icon.ico from build/icon.svg.
// Usage: node scripts/make-icons.mjs
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCanvas, loadImage } from "@napi-rs/canvas";

const build = join(dirname(fileURLToPath(import.meta.url)), "..", "build");
const svg = await loadImage(readFileSync(join(build, "icon.svg")));

function png(size) {
  const canvas = createCanvas(size, size);
  canvas.getContext("2d").drawImage(svg, 0, 0, size, size);
  return canvas.toBuffer("image/png");
}

// An ICO file is a directory of images; PNG-compressed entries are valid since Windows Vista.
function ico(sizes) {
  const images = sizes.map(png);
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const entry = 6 + 16 * i;
    header.writeUInt8(size === 256 ? 0 : size, entry); // width, 0 means 256
    header.writeUInt8(size === 256 ? 0 : size, entry + 1); // height
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(images[i].length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += images[i].length;
  });
  return Buffer.concat([header, ...images]);
}

writeFileSync(join(build, "icon.png"), png(1024));
writeFileSync(join(build, "icon.ico"), ico([16, 24, 32, 48, 64, 128, 256]));
console.log("wrote build/icon.png and build/icon.ico");
