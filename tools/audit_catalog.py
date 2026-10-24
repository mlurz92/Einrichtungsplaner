"""Qualitätsprüfung des Katalogs (app/src/data/catalog.json).

Prüft je Produkt/Variante:
- Farbe: Variantenname nennt eine Farbe, die zur Slot-Farbe (Hauptteil/Schirm/Platte) nicht passt
- Varianten mit verschiedenen Namen, aber identischer Darstellung (Farbinformation verloren)
- Maße unplausibel für den Archetyp
Ausgabe: Zusammenfassung + tools/out/audit.json (alle Befunde).
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from build_catalog import COLORS  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CAT = json.loads((ROOT / "app/src/data/catalog.json").read_text())

# Plausible Bereiche (cm) je Archetyp: (w, d, h) jeweils (min, max)
DIMS = {
    "sofa": ((120, 480), (65, 200), (55, 110)), "sofaModular": ((70, 450), (65, 200), (55, 110)),
    "sofaCorner": ((160, 480), (120, 380), (55, 110)), "sofaBed": ((90, 340), (70, 200), (60, 110)),
    "armchairLounge": ((55, 140), (55, 170), (55, 115)), "armchairRound": ((55, 145), (55, 145), (55, 115)),
    "armchairWing": ((60, 110), (60, 110), (90, 130)), "armchairShell": ((45, 100), (45, 100), (60, 110)),
    "diningChair": ((38, 70), (40, 70), (70, 110)), "diningArmchair": ((45, 75), (45, 75), (70, 110)),
    "cantilever": ((38, 70), (40, 75), (70, 110)), "barStool": ((30, 60), (30, 60), (60, 115)),
    "pouf": ((25, 120), (25, 120), (25, 75)), "bench": ((60, 250), (25, 70), (35, 90)),
    "tableRect": ((60, 320), (50, 180), (65, 80)), "chairFlex": ((38, 75), (40, 75), (70, 125)),
    "benchFlex": ((60, 320), (30, 220), (35, 100)), "tableRound": ((60, 160), (60, 160), (65, 80)),
    "tableOval": ((120, 300), (70, 130), (65, 80)), "tablePedestal": ((60, 180), (60, 180), (65, 80)),
    "coffeeRound": ((40, 140), (40, 140), (20, 55)), "coffeeBlock": ((50, 180), (30, 120), (20, 55)),
    "coffeeDuo": ((60, 160), (40, 120), (20, 55)), "sideRound": ((25, 70), (25, 70), (30, 75)),
    "sideContainer": ((25, 70), (25, 70), (30, 80)), "desk": ((60, 260), (28, 120), (55, 90)),
    "deskStanding": ((90, 200), (50, 90), (60, 130)), "console": ((60, 220), (15, 70), (15, 130)),
    "sideboard": ((60, 300), (30, 60), (50, 140)), "lowboard": ((60, 360), (30, 60), (20, 100)),
    "vitrine": ((30, 300), (15, 60), (40, 240)), "bookcase": ((30, 240), (20, 60), (25, 260)),
    "shelfOpen": ((20, 450), (8, 65), (3, 260)), "wardrobe": ((40, 450), (35, 85), (100, 256)),
    "dresser": ((30, 220), (15, 65), (30, 160)), "nightstand": ((25, 80), (25, 60), (12, 80)),
    "bed": ((80, 280), (190, 300), (25, 140)), "bedWood": ((90, 230), (190, 240), (20, 140)),
    "tylkoStorage": ((25, 650), (20, 70), (10, 260)),
    "lampFloorShade": ((8, 95), (8, 95), (35, 230)), "lampFloorGlobe": ((15, 80), (15, 80), (100, 210)),
    "lampFloorArc": ((30, 250), (20, 180), (120, 240)), "lampFloorTripod": ((30, 80), (30, 80), (100, 200)),
    "lampTableMushroom": ((8, 60), (8, 60), (10, 80)), "lampTableGlobe": ((8, 60), (8, 60), (10, 80)),
    "lampTableShade": ((8, 70), (8, 70), (10, 100)), "lampTableLayered": ((10, 60), (10, 60), (15, 80)),
    "lampTask": ((10, 120), (10, 80), (10, 260)),
}

FAMILIES = [  # Farbfamilien für die Grobprüfung (Name → erwarteter Farbton)
    ("weiß", "weiss", "white", "creme", "elfenbein", "offwhite", "off white", "naturweiß"),
    ("schwarz", "black", "anthrazit", "graphit"),
    ("grau", "grey", "gray", "silber", "greige", "taupe"),
    ("beige", "sand", "kaschmir", "schlamm"),
    ("braun", "hellbraun", "cognac", "espresso", "nougat", "karamell", "mokka", "walnuss", "nussbaum", "eiche dunkel", "dunkle eiche"),
    ("grün", "salbei", "oliv", "petrol", "türkis", "mint"),
    ("blau", "marine", "navy", "nachtblau", "mitternachtsblau"),
    ("rot", "bordeaux", "weinrot", "burgund", "terrakotta", "rost", "rosa", "pink", "altrosa", "koralle"),
    ("gelb", "senf", "ocker", "gold", "messing", "curry"),
]


def hex_rgb(h):
    h = h.lstrip("#")
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def hsl(h):
    r, g, b = (x / 255 for x in hex_rgb(h))
    mx, mn = max(r, g, b), min(r, g, b)
    l = (mx + mn) / 2
    if mx == mn:
        return 0.0, 0.0, l
    d = mx - mn
    s = d / (2 - mx - mn) if l > 0.5 else d / (mx + mn)
    if mx == r:
        hh = (g - b) / d + (6 if g < b else 0)
    elif mx == g:
        hh = (b - r) / d + 2
    else:
        hh = (r - g) / d + 4
    return hh * 60, s, l


def family_of_name(name):
    n = name.lower()
    best = None
    for i, fam in enumerate(FAMILIES):
        for k in fam:
            m = re.search(r"(?<![a-zäöüß])" + re.escape(k), n)  # Wortanfang („Hocker“ ist kein „Ocker“)
            if m and (best is None or m.start() < best[1]):
                best = (i, m.start())
    return best[0] if best else None


def family_ok(fi, color):
    h, s, l = hsl(color)
    fam = FAMILIES[fi][0]
    if fam == "weiß":
        return l >= 0.78
    if fam == "schwarz":
        return l <= 0.3
    if fam == "grau":
        return s <= 0.25 or l >= 0.7
    if fam == "beige":
        return l >= 0.55 and (s <= 0.55) and (20 <= h <= 60 or s < 0.12)
    if fam == "braun":
        return l <= 0.6 and (10 <= h <= 45 or s < 0.15)
    if fam == "grün":
        return 60 <= h <= 200 and s >= 0.08
    if fam == "blau":
        return 180 <= h <= 260 and s >= 0.08
    if fam == "rot":
        return (h <= 25 or h >= 320) and s >= 0.15
    if fam == "gelb":
        return 30 <= h <= 65 and s >= 0.25
    return True


def main_color(slots):
    for k in ("main", "shade", "top", "frame"):
        if k in slots:
            return slots[k]["color"]
    return None


def main():
    issues = {"color": [], "duplicate": [], "dims": []}
    for e in CAT:
        if e["vendor"] == "Bestand":
            continue
        seen = {}
        for v in e["variants"]:
            col = main_color(v.get("slots") or {})
            fi = family_of_name(v["name"].split("/")[0].split(",")[0])
            cols = [x["color"] for x in (v.get("slots") or {}).values() if isinstance(x, dict) and x.get("color")]
            # Farben aus Original-Stoffmustern gelten als gemessen (z. B. „Olivgrün“ eines Bouclés ist oft khaki-braun)
            if col and fi is not None and not v.get("swatch") and not any(family_ok(fi, c) for c in cols):
                issues["color"].append({"id": e["id"], "vendor": e["vendor"], "name": e["name"], "variant": v["name"], "color": col, "family": FAMILIES[fi][0]})
            sig = json.dumps([v.get("slots"), v.get("params")], sort_keys=True)
            if sig in seen and seen[sig] != v["name"]:
                issues["duplicate"].append({"id": e["id"], "vendor": e["vendor"], "a": seen[sig], "b": v["name"]})
            seen.setdefault(sig, v["name"])
        rng = DIMS.get(e["archetype"])
        if rng and e["archetype"].startswith("table") and re.search(r"\bbar|bartisch|stehtisch", e["name"].lower()):
            rng = (rng[0], rng[1], (85, 115))
        if rng:
            for k, (lo, hi) in zip(("w", "d", "h"), rng):
                if not (lo <= e[k] <= hi):
                    issues["dims"].append({"id": e["id"], "vendor": e["vendor"], "name": e["name"], "arch": e["archetype"], "dim": k, "val": e[k], "range": [lo, hi]})
    (ROOT / "tools/out").mkdir(exist_ok=True)
    (ROOT / "tools/out/audit.json").write_text(json.dumps(issues, ensure_ascii=False, indent=1))
    total_v = sum(len(e["variants"]) for e in CAT)
    print(f"Produkte {len(CAT)}, Varianten {total_v}")
    for k, v in issues.items():
        by = {}
        for x in v:
            by[x["vendor"]] = by.get(x["vendor"], 0) + 1
        print(f"{k}: {len(v)}  {by}")
    return issues


if __name__ == "__main__":
    main()
