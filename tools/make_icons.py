"""Draws the app icons: a pot with steam, rice paper on charred black.

Run from the repository folder:  python3 tools/make_icons.py
It writes the PNG files in icons/ (home screen, install, browser tab).
The ensō inside the app (icons/enso-mark.png) is not touched.

Each icon is drawn at 4x size and scaled down, which gives smooth edges.
"""
from pathlib import Path

from PIL import Image, ImageDraw

INK = (30, 32, 29, 255)  # charred black, as the app's dark mode
PAPER = (228, 225, 216, 255)  # rice paper
SCALE = 4
OUT = Path(__file__).resolve().parent.parent / "icons"


def draw_pot(draw, size, zoom=1.0):
    """The pot, steam and lid on a 512-unit grid, centred and zoomed."""
    unit = size / 512

    def box(x0, y0, x1, y1):
        # Zoom around the middle of the drawing (steam to pot bottom: y 100
        # to 370), which lands in the middle of the canvas.
        cx, cy = 256, 235
        return [
            (256 + (x0 - cx) * zoom) * unit,
            (256 + (y0 - cy) * zoom) * unit,
            (256 + (x1 - cx) * zoom) * unit,
            (256 + (y1 - cy) * zoom) * unit,
        ]

    def r(value):
        return value * zoom * unit

    # Steam: three short strokes with soft ends
    for x in (204, 256, 308):
        draw.rounded_rectangle(box(x - 8, 100, x + 8, 136), radius=r(8), fill=PAPER)
    # Knob and lid
    draw.rounded_rectangle(box(228, 152, 284, 186), radius=r(16), fill=PAPER)
    draw.rounded_rectangle(box(136, 182, 376, 210), radius=r(14), fill=PAPER)
    # Handles, then the body over them
    draw.rounded_rectangle(box(120, 238, 170, 272), radius=r(17), fill=PAPER)
    draw.rounded_rectangle(box(342, 238, 392, 272), radius=r(17), fill=PAPER)
    draw.rounded_rectangle(box(152, 216, 360, 370), radius=r(40), fill=PAPER)


def make(name, size, rounded, zoom=1.0):
    big = size * SCALE
    image = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    if rounded:
        # The same soft square as before; the corners stay see-through.
        draw.rounded_rectangle([0, 0, big - 1, big - 1], radius=big * 0.22, fill=INK)
    else:
        # Full square: Android cuts its own shape out of it.
        draw.rectangle([0, 0, big, big], fill=INK)
    draw_pot(draw, big, zoom)
    image.resize((size, size), Image.LANCZOS).save(OUT / name)
    print("wrote", OUT / name)


if __name__ == "__main__":
    make("icon-192.png", 192, rounded=True)
    make("icon-512.png", 512, rounded=True)
    # Maskable: Android may cut a circle, so the pot keeps inside the safe middle.
    make("icon-maskable-512.png", 512, rounded=False, zoom=0.82)
    make("apple-touch-icon.png", 180, rounded=False, zoom=0.9)
    # The browser tab: a bit larger, so it reads at 32 px.
    make("favicon-32.png", 32, rounded=True, zoom=1.15)
