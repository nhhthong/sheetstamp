"""Writes the small variant fixtures run.mjs probes (EXIF, CMYK, progressive, 16-bit, animated, ...).
Needs Pillow only to (re)create them; run.mjs itself reads the committed files.
Every fixture is a 400x300 landscape with a RED block in the raw top-left corner and a BLUE block in the raw
bottom-right, so run.mjs can tell from pixels whether orientation was applied."""
import io, struct
from PIL import Image, ImageDraw

W, H = 400, 300
OUT = "fixtures/"

def base(mode="RGB"):
    im = Image.new("RGB", (W, H), (240, 240, 240))
    d = ImageDraw.Draw(im)
    d.rectangle([0, 0, 79, 79], fill=(255, 0, 0))
    d.rectangle([W - 80, H - 80, W - 1, H - 1], fill=(0, 0, 255))
    return im.convert(mode) if mode != "RGB" else im

def exif_orientation(value):
    # Minimal big-endian EXIF block with one IFD0 entry: Orientation (0x0112), SHORT.
    return b"Exif\x00\x00MM\x00\x2a\x00\x00\x00\x08\x00\x01\x01\x12\x00\x03\x00\x00\x00\x01" + struct.pack(">H", value) + b"\x00\x00\x00\x00\x00\x00"

for o in (1, 2, 3, 4, 5, 6, 7, 8):
    base().save(f"{OUT}exif-{o}.jpg", "JPEG", quality=90, exif=exif_orientation(o))
base().save(OUT + "plain.jpg", "JPEG", quality=90)
base().save(OUT + "progressive.jpg", "JPEG", quality=90, progressive=True)
base("CMYK").save(OUT + "cmyk.jpg", "JPEG", quality=90)
base("L").save(OUT + "gray.jpg", "JPEG", quality=90)
# 16-bit RGB PNG (Pillow cannot write RGB16 directly; write the PNG chunks by hand).
import zlib
def png16():
    src = base()
    rows = b""
    for y in range(H):
        rows += b"\x00"
        for x in range(W):
            r, g, b = src.getpixel((x, y))
            rows += struct.pack(">HHH", r * 257, g * 257, b * 257)
    def chunk(t, d):
        c = struct.pack(">I", len(d)) + t + d
        return c + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 16, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")
open(OUT + "rgb16.png", "wb").write(png16())
base().save(OUT + "plain.png", "PNG")
base().convert("P").save(OUT + "indexed.png", "PNG")
base().convert("RGBA").save(OUT + "alpha.png", "PNG")
# Animated: 3 frames, first frame has the markers.
f1 = base(); f2 = Image.new("RGB", (W, H), (0, 160, 0)); f3 = Image.new("RGB", (W, H), (160, 0, 160))
f1.save(OUT + "animated.gif", save_all=True, append_images=[f2, f3], duration=100, loop=0)
f1.save(OUT + "animated.webp", save_all=True, append_images=[f2, f3], duration=100, loop=0, lossless=True)
f1.convert("RGBA").save(OUT + "animated.png", "PNG", save_all=True, append_images=[f2.convert("RGBA"), f3.convert("RGBA")], duration=100, loop=0)
base().save(OUT + "plain.webp", "WEBP", lossless=True)
base().save(OUT + "plain.bmp", "BMP")
base().save(OUT + "plain.tiff", "TIFF")
