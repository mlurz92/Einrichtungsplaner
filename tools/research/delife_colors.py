"""Bezugs-/Oberflächenfarbe der DELIFE-Ausführungen aus dem Produktfoto (Studioaufnahme vor Weiß).

DELIFE zeigt je Ausführung ein eigenes Freisteller-Foto. Gemessen wird der obere Teil des Objekts (Rücken/Sitz bzw.
Polster, ohne die dünnen Beine), linear gemittelt ohne Glanzlichter und Schatten (mittlere 60 % der Helligkeit).
Fotos mit Raumhintergrund (Ecken nicht weiß) werden übersprungen; dann gilt der Farbwert des Ausführungs-Wählers.
Aufruf: python3 -I delife_colors.py <delife_products.json> <out.json>   (nur Polstermöbel, Teppiche, Kissen)"""
import sys, io, json, os, re, urllib.request
import concurrent.futures as cf

import numpy as np
from PIL import Image

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"}
CATS = re.compile(r"stühle|stuhl|sofa|sofas|sessel|bänke|bank|betten|wohnlandschaft|hocker|kissen|teppich|cocktail|sitzer", re.I)


def lin(c):
    c = c / 255.0
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def srgb(c):
    c = np.where(c <= 0.0031308, c * 12.92, 1.055 * np.power(np.clip(c, 0, 1), 1 / 2.4) - 0.055)
    return np.clip(np.round(c * 255), 0, 255).astype(int)


def measure(url, upper=0.55):
    sep = "&" if "?" in url else "?"
    with urllib.request.urlopen(urllib.request.Request(url + sep + "imwidth=320", headers=UA), timeout=40) as r:
        im = Image.open(io.BytesIO(r.read())).convert("RGB")
    a = np.asarray(im).astype(float)
    h, w, _ = a.shape
    corners = np.concatenate([a[:8, :8].reshape(-1, 3), a[:8, -8:].reshape(-1, 3), a[-8:, :8].reshape(-1, 3), a[-8:, -8:].reshape(-1, 3)])
    if corners.mean() < 225 or corners.std() > 12:
        return None  # kein Freisteller
    bg = corners.mean(axis=0)
    mask = np.abs(a - bg).max(axis=2) > 18
    ys, xs = np.nonzero(mask)
    if len(ys) < 400:
        return None
    y0, y1 = ys.min(), ys.max()
    sel = mask.copy()
    sel[int(y0 + (y1 - y0) * upper):, :] = False  # Beine/Gestell unten ausblenden
    px = a[sel]
    if len(px) < 200:
        return None
    L = px.mean(axis=1)
    lo, hi = np.percentile(L, 20), np.percentile(L, 80)
    px = px[(L >= lo) & (L <= hi)]
    m = srgb(lin(px).mean(axis=0))
    return "#%02x%02x%02x" % tuple(m)


def main(src, out):
    d = json.load(open(src))
    old = json.load(open(out)) if os.path.exists(out) else {}
    todo = {}
    for r in d["rows"]:
        if r.get("images") and CATS.search(f"{r.get('category')} {r['name'].split(' ')[0]}") and r["sku"] not in old:
            todo[r["sku"]] = r["images"]
    print("zu messen:", len(todo), flush=True)

    def job(item):
        sku, imgs = item
        for u in imgs[:2]:
            try:
                c = measure(u)
            except Exception:
                c = None
            if c:
                return sku, c
        return sku, None
    res = dict(old)
    with cf.ThreadPoolExecutor(int(os.environ.get("THREADS", "16"))) as ex:
        for n, (sku, c) in enumerate(ex.map(job, todo.items()), 1):
            if c:
                res[sku] = c
            if n % 500 == 0:
                print(n, len(res), flush=True)
    json.dump(dict(sorted(res.items())), open(out, "w"), indent=0)
    print("gemessen:", len(res), flush=True)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
