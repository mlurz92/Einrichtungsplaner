"""NSIS-Grafiken (Seitenleiste 164×314, Kopf 150×57) aus dem App-Icon.

Aufruf: python3 tools/icon/installer_images.py <icon_1024.png> <icons-dir>
"""
import sys
from PIL import Image, ImageDraw, ImageFont

GOLD = (205, 169, 108)


def font(size, bold=False):
    for f in ("/usr/share/fonts/truetype/dejavu/DejaVuSerif%s.ttf" % ("-Bold" if bold else ""),
              "/usr/share/fonts/truetype/liberation/LiberationSerif-Regular.ttf"):
        try:
            return ImageFont.truetype(f, size)
        except OSError:
            pass
    return ImageFont.load_default()


def grad(w, h):
    im = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(im)
    for y in range(h):
        t = y / max(h - 1, 1)
        d.line([(0, y), (w, y)], fill=tuple(int(a + (b - a) * t) for a, b in zip((52, 48, 44), (14, 13, 12))))
    return im


def main(src, outdir):
    ic = Image.open(src).convert("RGBA")
    sb = grad(164, 314)
    i = ic.resize((132, 132), Image.LANCZOS)
    sb.paste(i, (16, 34), i)
    d = ImageDraw.Draw(sb)
    d.text((82, 196), "Einrichtungs-", fill=GOLD, font=font(15), anchor="mm")
    d.text((82, 215), "planer", fill=GOLD, font=font(15), anchor="mm")
    d.line([(56, 236), (108, 236)], fill=GOLD, width=1)
    d.text((82, 256), "WE 13", fill=(236, 228, 212), font=font(20), anchor="mm")
    sb.save(f"{outdir}/installer-sidebar.bmp")
    hd = Image.new("RGB", (150, 57), (255, 255, 255))
    i = ic.resize((50, 50), Image.LANCZOS)
    hd.paste(i, (96, 3), i)
    hd.save(f"{outdir}/installer-header.bmp")


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
