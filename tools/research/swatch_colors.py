"""Farbwert je Stoffmuster (Westwing „fabric_sample_image“, 75 × 75 px Ausschnitt des Originalmusters).

Gemittelt wird linear (nicht in sRGB) über die Pixel zwischen dem 25. und 90. Helligkeitsperzentil, damit Schatten
zwischen Bouclé-Schlingen oder Glanzlichter auf Samt den Grundton nicht verfälschen.
Aufruf: python3 -I swatch_colors.py <westwing_products.json> <out.json>"""
import sys, io, json, urllib.request
import concurrent.futures as cf
from pathlib import Path
from PIL import Image

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"}


def lin(c):
    c /= 255
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def srgb(c):
    c = c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
    return max(0, min(255, round(c * 255)))


def swatch_hex(url):
    u = url.replace("width=40", "width=75")
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
        im = Image.open(io.BytesIO(r.read())).convert("RGB")
    b = im.tobytes()
    px = [(lin(float(b[i])), lin(float(b[i + 1])), lin(float(b[i + 2]))) for i in range(0, len(b), 3)]
    px.sort(key=lambda p: 0.2126 * p[0] + 0.7152 * p[1] + 0.0722 * p[2])
    sel = px[int(len(px) * 0.25):int(len(px) * 0.9)] or px
    m = [sum(p[i] for p in sel) / len(sel) for i in range(3)]
    return "#%02x%02x%02x" % tuple(srgb(v) for v in m)


def main():
    prods = json.load(open(sys.argv[1]))
    out_f = Path(sys.argv[2])
    out = json.loads(out_f.read_text()) if out_f.exists() else {}
    urls = sorted({l["swatch"] for p in prods for l in p.get("variantLinks") or []
                   if l.get("swatch") and "fabric_sample_image" in l["swatch"] and l["swatch"] not in out})
    print("muster", len(urls), flush=True)

    def job(u):
        try:
            return u, swatch_hex(u)
        except Exception:
            return u, None

    with cf.ThreadPoolExecutor(12) as ex:
        for u, h in ex.map(job, urls):
            if h:
                out[u] = h
    out_f.write_text(json.dumps(out, ensure_ascii=False, indent=0))
    print("done", len(out))


if __name__ == "__main__":
    main()
