"""Extrahiert gefüllte Möbelformen aus Seite 1 eines Möblierungskonzepts (Planbereich) inkl. Positionsmarken.
Ausgabe: tools/out/shapes_<n>.json und Kontrollbild."""
import json, math, sys
from pathlib import Path
import pymupdf as fitz
from shapely.geometry import Polygon, MultiPoint
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
PT = 72 / 25.4 * 20
OX, OY = 62.362, 113.386
FILES = {1: "WE13_Moeblierungskonzept.pdf", 2: "WE13_Moeblierungskonzept_2.pdf", 3: "WE13_Moeblierungskonzept_3.pdf", 4: "WE13_Moeblierungskonzept_4.pdf"}

def m(x, y):
    return ((x - OX) / PT, (y - OY) / PT)

def pts_of(items):
    out = []
    for it in items:
        if it[0] == "l":
            out += [(it[1].x, it[1].y), (it[2].x, it[2].y)]
        elif it[0] == "c":
            # Bezier abtasten
            p0, p1, p2, p3 = it[1:5]
            for k in range(9):
                t = k / 8
                x = (1-t)**3*p0.x + 3*(1-t)**2*t*p1.x + 3*(1-t)*t*t*p2.x + t**3*p3.x
                y = (1-t)**3*p0.y + 3*(1-t)**2*t*p1.y + 3*(1-t)*t*t*p2.y + t**3*p3.y
                out.append((x, y))
        elif it[0] == "re":
            r = it[1]; out += [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]
        elif it[0] == "qu":
            q = it[1]; out += [(q.ul.x, q.ul.y), (q.ur.x, q.ur.y), (q.lr.x, q.lr.y), (q.ll.x, q.ll.y)]
    return out

def run(n):
    doc = fitz.open(ROOT / FILES[n]); page = doc[0]
    dr = page.get_drawings()
    shapes = []
    for i, x in enumerate(dr):
        r = x["rect"]
        if r.x0 < 60 or r.x1 > 960 or r.y0 < 100 or r.y1 > 1080:
            continue
        f = x.get("fill")
        if not f or x["type"] not in ("f", "fs"):
            continue
        if f == (0.0, 0.0, 0.0) and x["type"] == "fs":
            continue
        pts = pts_of(x["items"])
        if len(pts) < 3:
            continue
        mp = MultiPoint(pts)
        area = Polygon(pts).buffer(0).area if len(pts) >= 3 else 0
        if r.width * r.height < 30 or r.width * r.height > 60000:
            continue
        if f[0] > 0.93 and f[1] > 0.92 and f[2] > 0.9 and r.width * r.height > 20000:
            continue  # Bodenflächen
        hexf = "#%02x%02x%02x" % tuple(int(v*255) for v in f)
        if x["type"] == "fs" and hexf == "#ffffff" and x.get("color") and abs(x["color"][0] - 0.4157) < 0.01 and 8 < r.width < 16:
            shapes.append({"i": i, "fill": "ceiling", "c": [round(v, 3) for v in m((r.x0 + r.x1) / 2, (r.y0 + r.y1) / 2)], "L": round(r.width / PT, 3), "W": round(r.height / PT, 3), "ang": 0, "curve": False, "nitems": len(x["items"]), "fillRatio": 1})
            continue
        if hexf in ("#f0efeb", "#2f3a31") or (hexf == "#ffffff" and r.width * r.height < 400):
            continue
        mrr = mp.minimum_rotated_rectangle
        c = list(mrr.exterior.coords)[:4]
        e1 = math.dist(c[0], c[1]); e2 = math.dist(c[1], c[2])
        if e1 >= e2:
            ang = math.degrees(math.atan2(c[1][1]-c[0][1], c[1][0]-c[0][0])); L, W = e1, e2
        else:
            ang = math.degrees(math.atan2(c[2][1]-c[1][1], c[2][0]-c[1][0])); L, W = e2, e1
        ang = (ang + 90) % 180 - 90
        cx, cy = mrr.centroid.x, mrr.centroid.y
        has_curve = any(it[0] == "c" for it in x["items"])
        shapes.append({
            "i": i, "fill": "#%02x%02x%02x" % tuple(int(v*255) for v in f),
            "c": [round(v, 3) for v in m(cx, cy)], "L": round(L/PT, 3), "W": round(W/PT, 3), "ang": round(ang, 2),
            "curve": has_curve, "nitems": len(x["items"]), "fillRatio": round(area / max(mrr.area, 1e-6), 2),
        })
    # Marken (Positionsnummern)
    labels = []
    for b in page.get_text("dict")["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                t = s["text"].strip(); x0, y0, x1, y1 = s["bbox"]
                if x1 < 960 and t and (t[0] in "WEFSAHBKT" and any(ch.isdigit() for ch in t) or t == "TV"):
                    labels.append({"t": t, "c": [round(v, 3) for v in m((x0+x1)/2, (y0+y1)/2)]})
    out = ROOT / "tools/out"; out.mkdir(exist_ok=True, parents=True)
    (out / f"shapes_{n}.json").write_text(json.dumps({"shapes": shapes, "labels": labels}, indent=0))
    # Kontrollbild
    S = 160 / 72
    pix = page.get_pixmap(clip=fitz.Rect(60, 100, 960, 1080), dpi=160)
    pix.save(f"/tmp/claude-0/sp/sh{n}.png")
    im = Image.open(f"/tmp/claude-0/sp/sh{n}.png").convert("RGB"); g = ImageDraw.Draw(im)
    for s in shapes:
        px = ((s["c"][0]*PT + OX - 60) * S, (s["c"][1]*PT + OY - 100) * S)
        g.text((px[0]-6, px[1]-5), str(s["i"]), fill=(255, 0, 0))
    im.save(f"/tmp/claude-0/sp/sh{n}_ids.png")
    print(n, len(shapes), len(labels))

for n in (sys.argv[1:] or ["1", "2", "3", "4"]):
    run(int(n))
