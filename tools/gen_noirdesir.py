"""Farbtextur „Laminam® Noir Désir“ der Tischplatte DELIFE Edge aus dem Dekorfoto des Herstellers.

Quelle: tools/research/data/noirdesir_laminam.avif (DELIFE-Produktfoto der Platte, 1600 × 1333 px, Schriftzug unten rechts).
Ausschnitt 1600 × 800 px ohne Schriftzug → 2048 × 1024 px für die ganze Platte 200 × 100 cm (≈ 1 mm/px).
MAT_DEFS.marbleNoir legt die Textur mit fit = 2,0 × 1,0 m genau einmal auf die Platte (Adern schräg zur Tischlänge
wie auf dem Foto); andere Plattengrößen setzen sie gespiegelt fort, damit keine Stoßkante entsteht.
Ausgabe: app/public/assets/textures/noirdesir_color.webp
"""
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "tools/research/data/noirdesir_laminam.avif"
OUT = ROOT / "app/public/assets/textures/noirdesir_color.webp"
CROP = (0, 250, 1600, 1050)  # x0, y0, x1, y1 – Hauptader diagonal durch die Plattenmitte, Schriftzug (y > 1240) außerhalb
SIZE = (2048, 1024)

im = Image.open(SRC).convert("RGB").crop(CROP).resize(SIZE, Image.LANCZOS)
im.save(OUT, "WEBP", quality=90, method=6)
print(OUT, OUT.stat().st_size)
