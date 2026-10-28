"""Builds the test-only font family "Sheetstamp Test" from Liberation Sans (SIL Open Font License 1.1).

The licence reserves the name "Liberation", so the derived family is renamed.
The fonts are used only by automated tests and are never shipped in the installer.

    pip install fonttools
    python3 tests/fixtures/fonts/make-test-fonts.py /usr/share/fonts/truetype/liberation
"""
import sys
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

SOURCE = Path(sys.argv[1] if len(sys.argv) > 1 else "/usr/share/fonts/truetype/liberation")
OUT = Path(__file__).parent
FAMILY = "Sheetstamp Test"
FACES = {
    "Regular": ("LiberationSans-Regular.ttf", False, False),
    "Bold": ("LiberationSans-Bold.ttf", True, False),
    "Italic": ("LiberationSans-Italic.ttf", False, True),
    "BoldItalic": ("LiberationSans-BoldItalic.ttf", True, True),
}
# Basic Latin, Latin-1, Vietnamese letters and combining marks, punctuation.
UNICODES = (
    list(range(0x20, 0x7F))
    + list(range(0xA0, 0x100))
    + [0x102, 0x103, 0x110, 0x111, 0x128, 0x129, 0x168, 0x169, 0x1A0, 0x1A1, 0x1AF, 0x1B0]
    + [0x300, 0x301, 0x303, 0x309, 0x323]
    + list(range(0x1EA0, 0x1EFA))
    + [0x2013, 0x2014, 0x2018, 0x2019, 0x201C, 0x201D, 0x2026]
)

for style, (file, bold, italic) in FACES.items():
    options = subset.Options()
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    font = TTFont(SOURCE / file)
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=UNICODES)
    subsetter.subset(font)
    for record in list(font["name"].names):
        if record.nameID in (1, 16):
            record.string = FAMILY
        elif record.nameID in (2, 17):
            record.string = style
        elif record.nameID == 4:
            record.string = f"{FAMILY} {style}"
        elif record.nameID == 6:
            record.string = f"SheetstampTest-{style}"
        elif record.nameID in (3,):
            record.string = f"SheetstampTest-{style}-test"
    font.save(OUT / f"SheetstampTest-{style}.ttf")
    print("wrote", style, (OUT / f"SheetstampTest-{style}.ttf").stat().st_size)
