"""Erzeugt die kachelbare Farbtextur „Laminam® Noir Désir“ (schwarzbraun, ockerfarbene Adern mit hellem Kern).

2048 px entsprechen 2,0 m (1 mm/px, MAT_DEFS.marbleNoir.scale = 2.0). Adern laufen schräg zur u-Achse
(Tischlänge), wie bei der Laminam-Vorlage. Ausgabe: app/public/assets/textures/noirdesir_color.webp
"""
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = Path(__file__).resolve().parent.parent / "app/public/assets/textures/noirdesir_color.webp"
N = 2048          # Zielauflösung
SS = 2            # Supersampling
S = N * SS
rnd = random.Random(2510)
np_r = np.random.default_rng(2510)


def fbm(n, octaves, beta=2.2):
    """Kachelbares 1/f-Rauschen (FFT, periodisch), 0..1."""
    f = np.fft.fftfreq(n)
    k = np.sqrt(f[:, None] ** 2 + f[None, :] ** 2)
    k[0, 0] = 1
    amp = k ** (-beta / 2)
    amp[k < 1 / n * 2] = 0
    amp[k > octaves / n] *= 0.6
    ph = np.exp(2j * np.pi * np_r.random((n, n)))
    a = np.real(np.fft.ifft2(amp * ph))
    a = (a - a.min()) / (a.max() - a.min())
    return a


def path(x0, y0, length, ang, rough=0.10, depth=8, decay=0.42):
    x1, y1 = x0 + math.cos(ang) * length, y0 + math.sin(ang) * length
    pts = [(x0, y0), (x1, y1)]
    amp = length * rough
    for _ in range(depth):
        nxt = [pts[0]]
        for (ax, ay), (bx, by) in zip(pts, pts[1:]):
            dx, dy = bx - ax, by - ay
            l = math.hypot(dx, dy) or 1
            o = rnd.gauss(0, amp)
            nxt += [((ax + bx) / 2 - dy / l * o, (ay + by) / 2 + dx / l * o), (bx, by)]
        pts = nxt
        amp *= decay
    return pts


gold = Image.new("L", (S, S), 0)
white = Image.new("L", (S, S), 0)
halo = Image.new("L", (S, S), 0)
gd, wd, hd = ImageDraw.Draw(gold), ImageDraw.Draw(white), ImageDraw.Draw(halo)


def draw(d, pts, w, val, taper=True):
    """Ader auf dem Torus zeichnen; Breite schwillt entlang der Ader an und läuft an den Enden aus."""
    n = len(pts)
    ph = rnd.uniform(0, 6.28)
    for ox in (-S, 0, S):
        for oy in (-S, 0, S):
            q = [(x + ox, y + oy) for x, y in pts]
            xs = [x for x, _ in q]
            ys = [y for _, y in q]
            if max(xs) < -w or min(xs) > S + w or max(ys) < -w or min(ys) > S + w:
                continue
            if not taper:
                d.line(q, fill=val, width=max(1, int(round(w))), joint="curve")
                continue
            step = 4
            for i in range(0, n - 1, step):
                t = i / max(1, n - 1)
                f = min(1.0, math.sin(math.pi * t) * 2.2) * (0.75 + 0.25 * math.sin(ph + t * 17))
                ww = max(1, int(round(w * max(0.25, f))))
                d.line(q[i:i + step + 1], fill=val, width=ww, joint="curve")


BASE_ANG = math.radians(-24)  # Bildkoordinaten: y nach unten → Adern steigen nach rechts an
veins = []
# Hauptadern: breit, ocker mit hellem, unterbrochenem Kern
for _ in range(12):
    a = BASE_ANG + rnd.gauss(0, 0.07)
    pts = path(rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(0.9, 1.6) * S, a, 0.03)
    w = rnd.uniform(8.0, 15.0) * SS
    draw(hd, pts, w * 4, 70)
    draw(gd, pts, w, 255)
    # heller Kern in Abschnitten
    i = 0
    while i < len(pts) - 2:
        seg = rnd.randint(20, 120)
        if rnd.random() < 0.65:
            draw(wd, pts[i:i + seg], w * rnd.uniform(0.45, 0.7), 245)
        i += seg + rnd.randint(10, 80)
    veins.append(pts)
# Begleitadern (parallel, mittel)
for _ in range(20):
    a = BASE_ANG + rnd.gauss(0, 0.12)
    pts = path(rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(0.3, 0.9) * S, a, 0.03)
    w = rnd.uniform(1.6, 3.4) * SS
    draw(hd, pts, w * 3, 40)
    draw(gd, pts, w, 235)
    if rnd.random() < 0.35:
        draw(wd, pts[: len(pts) // 3], w * 0.6, 200)
    veins.append(pts)
# Verzweigungen von den Adern
for _ in range(60):
    src = rnd.choice(veins)
    x0, y0 = src[rnd.randrange(len(src))]
    a = BASE_ANG + rnd.choice((-1, 1)) * rnd.uniform(0.15, 0.6)
    pts = path(x0, y0, rnd.uniform(0.04, 0.25) * S, a, 0.06)
    draw(gd, pts, rnd.uniform(0.8, 1.6) * SS, rnd.randint(120, 200))
# Haarrisse quer und schräg
for _ in range(45):
    a = BASE_ANG + rnd.choice((0.9, -0.5, 1.3)) + rnd.gauss(0, 0.2)
    pts = path(rnd.uniform(0, S), rnd.uniform(0, S), rnd.uniform(0.05, 0.3) * S, a, 0.08)
    draw(gd, pts, 0.8 * SS, rnd.randint(50, 110), False)

gold = np.asarray(gold.resize((N, N), Image.LANCZOS), dtype=np.float32) / 255
white = np.asarray(white.resize((N, N), Image.LANCZOS), dtype=np.float32) / 255
halo = np.asarray(halo.resize((N, N), Image.LANCZOS).filter(ImageFilter.GaussianBlur(6)), dtype=np.float32) / 255

# Grund: schwarzbraun, wolkig mit dunkleren Flecken
n1 = fbm(N, 40)
n2 = fbm(N, 400, 1.4)
base = np.array([40, 35, 29], np.float32)
n3 = fbm(N, 120, 1.8)
var = 0.72 + 0.42 * n1 + 0.22 * (n3 - 0.5) + 0.10 * (n2 - 0.5)
img = base[None, None, :] * var[..., None]
# Adern: Halo leicht ocker, dann Ocker, dann heller Kern (grauweiß)
ochre = np.array([166, 112, 52], np.float32)
cream = np.array([214, 208, 196], np.float32)
img = img * (1 - 0.25 * halo[..., None]) + np.array([95, 70, 40], np.float32) * 0.25 * halo[..., None]
gv = gold * (0.85 + 0.3 * n2)[...]
gv = np.clip(gv, 0, 1)[..., None]
img = img * (1 - gv) + ochre * (0.8 + 0.35 * n2[..., None]) * gv
wv = np.clip(white * (0.7 + 0.6 * n2), 0, 1)[..., None]
img = img * (1 - wv) + cream * wv
img = np.clip(img, 0, 255).astype(np.uint8)
Image.fromarray(img, "RGB").save(OUT, "WEBP", quality=88, method=6)
print(OUT, OUT.stat().st_size)
