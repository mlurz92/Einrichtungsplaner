"""Erzeugt den Möbelkatalog (app/src/data/catalog.json) aus
  - den Konzeptprodukten (app/src/data/conceptCatalog.json, build_concepts.py),
  - Westwing-Produktseiten (tools/research/data/westwing_products.json),
  - IKEA-Suchergebnissen (tools/research/data/ikea_products.json),
  - JYSK-Produktseiten (tools/research/data/jysk_products.json).

Fokus: hochwertige/luxuriöse Linien. Westwing komplett (Westwing Collection = Premium), IKEA nur
ausgewählte Design-/Premiumserien, JYSK nur obere Preis-/Materialklasse je Kategorie.
Maße werden in cm übernommen, Farben/Materialien aus den Shopangaben auf Material-Vorlagen abgebildet.
"""
import json, re, statistics
from pathlib import Path

from finish import slots_from, variant_label

ROOT = Path(__file__).resolve().parents[1]
RES = ROOT / "tools/research/data"
DATA = ROOT / "app/src/data"

# ------------------------------------------------------------------ Farben / Materialien
COLORS = [
    ("off white", "#efebe3"), ("offwhite", "#efebe3"), ("cremeweiß", "#efe8da"), ("cremefarben", "#ece3d0"), ("creme", "#ece3d0"),
    ("elfenbeinweiß", "#efe8d8"), ("elfenbein", "#efe8d8"), ("naturweiß", "#f1ede4"), ("weiß", "#f4f2ee"), ("weiss", "#f4f2ee"),
    ("hellbeige", "#e3d7c4"), ("dunkelbeige", "#c4b199"), ("graubeige", "#c9bfae"), ("beige", "#d9cbb4"), ("sand", "#d8c7a8"),
    ("greige", "#cfc6b8"), ("taupe", "#a89a88"), ("nougat", "#b08f72"), ("karamell", "#b98a5a"), ("cognac", "#9a5b34"),
    ("hellbraun", "#b08a63"), ("dunkelbraun", "#4e3a2c"), ("espresso", "#3e2c22"), ("schwarzbraun", "#2d2420"), ("braun", "#7a5a43"),
    ("rostrot", "#a5563b"), ("rost", "#a5563b"), ("terrakotta", "#b8653f"), ("terracotta", "#b8653f"), ("ocker", "#c49a45"),
    ("senf", "#c9a43c"), ("dunkelgelb", "#c9a43c"), ("gelb", "#e0c45a"), ("altrosa", "#c99a96"), ("rosa", "#e3b8b4"), ("pink", "#d98aa0"),
    ("peach", "#e8b89a"), ("weinrot", "#6e232f"), ("bordeaux", "#6e232f"), ("burgund", "#6e232f"), ("dunkelrot", "#7a2a2a"), ("rot", "#b23a32"),
    ("hellgrün", "#b9c9a8"), ("salbeigrün", "#a7b59e"), ("salbei", "#a7b59e"), ("graugrün", "#97a38e"), ("olivgrün", "#6e7450"),
    ("oliv", "#6e7450"), ("dunkelgrün", "#2f4a3a"), ("tannengrün", "#2f4a3a"), ("grün", "#5d7a5a"), ("petrol", "#2f7074"),
    ("grautürkis", "#5f8a8a"), ("türkis", "#3f8f8f"), ("hellblau", "#a9c1d6"), ("graublau", "#5b6f84"), ("dunkelblau", "#253a5e"),
    ("nachtblau", "#22314a"), ("blau", "#3f6680"), ("hellgrau", "#c9c8c4"), ("dunkelgrau", "#4a4a48"), ("anthrazit", "#3a3b3c"),
    ("grau", "#8d8d8a"), ("schwarz", "#1d1d1d"), ("silber", "#c6cbd0"), ("chrom", "#c6cbd0"), ("gold", "#c9a55c"), ("messing", "#c9a55c"),
    ("kupfer", "#b8703e"), ("bronze", "#8c6a43"), ("natur", "#d8bc94"), ("eiche", "#c9a477"), ("walnuss", "#6b4a33"), ("nussbaum", "#6b4a33"),
    ("mango", "#6d4c36"), ("teak", "#9a6c45"), ("akazie", "#8e6440"), ("transparent", "#e8eef0"), ("travertin", "#e3d6c1"), ("marmor", "#e7ddd0"),
]

MATS = [
    ("teddy", "teddy"), ("bouclé", "boucle"), ("boucle", "boucle"), ("samt", "velvet"), ("velours", "velvet"), ("cord", "cord"),
    ("leinen", "linen"), ("leder", "leather"), ("wolle", "wool"), ("jute", "wool"), ("chenille", "fabric"), ("webstoff", "fabric"),
    ("travertin", "travertine"), ("grün marm", "marbleGreen"), ("marmor", "marble"), ("stein", "stone"), ("beton", "stone"),
    ("walnuss", "walnut"), ("nussbaum", "walnut"), ("wurzelholz", "burl"), ("mango", "mango"), ("esche", "ash"), ("dunkle eiche", "oakDark"),
    ("eiche dunkel", "oakDark"), ("eiche", "oak"), ("teak", "oak"), ("akazie", "walnut"), ("buche", "oak"), ("kiefer", "oak"),
    ("riffelglas", "ribbedGlass"), ("opal", "opal"), ("glas", "glass"), ("spiegel", "mirror"), ("messing", "brass"), ("gold", "brass"),
    ("kupfer", "copper"), ("chrom", "chrome"), ("silber", "chrome"), ("edelstahl", "steel"), ("rattan", "rattan"), ("geflecht", "rattan"),
    ("keramik", "ceramic"), ("steingut", "ceramic"), ("steinzeug", "ceramic"), ("porzellan", "ceramic"), ("lackiert", "lacquer"),
    ("hochglanz", "gloss"), ("metall", "blackMetal"), ("holz", "oak"), ("stoff", "fabric"),
]


def color_of(text, default="#d9cbb4"):
    t = (text or "").lower()
    best = None
    for k, v in COLORS:
        i = t.find(k)
        if i >= 0 and (best is None or i < best[0] or (i == best[0] and len(k) > best[2])):
            best = (i, v, len(k))
    return best[1] if best else default


def mat_of(text, default="fabric"):
    t = (text or "").lower()
    for k, v in MATS:
        if k in t:
            return v
    return default


def slots_for(category, color_text, material_text, name=""):
    """Slot-Belegung aus Farb-/Materialtext (Polster: main; Gestell: legs; Tisch: top/legs)."""
    txt = f"{color_text} {material_text} {name}"
    c = color_of(color_text or name)
    m = mat_of(f"{color_text} {material_text} {name}")
    if category in ("sofa", "armchair", "pouf", "bench", "bed", "chair", "officeChair"):
        if m in ("oak", "walnut", "mango", "ash", "oakDark", "travertine", "marble", "stone", "brass", "chrome", "steel", "blackMetal", "glass"):
            m = "fabric"
        legs_m = "oak" if any(w in txt.lower() for w in ("holzbein", "eschenholz", "eichenholz", "holzfüß", "holz")) else "blackMetal"
        legs_c = "#a37a52" if legs_m == "oak" else ("#c9a55c" if "gold" in txt.lower() else ("#c6cbd0" if any(w in txt.lower() for w in ("silber", "chrom")) else "#1d1d1d"))
        if legs_c in ("#c9a55c",):
            legs_m = "brass"
        elif legs_c == "#c6cbd0":
            legs_m = "chrome"
        return {"main": {"color": c, "material": m}, "legs": {"color": legs_c, "material": legs_m}}
    if category in ("coffeeTable", "sideTable", "diningTable", "console", "desk"):
        top = m if m not in ("fabric",) else "oak"
        return {"top": {"color": c, "material": top}, "legs": {"color": c if top in ("oak", "walnut", "mango", "oakDark", "ash", "burl") else "#1d1d1d", "material": top if top in ("oak", "walnut", "mango", "oakDark", "ash", "burl") else "blackMetal"}, "main": {"color": c, "material": top}}
    if category in ("floorLamp", "tableLamp", "pendant", "ceilingLamp", "wallLamp"):
        metal = "brass" if any(w in txt.lower() for w in ("messing", "gold")) else ("copper" if "kupfer" in txt.lower() else ("chrome" if any(w in txt.lower() for w in ("chrom", "silber")) else ("blackMetal" if "schwarz" in txt.lower() else "matte")))
        mc = {"brass": "#c9a55c", "copper": "#b8703e", "chrome": "#c6cbd0", "blackMetal": "#1d1d1d"}.get(metal, c)
        shade_m = "opal" if any(w in txt.lower() for w in ("glas", "opal", "milch", "weiß")) else ("linen" if any(w in txt.lower() for w in ("leinen", "stoff", "textil")) else ("rattan" if "rattan" in txt.lower() else metal))
        return {"main": {"color": mc, "material": metal}, "shade": {"color": "#f6f4ee" if shade_m == "opal" else (c if shade_m != metal else mc), "material": shade_m}}
    if category in ("rug", "curtain", "textile"):
        return {"main": {"color": c, "material": "wool" if category == "rug" else ("linen" if m not in ("velvet", "boucle") else m)}}
    if category == "mirror":
        return {"frame": {"color": c, "material": m if m != "fabric" else "blackMetal"}}
    if category == "art":
        return {"main": {"color": c, "material": "canvas"}, "secondary": {"color": "#8f8576", "material": "canvas"}, "frame": {"color": "#b38c60", "material": "oak"}}
    if category == "plant":
        return {"main": {"color": "#56703f", "material": "plant"}, "secondary": {"color": c if c != "#d9cbb4" else "#d8ccb6", "material": "ceramic"}}
    if category in ("decor",):
        return {"main": {"color": c, "material": m if m != "fabric" else "ceramic"}}
    if m in ("fabric",):
        m = "lacquer"
    return {"main": {"color": c, "material": m}, "legs": {"color": c, "material": m}}


# ------------------------------------------------------------------ Maße
def nums(s):
    return [float(x.replace(",", ".")) for x in re.findall(r"\d+(?:[.,]\d+)?", s)]


def parse_westwing(size, cat):
    s = (size or "").replace("\xa0", " ")
    first = s.split("\n")[0] if s else ""
    seg = s
    m = re.search(r"Gesamtmaße[^:]*:\s*([^\n]+)", s)
    if m:
        seg = m.group(1)
    else:
        seg = first
    W = D = H = None
    dm = re.search(r"Ø\s*([\d.,]+)", seg)
    for key, val in re.findall(r"\b([BTHL])\s*([\d.,]+)", seg):
        v = float(val.replace(",", "."))
        if key == "B" and W is None: W = v
        elif key == "T" and D is None: D = v
        elif key == "H" and H is None: H = v
        elif key == "L" and D is None: D = v
    if dm:
        dia = float(dm.group(1).replace(",", "."))
        W = W or dia; D = D or dia
    if cat == "rug":
        mm = re.search(r"(\d+)\s*x\s*(\d+)", s)
        if mm and (W is None or D is None):
            W, D = float(mm.group(1)), float(mm.group(2))
        H = H or 1.5
    return W, D, H


def parse_ikea(meas, typ):
    s = (meas or "").replace(" ", "")
    W = D = H = None
    if "Ø" in s:
        n = nums(s)
        if len(n) == 1:
            W = D = n[0]
        elif len(n) >= 2:
            W = D = n[0]; H = n[1]
        return W, D, H
    n = nums(s)
    t = (typ or "").lower()
    if len(n) >= 3:
        W, D, H = n[0], n[1], n[2]
    elif len(n) == 2:
        if "teppich" in t or "vorhang" in t or "gardine" in t or "decke" in t or "plaid" in t:
            W, D, H = n[0], n[1], 1.2
        elif any(k in t for k in ("bild", "spiegel", "rahmen")):
            W, D, H = n[0], 3, n[1]
        else:
            W, D = n[0], n[1]
    elif len(n) == 1:
        H = n[0]
    return W, D, H


def parse_jysk(specs):
    for key in ("Größe montiert", "Größe", "Maße", "Abmessungen"):
        s = (specs or {}).get(key)
        if s:
            W = D = H = None
            for k, v in re.findall(r"(Breite|Tiefe|Höhe|Länge|Durchmesser):\s*([\d.,]+)", s):
                v = float(v.replace(",", "."))
                if k == "Breite": W = v
                elif k in ("Tiefe",): D = v
                elif k == "Länge": D = D or v
                elif k == "Höhe": H = v
                elif k == "Durchmesser": W = D = v
            return W, D, H
    return None, None, None


DEFAULT_DIMS = {
    "sofa": (220, 95, 80), "armchair": (85, 85, 75), "chair": (50, 55, 82), "stool": (40, 40, 75), "pouf": (50, 50, 42), "bench": (140, 40, 45),
    "coffeeTable": (100, 60, 35), "sideTable": (45, 45, 50), "diningTable": (180, 90, 75), "desk": (120, 60, 75), "console": (120, 35, 80),
    "sideboard": (160, 45, 75), "lowboard": (180, 42, 50), "cabinet": (90, 40, 180), "shelf": (80, 35, 180), "wardrobe": (100, 58, 236),
    "dresser": (90, 45, 85), "bed": (160, 210, 100), "nightstand": (45, 40, 50), "officeChair": (65, 65, 100), "floorLamp": (40, 40, 160),
    "tableLamp": (25, 25, 40), "pendant": (40, 40, 30), "ceilingLamp": (35, 35, 15), "wallLamp": (20, 20, 25), "rug": (200, 300, 1.5),
    "curtain": (140, 10, 250), "art": (70, 3, 100), "mirror": (60, 3, 90), "plant": (60, 60, 150), "decor": (25, 25, 30), "textile": (50, 15, 50),
    "outdoor": (60, 60, 75),
}


def arch_for(cat, name, W, D, H):
    n = (name or "").lower()
    rnd = W is not None and D is not None and abs(W - D) < 1 and any(k in n for k in ("rund", "ø", "kugel")) or ("rund" in n)
    if cat == "sofa":
        if any(k in n for k in ("schlafsofa", "bettsofa", "schlafcouch")): return "sofaBed"
        if any(k in n for k in ("ecksofa", "wohnlandschaft", "récamiere", "recamiere", "ottomane", "chaiselongue", "u-sofa")): return "sofaCorner"
        if any(k in n for k in ("nieren", "wolke", "alba", "organisch", "rund", "lillesäter", "gullvalla")): return "sofaRound"
        if any(k in n for k in ("modular", "modul", "lennon", "söderhamn", "jättebo", "vetsak")): return "sofaModular"
        return "sofa"
    if cat == "armchair":
        if any(k in n for k in ("ohrensessel", "wing", "strandmon")): return "armchairWing"
        if any(k in n for k in ("cocktail", "schale", "koarp", "drehsessel")): return "armchairShell"
        if any(k in n for k in ("nieren", "rund", "sofia", "alba", "wolke", "tayla", "teddy", "bouclé-sessel")): return "armchairRound"
        return "armchairLounge"
    if cat == "chair":
        if "freischwinger" in n or "jordan" in n: return "cantilever"
        if any(k in n for k in ("barhocker", "barstuhl", "tresen")): return "barStool"
        if "armlehn" in n: return "diningArmchair"
        return "diningChair"
    if cat == "stool": return "barStool" if (H or 0) > 60 else "pouf"
    if cat == "pouf": return "pouf"
    if cat == "bench": return "bench"
    if cat == "coffeeTable":
        if "2er" in n or "duo" in n or "set" in n: return "coffeeDuo"
        if rnd or "ø" in n: return "coffeeRound"
        if any(k in n for k in ("oval", "organisch")): return "tableOval"
        if any(k in n for k in ("block", "monolith", "sockel", "travertin", "marisa")): return "coffeeBlock"
        return "tableRect"
    if cat == "sideTable":
        if any(k in n for k in ("container", "componibili", "rollwagen")): return "sideContainer"
        return "sideRound" if (rnd or W == D) else "tableRect"
    if cat == "diningTable":
        if any(k in n for k in ("oval", "organisch")): return "tableOval"
        if rnd or (W and D and abs(W - D) < 2): return "tablePedestal" if any(k in n for k in ("säule", "sockel", "marmor", "abby", "noam", "sculpt", "fuß")) else "tableRound"
        return "tableRect"
    if cat == "desk": return "deskStanding" if any(k in n for k in ("sitz/steh", "höhenverstell", "elektr", "mittzon", "idåsen", "trotten")) else "desk"
    if cat == "console": return "console"
    if cat == "sideboard": return "dresser" if (H or 0) > 100 else "sideboard"
    if cat == "lowboard": return "lowboard"
    if cat == "cabinet": return "vitrine" if any(k in n for k in ("vitrine", "glas")) else "dresser"
    if cat == "shelf": return "bookcase" if any(k in n for k in ("bücher", "billy", "hemnes", "havsta")) else "shelfOpen"
    if cat == "wardrobe": return "wardrobe"
    if cat == "dresser": return "dresser"
    if cat == "nightstand": return "nightstand"
    if cat == "bed": return "bedWood" if any(k in n for k in ("holzbett", "massivholz", "holz-bett", "tammy", "sato", "nanto", "jones", "hemnes", "idanäs", "hauga", "tufjord")) and "polster" not in n else "bed"
    if cat == "officeChair": return "officeChair"
    if cat == "floorLamp":
        if "bogen" in n: return "lampFloorArc"
        if any(k in n for k in ("kugel", "glo", "globe", "ic lights")): return "lampFloorGlobe"
        if any(k in n for k in ("dreibein", "tripod")): return "lampFloorTripod"
        return "lampFloorShade"
    if cat == "tableLamp":
        if any(k in n for k in ("pilz", "mushroom", "panthella", "flowerpot", "akku", "portable", "kian")): return "lampTableMushroom"
        if "kugel" in n or "globe" in n: return "lampTableGlobe"
        return "lampTableShade"
    if cat == "pendant":
        if any(k in n for k in ("3er", "cluster", "traube")): return "pendantCluster"
        if any(k in n for k in ("kugel", "glas", "glo", "opal", "globe")): return "pendantGlobe"
        return "pendantDome"
    if cat == "ceilingLamp": return "ceilingDisc" if (H or 20) < 12 else "ceilingDome"
    if cat == "wallLamp": return "wallGlobe" if "kugel" in n else "wallSconce"
    if cat == "rug":
        if rnd or "ø" in n: return "rugRound"
        if any(k in n for k in ("organisch", "form")): return "rugOrganic"
        return "rugRect"
    if cat == "mirror":
        if rnd or "rund" in n: return "mirrorRound"
        if "bogen" in n: return "mirrorArch"
        return "mirrorRect"
    if cat == "art": return "art"
    if cat == "decor": return "vase" if any(k in n for k in ("vase",)) else ("bowl" if "schale" in n else ("candles" if "kerze" in n else "vase"))
    if cat == "plant": return "plantTree" if (H or 0) > 120 else "plantBush"
    if cat == "curtain": return "curtain"
    if cat == "textile": return "cushion" if "kissen" in n else "throw"
    if cat == "outdoor":
        if any(k in n for k in ("sofa", "lounge")): return "outdoorSofa"
        if any(k in n for k in ("tisch",)): return "outdoorTable"
        return "outdoorChair"
    return "box"


MOUNT = {"pendant": "ceiling", "ceilingLamp": "ceiling", "wallLamp": "wall", "art": "wall", "mirror": "wall", "curtain": "ceiling"}
ELEV = {"wallLamp": 1.75, "art": 1.0, "mirror": 1.1}


EXCLUDE_NAME = re.compile(r"\bTisch und\b|\bTisch \+|\+ \d+ (?:Bar)?[Ss]tühle|Stühle \+|\bHaken\b|\bSockel\b|Garderobe\b.*Haken|Ersatzbezug|Bezug für", re.I)


def fix_geometry(e):
    """Archetyp/Maße plausibilisieren (Couchtische, vertauschte Breite/Tiefe, Récamiere-Tiefe, Ecksofas)."""
    a, cat = e["archetype"], e["category"]
    if a in ("tableRect", "tableOval", "tablePedestal", "tableRound") and e["h"] < 60:
        e["category"] = "coffeeTable" if max(e["w"], e["d"]) >= 60 else "sideTable"
        e["archetype"] = ("coffeeRound" if a in ("tableRound", "tablePedestal") else "coffeeBlock") if max(e["w"], e["d"]) >= 60 else "sideRound" if a in ("tableRound", "tablePedestal") else "sideContainer"
    elif a in ("tableRect", "tableOval") and max(e["w"], e["d"]) < 60:
        e["category"], e["archetype"] = "sideTable", "sideContainer"
    if a == "console" and e["w"] < 60:
        e["category"], e["archetype"] = "sideTable", "sideContainer"
    if e["archetype"] in ("tableRect", "tableOval", "desk", "deskStanding", "console", "sideboard", "lowboard", "dresser", "bench",
                          "coffeeBlock", "coffeeDuo", "bookcase", "wardrobe", "vitrine", "sofa", "sofaModular", "sofaBed") and e["d"] > e["w"]:
        e["w"], e["d"] = e["d"], e["w"]
    nl = e["name"].lower()
    if re.search(r"schuhschrank|schuhkipper|schuhkommode", nl) and e["archetype"] in ("shelfOpen", "bookcase", "sideboard", "dresser", "cabinet"):
        e["category"], e["archetype"] = "dresser", "dresser"
        e["params"] = {**(e.get("params") or {}), "flaps": max(1, min(4, round(e["h"] / 45)))}
    if "sitzsack" in nl or "beanbag" in nl:
        e["category"], e["archetype"] = "pouf", "pouf"
    if re.search(r"sitzbank|(?<!tv-)\bbank\b", nl) and "tv" not in nl and e["archetype"] in ("dresser", "sideboard", "lowboard"):
        e["category"], e["archetype"] = "bench", "bench"
    if re.search(r"bartisch|stehtisch", nl) and e["archetype"] in ("barStool",):
        e["category"], e["archetype"] = "diningTable", "tableRect"
    if e["archetype"] in ("tableRect", "tableOval") and 85 < e["h"] <= 130 and e["d"] <= 60 and "bar" not in nl:
        e["d"], e["h"] = e["h"], 75.0  # „152/223×95 cm“: 95 = Tiefe, Höhe Standard 75 cm
    if e["archetype"] == "lowboard" and e["h"] > 110:
        # TV-Kombination/Wohnwand: Regalraster mit geschlossener unterer Reihe
        e["archetype"] = "shelfOpen"
        e["params"] = {**(e.get("params") or {}), "style": "grid", "doorsBottom": 1}
    if e["archetype"] == "dresser" and e["h"] > 150:
        e["archetype"] = "wardrobe"
    if e["archetype"] in ("sofa", "sofaModular") and e["d"] >= 140:
        e["archetype"] = "sofaCorner"
    if e["archetype"] == "sofaCorner" and e["d"] < 120:
        e["d"] = 160.0  # Herstellerangabe = Sitztiefe; Récamiere/Ecke ≈ 160 cm
    return e


def finalize(e):
    cat = e["category"]
    d = DEFAULT_DIMS.get(cat, (60, 60, 60))
    for i, k in enumerate(("w", "d", "h")):
        v = e.get(k)
        if v is None or v <= 0 or v > 1200:
            e[k] = d[i]
    # Plausibilität: Tiefe/Höhe vertauscht bei Wandobjekten
    if cat in ("art", "mirror") and e["d"] > 15:
        e["h"], e["d"] = e["d"], 3
    if cat in ("pendant", "ceilingLamp") and e["h"] > 150:
        e["h"] = DEFAULT_DIMS[cat][2]
    e["mount"] = MOUNT.get(cat, "floor")
    if cat in ELEV:
        e["elev"] = ELEV[cat]
    if cat == "pendant":
        e["elev"] = 1.6
    if cat == "ceilingLamp":
        e["elev"] = round(2.56 - e["h"] / 100, 3)
    e["resizable"] = cat in ("rug", "curtain", "wardrobe", "shelf", "wallPanel", "molding") or e.get("resizable", False)
    return fix_geometry(e)


# ------------------------------------------------------------------ Westwing
WW_CAT = {
    "sofas": "sofa", "sessel": "armchair", "couchtische": "coffeeTable", "beistelltische": "sideTable", "esstische": "diningTable",
    "stuehle": "chair", "sideboards": "sideboard", "lowboards": "lowboard", "konsolen": "console", "vitrinen": "cabinet",
    "regale": "shelf", "kommoden": "dresser", "betten": "bed", "nachttische": "nightstand", "schreibtische": "desk",
    "buerostuehle": "officeChair", "hocker-poufs": "pouf", "teppiche": "rug", "stehleuchten": "floorLamp", "pendelleuchten": "pendant",
    "tischleuchten": "tableLamp", "wandleuchten": "wallLamp", "deckenleuchten": "ceilingLamp", "spiegel": "mirror", "bilder": "art",
    "vasen": "decor", "vorhaenge": "curtain", "gartensofas-lounge-sofas": "outdoor", "gartentische": "outdoor", "gartenstuehle": "outdoor",
    "gartensessel-lounge-sessel": "outdoor", "sitzbaenke": "bench", "barhocker": "stool", "kissen": "textile", "plaids-decken": "textile",
}


def westwing():
    f = RES / "westwing_products.json"
    if not f.exists():
        return []
    out = []
    for p in json.loads(f.read_text()):
        if p.get("err") or not p.get("name") or not p.get("price"):
            continue
        cat = WW_CAT.get(p["category"], "decor")
        W, D, H = parse_westwing(p.get("size"), cat)
        if cat == "outdoor" and "sofa" in p["category"]:
            pass
        name = p["name"]
        col = p.get("colorDisplay") or ""
        if re.search(r"firesafety|artwall", col, re.I):
            col = ""
        variants = []
        fb = slots_for(cat, col, p.get("materialText", ""), name)
        main_slots = slots_from(cat, col or (p.get("materialText") or ""), name, fb) or fb
        variants.append({"name": variant_label(col) if col else "Standard", "slots": main_slots})
        for v in (p.get("variants") or [])[:16]:
            vv = v.strip()
            if not vv or vv.lower() == (col or "").lower() or re.search(r"firesafety|artwall", vv, re.I):
                continue
            sl = slots_from(cat, vv, name, None)
            if sl is None:
                continue  # Variante ohne erkennbare Farbe/Material (z. B. Motivname) – nicht darstellbar
            variants.append({"name": variant_label(vv), "slots": sl})
        e = {
            "id": "wes-" + re.sub(r"[^a-z0-9]+", "-", p["url"].split("/")[-1].replace(".html", ""))[:60],
            "vendor": "Westwing", "brand": p.get("brand"), "name": name, "category": cat,
            "w": W, "d": D, "h": H, "price": float(p["price"]), "url": p["url"], "image": p.get("image"),
            "archetype": arch_for(cat, name, W, D, H), "params": {}, "variants": variants,
            "tags": [t for t in (p.get("brand"),) if t], "premium": (p.get("brand") or "").startswith("Westwing") or float(p["price"]) >= 400,
            "description": (p.get("size") or "").replace("\n", " · ")[:240],
        }
        out.append(finalize(e))
    return out


# ------------------------------------------------------------------ IKEA
IKEA_TYPES = [
    (("3er-sofa", "2er-sofa", "4er-sofa", "sofa", "sitzelement", "ecksofa", "récamiere", "recamiere"), "sofa"),
    (("bettsofa", "schlafsofa"), "sofa"),
    (("sessel", "ohrensessel", "relaxsessel"), "armchair"),
    (("hocker", "fußhocker", "pouf"), "pouf"),
    (("bank",), "bench"),
    (("stuhl", "armlehnstuhl"), "chair"),
    (("couchtisch",), "coffeeTable"), (("beistelltisch", "satztisch"), "sideTable"),
    (("tisch", "esstisch", "ausziehtisch"), "diningTable"), (("schreibtisch", "sitz-/stehtisch", "sitz/steh"), "desk"),
    (("konsolentisch", "ablagetisch"), "console"), (("sideboard", "anrichte"), "sideboard"), (("tv-bank", "tv-möbel", "tv-schrank"), "lowboard"),
    (("vitrine", "vitrinenschrank", "schrank mit glastür"), "cabinet"), (("bücherregal", "regal", "wandregal"), "shelf"),
    (("kleiderschrank",), "wardrobe"), (("kommode",), "dresser"), (("nachttisch",), "nightstand"),
    (("bettgestell", "bett", "polsterbett", "tagesbett"), "bed"), (("drehstuhl", "bürostuhl", "gamingstuhl"), "officeChair"),
    (("standleuchte",), "floorLamp"), (("tischleuchte", "arbeitsleuchte"), "tableLamp"), (("hängeleuchte", "pendelleuchte"), "pendant"),
    (("deckenleuchte",), "ceilingLamp"), (("wandleuchte",), "wallLamp"), (("teppich", "läufer"), "rug"),
    (("gardinenschal", "gardinenschals", "vorhang", "gardinen", "store"), "curtain"), (("spiegel",), "mirror"),
    (("bild", "poster"), "art"), (("topfpflanze", "kunstpflanze", "pflanze"), "plant"), (("vase",), "decor"),
    (("kissen", "kissenbezug"), "textile"), (("plaid", "decke"), "textile"), (("schuhschrank", "schuhaufbewahrung"), "cabinet"),
]
IKEA_EXCLUDE = ("bezug", "fuß", "füße", "bein", "schublade", "einsatz", "zubehör", "griff", "knauf", "leuchtmittel", "schiene", "kabel",
                "glühbirne", "halterung", "korb", "unterlage", "türdämpfer", "scharnier", "einlegeboden", "boden", "kleiderstange",
                "auszug", "rahmen", "seitenteil", "rückwand", "front", "tür", "deckplatte", "platte", "abdeckung", "schutz",
                "lampenschirm", "stoffbezug", "matratze", "lattenrost", "kopfteil", "rost", "aufbewahrung mit", "set,", "gestell")


IKEA_FIRST = {
    "sofa": "sofa", "3er-sofa": "sofa", "2er-sofa": "sofa", "4er-sofa": "sofa", "ecksofa": "sofa", "bettsofa": "sofa", "schlafsofa": "sofa",
    "3er-bettsofa": "sofa", "2er-bettsofa": "sofa", "4er-sitzelement": "sofa", "3er-sitzelement": "sofa", "5er-sitzelement": "sofa",
    "sessel": "armchair", "ohrensessel": "armchair", "relaxsessel": "armchair", "schaukelstuhl": "armchair", "drehsessel": "armchair",
    "hocker": "pouf", "fußhocker": "pouf", "pouf": "pouf", "bank": "bench", "sitzbank": "bench", "polsterbank": "bench",
    "stuhl": "chair", "armlehnstuhl": "chair", "barhocker": "stool", "barstuhl": "stool",
    "couchtisch": "coffeeTable", "beistelltisch": "sideTable", "satztische": "sideTable", "satztisch": "sideTable",
    "tisch": "diningTable", "esstisch": "diningTable", "ausziehtisch": "diningTable", "bartisch": "diningTable",
    "schreibtisch": "desk", "sitz-/stehschreibtisch": "desk", "sitz/steh-schreibtisch": "desk", "konsolentisch": "console", "ablagetisch": "console",
    "sideboard": "sideboard", "anrichte": "sideboard", "tv-bank": "lowboard", "tv-möbel": "lowboard", "tv-möbel,": "lowboard",
    "vitrine": "cabinet", "vitrinenschrank": "cabinet", "schrank": "cabinet", "schuhschrank": "cabinet", "highboard": "cabinet",
    "bücherregal": "shelf", "regal": "shelf", "regalelement": "shelf", "wandregal": "shelf", "aufbewahrungskombination": "shelf",
    "kleiderschrank": "wardrobe", "kleiderschrankkombination": "wardrobe", "kommode": "dresser", "nachttisch": "nightstand",
    "bettgestell": "bed", "polsterbettgestell": "bed", "bett": "bed", "tagesbett": "bed", "bettgestell,": "bed",
    "drehstuhl": "officeChair", "bürostuhl": "officeChair", "standleuchte": "floorLamp", "bogenleuchte": "floorLamp",
    "tischleuchte": "tableLamp", "arbeitsleuchte": "tableLamp", "hängeleuchte": "pendant", "pendelleuchte": "pendant",
    "deckenleuchte": "ceilingLamp", "wandleuchte": "wallLamp", "wand-/deckenleuchte": "wallLamp", "teppich": "rug", "läufer": "rug",
    "gardinenschals": "curtain", "gardinenschal": "curtain", "gardinen": "curtain", "store": "curtain", "verdunkelungsgardinen": "curtain",
    "spiegel": "mirror", "bild": "art", "poster": "art", "kunstpflanze": "plant", "topfpflanze": "plant", "pflanze": "plant",
    "vase": "decor", "kissen": "textile", "kissenbezug": "textile", "plaid": "textile", "decke": "textile",
    "gartentisch": "outdoor", "tisch,": "diningTable", "liege": "outdoor", "armlehnstuhl/außen": "outdoor", "stuhl/außen": "outdoor",
    "2er-sofa/außen": "outdoor", "3er-sofa/außen": "outdoor", "tisch/außen": "outdoor", "sessel/außen": "outdoor", "hocker/außen": "outdoor",
}


def ikea_cat(typ):
    t = (typ or "").lower().strip()
    if not t:
        return None
    first = t.split()[0].rstrip(",")
    if "außen" in t and first not in IKEA_FIRST:
        first = first + "/außen"
    cat = IKEA_FIRST.get(first)
    if cat is None:
        return None
    if any(x in t for x in ("bezug", "zubehör", "für ", "einsatz", "kinder", "baby", "leuchtmittel", "abdeckung", "schutz")):
        return None
    if "außen" in t:
        return "outdoor"
    return cat


def ikea_page_dims(m):
    """Maße von der IKEA-Produktseite (Bezeichnungen wie "Breite", "Tiefe", "Höhe", "Durchmesser")."""
    def v(*names):
        for n in names:
            for k, val in m.items():
                if k.lower() == n.lower():
                    x = nums(val)
                    if x:
                        return x[0]
        return None
    W = v("Breite")
    D = v("Tiefe", "Länge")
    H = v("Höhe", "Höhe inkl. Rückenkissen", "Max. Höhe")
    dia = v("Durchmesser", "Schirmdurchmesser")
    if dia and not W:
        W = D = dia
    return W, D, H


def ikea_design(alt):
    """„NAME Typ, Ausführung, 90x50 cm“ → „Ausführung“."""
    m = re.match(r"^[^,]+,\s*(.*)$", alt or "")
    if not m:
        return ""
    return re.sub(r",\s*(?:[\dØ][\d.,x×\s/-]*\s*(?:cm|mm)\b.*|\d+\s*St\..*)$", "", m.group(1)).strip()


IKEA_CONFIG = re.compile(r"\b(mit|ohne|und|\+)\s+(r[ée]camieren?|abschluss|offene[sn]? ende|armlehnen?|breiten armlehnen|nackenkissen|"
                         r"kopfteil|bettkasten|schubladen?|t[üu]ren|aufbewahrung|sitzelement|hocker)\b|\b(offenes ende|links|rechts|draußen|drinnen)\b", re.I)
IKEA_FABRICS = ("gunnared", "kelinge", "tibbleby", "vissle", "remmarn", "tonerud", "djuparp", "kilanda", "johanneshov", "hakebo",
                "hallarp", "lofallet", "tallmyra", "viarp", "knisa", "lejde", "vibberbo", "knäbäck", "gransel", "grann", "bomstad",
                "fridtuna", "kimstad", "glose", "hillared", "sundhamn", "alhamn", "lappviken", "stubbarp", "smeviken", "luröy")


def ikea_label(design):
    """Nur die farb-/materialtragenden Teile der Ausführung (ohne Konfiguration wie „mit Récamiere“)."""
    from finish import parse_finish
    design = IKEA_CONFIG.sub(" ", design).replace("recamiere", "").strip(" ,/+")
    design = re.sub(r"\s{2,}", " ", design)
    for f in IKEA_FABRICS:
        design = re.sub(r"\b" + f + r"\b", f.capitalize(), design, flags=re.I)
    parts = [s.strip() for s in re.split(r"\s*/\s*", design) if s.strip()]
    keep = [s for s in parts if parse_finish(s)]
    return variant_label(" / ".join(keep or parts))


def ikea():
    f = RES / "ikea_products.json"
    if not f.exists():
        return []
    pd = {}
    if (RES / "ikea_dims.json").exists():
        pd = json.loads((RES / "ikea_dims.json").read_text())
    raw = json.loads(f.read_text())
    # Ausführung je Artikelnummer aus den Varianten-Alttexten aller Produkte
    design = {}
    for p in raw:
        for v in p.get("variants") or []:
            d = ikea_design(v.get("alt"))
            if d:
                design.setdefault(v["itemNo"], d)
        for a in p.get("alts") or []:
            if a.startswith(f"{p['name']} {p.get('type') or ''},"):
                design.setdefault(p["itemNo"], ikea_design(a))
    groups, seen_item = {}, {}
    for p in raw:
        cat = ikea_cat(p.get("type"))
        if not cat or not p.get("price"):
            continue
        if p["type"] and "kinder" in p["type"].lower():
            continue
        if p["itemNo"] in seen_item:
            continue  # bereits als Variante eines anderen Produkts erfasst
        W, D, H = parse_ikea(p.get("measure"), p.get("type"))
        m = pd.get(p["itemNo"]) or {}
        if m and "err" not in m:
            W2, D2, H2 = ikea_page_dims(m)
            W, D, H = W2 or W, D2 or D, H2 or H
        if cat in ("shelf", "cabinet", "wardrobe", "mirror", "sideboard", "dresser") and W and D and not H and D > 60:
            H, D = D, None
        if cat == "rug" and W and D:
            H = 1.2
        if cat in ("curtain",) and W and D:
            W, H, D = W, D, 8
        key = (p["name"], p["type"], p.get("measure"))
        if key in groups:
            continue
        full = f"{p['name']} {p['type']}"
        members = [{"itemNo": p["itemNo"], "url": p["url"], "image": p.get("image"), "price": p["price"], "measure": p.get("measure"),
                    "slug": p["url"]}] + [v for v in (p.get("variants") or []) if v.get("price")
                                          and (not v.get("type") or v.get("type") == p.get("type"))
                                          and (not p.get("measure") or not v.get("measure") or v.get("measure") == p.get("measure"))]
        variants, names = [], set()
        for v in members:
            if v["itemNo"] in seen_item:
                continue
            d = design.get(v["itemNo"])
            if not d:  # Rückfall: Ausführung aus dem URL-Slug (ohne Serien- und Typwörter)
                slug = (v.get("url") or "").split("/p/")[-1].rsplit("-", 1)[0]
                tr = str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "å": "a", "é": "e"})
                drop = set(re.findall(r"[a-z0-9]+", f"{p['name']} {p.get('type') or ''}".lower().translate(tr)))
                d = " ".join(t for t in slug.split("-") if t not in drop)
                d = d.replace("weiss", "weiß").replace("gruen", "grün").replace("aussen", "außen")
            label = ikea_label(d) if d else "Standard"
            if label.lower() in names:
                continue
            fb = slots_for(cat, d, d, full)
            sl = slots_from(cat, d, full, fb) or fb
            names.add(label.lower())
            seen_item[v["itemNo"]] = True
            variants.append({"name": label[:60], "slots": sl, "price": float(v["price"]), "url": v["url"], "image": v.get("image")})
            if len(variants) >= 16:
                break
        if not variants:
            continue
        groups[key] = {
            "id": f"ike-{p['itemNo']}", "vendor": "IKEA", "name": full, "series": p["name"], "category": cat,
            "w": W, "d": D, "h": H, "price": min(v["price"] for v in variants), "url": p["url"], "image": p.get("image"),
            "archetype": arch_for(cat, full, W, D, H), "params": {}, "variants": variants,
            "tags": [p["name"]], "premium": p["name"] in PREMIUM_IKEA, "description": f"{p['type']}, {p.get('measure') or ''}".strip(", "),
        }
    return [finalize(e) for e in groups.values()]


PREMIUM_IKEA = {"STOCKHOLM 2025", "STOCKHOLM", "SÖDERHAMN", "VALNÄS", "LILLESÄTER", "JÄTTEBO", "LANDSKRONA", "VIMLE", "EKERÖ", "STRANDMON",
                "KOARP", "ESSEBODA", "LISABO", "EKEDALEN", "MÖCKELBY", "SKOGSTA", "INGATORP", "DOCKSTA", "STRANDTORP", "BERGMUND", "KRYLBO",
                "LISTERBY", "ARKELSTORP", "TONSTAD", "IDANÄS", "HAUGA", "HEMNES", "HAVSTA", "FABRIKÖR", "MALSJÖ", "BESTÅ", "SLATTUM", "TUFJORD",
                "GLADSTAD", "VADHEIM", "DUNVIK", "MITTZON", "IDÅSEN", "PS 2014", "VINDKAST", "SOLKLINT", "BLÅSVERK", "PILBLAD", "SIMRISHAMN",
                "VARMBLIXT", "VINDUM", "LOHALS", "ÅDUM", "LINDBYN", "SEGERÖN", "ÄPPLARÖ", "NÄMMARÖ", "KIVIK", "GULLVALLA", "PERSBOL",
                "SKOGSKORN", "TOLKNING", "SKANSNÄS", "VEDBO", "ODGER", "KARLPETTER", "PINNTORP", "BJÖRKSNÄS", "BAGGEBO", "PAX", "BILLY"}


# ------------------------------------------------------------------ JYSK
JYSK_CAT = {
    "sofas": "sofa", "modulare-sofas": "sofa", "schlafsofas": "sofa", "sessel": "armchair", "couchtische-beistelltische": None,
    "tv-mobel": "lowboard", "poufs": "pouf", "esstische": "diningTable", "esszimmerstuhle": "chair", "sideboards": "sideboard",
    "vitrinen": "cabinet", "konsolentische": "console", "barstuhle-und-bartische": "stool", "nachttische": "nightstand", "betten": "bed",
    "burostuhle": "officeChair", "beleuchtung": None, "gartenmobel": "outdoor", "flurmobel": "cabinet", "deko": None,
    "kommoden": "dresser", "schreibtische": "desk", "regale": "shelf", "spiegel": "mirror", "teppiche": "rug", "gardinen": "curtain",
}
JYSK_PREMIUM_WORDS = ("massiv", "eiche", "walnuss", "marmor", "travertin", "samt", "bouclé", "boucle", "leder", "messing", "rattan",
                      "keramik", "glas", "wolle", "leinen", "teak", "akazie", "mango", "cord")


def jysk():
    f = RES / "jysk_products.json"
    if not f.exists():
        return []
    rows = []
    for p in json.loads(f.read_text()):
        if p.get("err") or not p.get("name") or not p.get("price"):
            continue
        parts = p["url"].split("/")
        sub = parts[4] if len(parts) > 4 else ""
        cat = JYSK_CAT.get(sub)
        n = p["name"]; nl = n.lower()
        sp = p.get("specs") or {}
        art = (sp.get("Art") or "").lower()
        if sub == "couchtische-beistelltische":
            cat = "sideTable" if "beistell" in nl or "beistell" in art else "coffeeTable"
        if sub == "beleuchtung":
            cat = "floorLamp" if ("steh" in nl or "steh" in art) else ("pendant" if ("pendel" in nl or "hänge" in art or "pendel" in art) else ("tableLamp" if "tisch" in nl or "tisch" in art else ("wallLamp" if "wand" in nl else ("ceilingLamp" if "decke" in nl else None))))
        if sub == "deko":
            cat = "decor" if any(k in nl for k in ("vase", "schale", "kerzen", "laterne")) else ("plant" if any(k in nl for k in ("pflanze", "kunstpflanze", "baum")) else ("art" if any(k in nl for k in ("bild", "rahmen", "poster")) else None))
        if sub == "betten" and not any(k in nl for k in ("bett ", "bett-", "bettgestell", "polsterbett", "boxspring", "holzbett", "bett", "kopfteil")):
            cat = None
        if sub == "betten" and any(k in nl for k in ("lattenrost", "matratze", "topper", "kopfteil", "füße", "fuß", "bettkasten")):
            cat = None
        if sub == "gartenmobel" and not any(k in nl for k in ("tisch", "stuhl", "sessel", "sofa", "lounge", "bank", "liege")):
            cat = None
        if cat is None:
            continue
        W, D, H = parse_jysk(sp)
        try:
            price = float(p["price"])
        except (TypeError, ValueError):
            continue
        rows.append((cat, price, p, W, D, H, sp))
    # Premium-Filter: obere Preishälfte je Kategorie oder hochwertige Materialien
    med = {}
    for cat in {r[0] for r in rows}:
        prices = [r[1] for r in rows if r[0] == cat]
        med[cat] = statistics.median(prices) if prices else 0
    out = {}
    for cat, price, p, W, D, H, sp in rows:
        mat = f"{sp.get('Material', '')} {sp.get('Oberstoff', '')} {p['name']}".lower()
        prem = any(w in mat for w in JYSK_PREMIUM_WORDS)
        if price < med[cat] and not prem:
            continue
        series = re.findall(r"\b([A-ZÆØÅÄÖÜ]{3,}(?:\s[A-ZÆØÅÄÖÜ]{3,})?)\b", p["name"])
        series = series[0] if series else p["name"]
        col = sp.get("Farbe") or p["name"]
        key = (series, cat, W, D, H)
        fb = slots_for(cat, col, mat, p["name"])
        sl = slots_from(cat, sp.get("Farbe") or "", p["name"] + " " + (sp.get("Material") or ""), fb) or fb
        v = {"name": variant_label(sp.get("Farbe") or "Standard")[:40], "slots": sl, "price": price, "url": p["url"]}
        if key in out:
            if len(out[key]["variants"]) < 10 and not any(x["name"] == v["name"] for x in out[key]["variants"]):
                out[key]["variants"].append(v)
            continue
        e = {
            "id": "jys-" + re.sub(r"[^a-z0-9]+", "-", p["url"].split("/")[-1])[:60], "vendor": "JYSK", "name": p["name"], "series": series,
            "category": cat, "w": W, "d": D, "h": H, "price": price, "url": p["url"],
            "archetype": arch_for(cat, p["name"], W, D, H), "params": {}, "variants": [v], "tags": [series] + (["Premium-Material"] if prem else []),
            "premium": prem, "description": "; ".join(f"{k}: {sp[k]}" for k in ("Material", "Farbe") if k in sp)[:240],
        }
        out[key] = finalize(e)
    return list(out.values())


def concept_items():
    f = DATA / "conceptCatalog.json"
    items = json.loads(f.read_text()) if f.exists() else []
    for e in items:
        e.setdefault("premium", True)
    return items


def generic_items():
    """Ergänzende Ausbau-/Dekoelemente (Wandpaneele, Profilleisten, TV, Pflanzen-Modelle)."""
    G = []
    def add(id, vendor, name, cat, arch, w, d, h, price, mount="floor", slots=None, params=None, elev=None, resizable=False, model=None, url=None, tags=()):
        e = {"id": id, "vendor": vendor, "name": name, "category": cat, "archetype": arch, "w": w, "d": d, "h": h, "price": price,
             "mount": mount, "params": params or {}, "variants": [{"name": "Standard", "slots": slots or {}}], "tags": list(tags),
             "premium": True, "resizable": resizable}
        if elev is not None: e["elev"] = elev
        if model: e["model"] = model
        if url: e["url"] = url
        G.append(e)
    add("obi-lamella-oak", "OBI", "Akustikpaneel Eiche geölt (Lamellen, Filz schwarz)", "wallPanel", "lamella", 60, 2.1, 256, 109.99, "wall",
        {"main": {"color": "#c9a273", "material": "oak"}, "secondary": {"color": "#141414", "material": "fabric"}}, {"slat": 0.027, "gap": 0.0135}, 0, True, tags=("Wand",))
    add("obi-lamella-walnut", "OBI", "Akustikpaneel Walnuss geölt (Lamellen, Filz schwarz)", "wallPanel", "lamella", 60, 2.1, 256, 109.99, "wall",
        {"main": {"color": "#6b4a33", "material": "walnut"}, "secondary": {"color": "#141414", "material": "fabric"}}, {"slat": 0.027, "gap": 0.0135}, 0, True, tags=("Wand",))
    add("obi-lamella-black", "OBI", "Akustikpaneel Eiche schwarz (Lamellen)", "wallPanel", "lamella", 60, 2.1, 256, 119.99, "wall",
        {"main": {"color": "#2a2522", "material": "oakDark"}, "secondary": {"color": "#141414", "material": "fabric"}}, {"slat": 0.027, "gap": 0.0135}, 0, True, tags=("Wand",))
    add("obi-wainscot", "OBI", "Wandvertäfelung Kassette (MDF, streichbar)", "wallPanel", "panelWall", 120, 1.8, 110, 89.0, "wall",
        {"main": {"color": "#f3f0e8", "material": "matte"}}, {"style": "shaker", "rail": True}, 0, True, tags=("Wand",))
    add("obi-orac-frame", "OBI", "Profilrahmen Orac Decor PX120 (je Rahmen)", "molding", "molding", 130, 1.9, 100, 46.53, "wall",
        {"main": {"color": "#f3f0e8", "material": "matte"}}, {"profile": 0.04}, 0.9, True, tags=("Wand", "Stuck"))
    add("obi-orac-arch", "OBI", "Profilbogen Orac Decor (Bogenrahmen)", "molding", "molding", 90, 1.9, 180, 79.0, "wall",
        {"main": {"color": "#f3f0e8", "material": "matte"}}, {"profile": 0.05, "arch": True}, 0.3, True, tags=("Wand", "Stuck"))
    add("tv-65", "Fachhandel", "Fernseher 65″ (Wandmontage)", "media", "tv", 145, 3, 83, 0, "wall", {"main": {"color": "#111111", "material": "gloss"}}, {}, 1.0)
    add("tv-55", "Fachhandel", "Fernseher 55″ (Wandmontage)", "media", "tv", 123, 3, 71, 0, "wall", {"main": {"color": "#111111", "material": "gloss"}}, {}, 1.05)
    # Samsung The Frame (Art-Mode-TV): Wandmontage (Slim-Fit) oder auf Standfüßen, magnetische Wechselrahmen.
    # Maße lt. Samsung-Datenblatt (ohne Fuß B×H×T, Fuß B×T, Höhe mit Fuß); Preise: Preisvergleich Okt. 2026.
    FRAMES = [  # Zoll, Modell, B, H, T (cm), Höhe mit Fuß, Fußtiefe, Fußbreite, Preis, Rahmenpreis
        (43, "LS03F", 96.95, 55.78, 2.49, 59.19, 19.68, 67.80, 529.0, 99.0),
        (50, "LS03F", 112.41, 64.49, 2.49, 67.92, 22.78, 75.74, 699.0, 119.0),
        (55, "LS03F", 123.79, 70.88, 2.49, 74.34, 22.78, 89.72, 749.0, 129.0),
        (65, "LS03F", 145.68, 83.19, 2.49, 86.89, 26.09, 107.68, 829.0, 159.0),
        (75, "LS03FW Pro", 168.23, 96.54, 2.69, 99.53, 31.98, 120.0, 1599.0, 189.0),
        (85, "LS03FW Pro", 190.43, 109.09, 2.69, 113.4, 33.8, 136.0, 2799.0, 219.0),
    ]
    BEZELS = [("Rahmen Schwarz (Standard)", "#1b1b1b", "blackMetal", 0), ("Modern-Rahmen Teak", "#a87a50", "oak", 1),
              ("Modern-Rahmen Weiß", "#efede8", "matte", 1), ("Modern-Rahmen Beige", "#d9ccb6", "matte", 1),
              ("Modern-Rahmen Braun", "#5d4130", "walnut", 1)]
    for inch, model, fw_, fh, fd, fh_stand, sd, sw, pr, bez in FRAMES:
        cid = f"samsung-the-frame-{inch}"
        url = f"https://www.samsung.com/de/lifestyle-tvs/the-frame/{model.split()[0].lower()}-{inch}-inch-black/"
        G.append({
            "id": cid, "vendor": "Samsung", "brand": "Samsung", "name": f"The Frame {inch}″ {model} (2025)", "series": "The Frame",
            "category": "media", "archetype": "tvFrame", "w": fw_, "d": 3.0, "h": fh, "price": pr, "mount": "wall",
            "elev": round(1.05 - fh / 200, 2), "url": url, "premium": True, "resizable": False,
            "params": {"stand": False, "screen": "art", "panelD": round(fd / 100, 4), "panelH": round(fh / 100, 4),
                       "feetH": round((fh_stand - fh) / 100, 4), "standD": round(sd / 100, 4), "standW": round(sw / 100, 4)},
            "variants": [{"name": n, "price": round(pr + bez * k, 2), "slots": {"frame": {"color": col, "material": mat}}} for n, col, mat, k in BEZELS],
            "tags": ["TV", "Fernseher", "Art Mode", "Samsung", "Lifestyle-TV"],
            "description": f"4K-QLED-Lifestyle-TV mit Art Mode und mattem Display; {fw_:.1f} × {fh:.1f} × {fd:.1f} cm ohne Fuß, "
                           f"mit Standfüßen {fh_stand:.1f} cm hoch / {sd:.1f} cm tief. Im Inspektor zwischen Wandmontage und Standfuß "
                           "(z. B. auf Sideboard/Lowboard) umschaltbar. Wechselrahmen als Zubehör.",
        })
    for mid, nm, h, pr in (("potted_plant_04", "Großpflanze im Topf (Strelitzie)", 160, 189), ("potted_plant_02", "Zimmerpflanze im Keramiktopf", 70, 59),
                           ("potted_plant_01", "Monstera im Pflanzkübel", 110, 129)):
        add(f"ph-{mid}", "Fachhandel", nm, "plant", "glb", 60 if h > 100 else 40, 60 if h > 100 else 40, h, pr, model=f"assets/models/{mid}.glb", tags=("Pflanze",))
    for mid, nm, h in (("ceramic_vase_01", "Keramikvase bauchig", 30), ("ceramic_vase_02", "Keramikvase hoch", 40), ("ceramic_vase_03", "Keramikvase Amphore", 35),
                       ("ceramic_vase_04", "Keramikvase klein", 22), ("brass_vase_01", "Messingvase", 28), ("wooden_bowl_01", "Holzschale", 10)):
        add(f"ph-{mid}", "Fachhandel", nm, "decor", "glb", 22, 22, h, 39, model=f"assets/models/{mid}.glb", tags=("Deko",))
    return G


# ------------------------------------------------------------------ Tylko (Feed über ladendirekt)
TYLKO_COLORS = [  # Tylko-Farbnamen (DE) → Farbton/Material; längste zuerst prüfen
    ("helles holzimitat", "#c8a57a", "oak"), ("dunkles holzimitat", "#5e4130", "walnut"), ("holzimitat", "#b8915f", "oak"),
    ("weiße multiplex", "#f1efe9", "lacquer"), ("multiplex", "#e0c9a3", "oak"),
    ("kaschmirbeige", "#d9c9b1", "lacquer"), ("kaschmir", "#d9c9b1", "lacquer"), ("cremeweiß", "#ede8dc", "lacquer"),
    ("mitternachtsblau", "#28354d", "lacquer"), ("lilablau", "#8e98c4", "lacquer"), ("himmelblau", "#a9c1d6", "lacquer"),
    ("blassrosa", "#e6c4bd", "lacquer"), ("puderrosa", "#e2bcb7", "lacquer"), ("reisinger pink", "#d98fa1", "lacquer"),
    ("weinrot", "#6b2430", "lacquer"), ("burgund", "#6b2430", "lacquer"), ("terrakotta", "#b5603f", "lacquer"),
    ("buttergelb", "#e8cf7d", "lacquer"), ("senfgelb", "#c99a2e", "lacquer"), ("salbeigrün", "#a5b39b", "lacquer"),
    ("olivgrün", "#6c7350", "lacquer"), ("waldgrün", "#34493b", "lacquer"), ("flieder", "#b9a7c4", "lacquer"),
    ("graphit", "#3c3e41", "lacquer"), ("dunkelgrau", "#4a4a48", "lacquer"), ("hellgrau", "#c4c3bf", "lacquer"),
    ("cognac", "#9a5b34", "leather"), ("khaki", "#8a8457", "lacquer"), ("anthrazit", "#3a3b3c", "lacquer"), ("multicolor", "#b9a58c", "lacquer"), ("sand", "#cfb895", "lacquer"), ("beige", "#d9c9b1", "lacquer"), ("weiß", "#f1efe9", "lacquer"),
    ("schwarz", "#1f1f1f", "lacquer"), ("grau", "#9b9a96", "lacquer"), ("grün", "#6c7350", "lacquer"), ("blau", "#3f5675", "lacquer"),
    ("rosa", "#e2bcb7", "lacquer"), ("gelb", "#e2c45a", "lacquer"), ("rot", "#9b2f2f", "lacquer"), ("braun", "#6f4d36", "lacquer"),
]
TYLKO_LABEL = {"helles holzimitat": "Holzdekor hell", "dunkles holzimitat": "Holzdekor dunkel", "holzimitat": "Holzdekor",
               "weiße multiplex": "Weiß (Multiplex)", "multiplex": "Multiplex natur"}
TYLKO_CAT = {
    "regale": ("shelf", "tylkoStorage"), "regalsysteme": ("shelf", "tylkoStorage"), "standregale": ("shelf", "tylkoStorage"),
    "raumteiler": ("shelf", "tylkoStorage"), "regalwuerfel": ("shelf", "tylkoStorage"), "cd-dvd-regale": ("shelf", "tylkoStorage"),
    "buecherregale": ("shelf", "tylkoStorage"), "einzelregale": ("shelf", "tylkoStorage"), "haengeregale": ("shelf", "tylkoStorage"),
    "sideboards": ("sideboard", "tylkoStorage"), "highboards": ("sideboard", "tylkoStorage"), "kommoden": ("dresser", "tylkoStorage"),
    "waeschekommode": ("dresser", "tylkoStorage"), "weitere-schraenke": ("cabinet", "tylkoStorage"), "wohnwaende": ("shelf", "tylkoStorage"),
    "aktenschraenke": ("cabinet", "tylkoStorage"), "container": ("cabinet", "tylkoStorage"), "lowboards": ("lowboard", "tylkoStorage"),
    "tv-lowboards": ("lowboard", "tylkoStorage"), "tv-schraenke": ("lowboard", "tylkoStorage"), "tv-racks": ("lowboard", "tylkoStorage"),
    "hifi-racks": ("lowboard", "tylkoStorage"), "standvitrinen": ("cabinet", "tylkoStorage"), "nachttischkommoden": ("nightstand", "tylkoStorage"),
    "schreibtische": ("desk", "tylkoStorage"), "konsolentische": ("console", "tylkoStorage"), "couchtische": ("coffeeTable", "tylkoStorage"),
    "drehtuerenschraenke": ("wardrobe", "wardrobe"), "schwebetuerenschraenke": ("wardrobe", "wardrobe"), "ordnungssysteme": ("wardrobe", "wardrobe"),
    "schraenke": ("wardrobe", "wardrobe"),
}
TYLKO_SOFA = {  # Feed-Schlüsselwort → (Kategorie, Archetyp, Bezeichnung)
    "two_seater": ("sofa", "sofaModular", "2-Sitzer"), "three_seater": ("sofa", "sofaModular", "3-Sitzer"),
    "four_plus_seater": ("sofa", "sofaModular", "4-Sitzer"), "corner": ("sofa", "sofaCorner", "Ecksofa"),
    "chaise_longue": ("sofa", "sofaModular", "Sofa mit Longchair"), "armchair": ("armchair", "armchairLounge", "Sessel"),
    "footrest": ("pouf", "pouf", "Hocker"), "wohnlandschaft": ("sofa", "sofaCorner", "Wohnlandschaft"),
}


def tylko_color(text):
    t = (text or "").lower()
    found = []
    for k, col, mat in TYLKO_COLORS:
        i = t.find(k)
        if i >= 0 and not any(i >= a and i < b for a, b, *_ in found):
            found.append((i, i + len(k), col, mat, k))
    found.sort()
    return found


def tylko():
    f = RES / "tylko_products.json"
    if not f.exists():
        return []
    groups = {}
    for p in json.loads(f.read_text()):
        name = (p.get("name") or "").strip()
        desc = (p.get("description") or "").strip()
        nl = (name + " " + desc).lower()
        kw = (p.get("keywords") or "").lower()
        if "überzug" in nl or "cover" in kw.split(", ")[:1]:
            continue
        m = re.search(r"(\d+)x(\d+)x(\d+)cm", desc)
        if not m:
            continue
        W, H, D = (float(x) for x in m.groups())
        try:
            price = float(p["offers"]["price"])
        except Exception:
            continue
        sku = p.get("sku") or ""
        sub = p["_cat"].split("/")[-1]
        line = "Sofa" if sku.startswith("s") else ("Tone" if sku.startswith("w") else ("Original Classic" if "multiplex" in nl else "Original Modern"))
        params = {}
        if sku.startswith("s"):
            key = next((k for k in TYLKO_SOFA if k in kw), None)
            if not key:
                continue
            cat, arch, typ = TYLKO_SOFA[key]
            fabric = "cord" if "corduroy" in kw or "cord" in nl else ("leather" if "leather" in kw or "leder" in nl else "wool")
            cols = tylko_color(desc.split(" - ")[0])
            col = cols[0][2] if cols else "#cfc6b8"
            slots = {"main": {"color": col, "material": fabric}, "legs": {"color": "#1d1d1d", "material": "blackMetal"}}
            if arch == "sofaModular":
                params = {"modules": max(1, round(W / 90)), "seatHeight": 0.43}
            series = "Smooth"
        else:
            cat, arch = TYLKO_CAT.get(sub, ("shelf", "tylkoStorage"))
            if "kleiderschrank" in nl:
                cat, arch = "wardrobe", "wardrobe"
            elif "schreibtisch" in nl:
                cat, arch = "desk", "tylkoStorage"
            elif "fernsehtisch" in nl or "tv-" in nl:
                cat = "lowboard"
            elif "nachttisch" in nl:
                cat = "nightstand"
            cols = tylko_color(desc.split(" - ")[0])
            # „Multiplex“ beschreibt bei Original Classic das Material (sichtbare Kanten), keine Frontfarbe
            cols = [c for i, c in enumerate(cols) if i == 0 or "multiplex" not in c[4]]
            main = cols[0] if cols else (0, 0, "#f1efe9", "lacquer", "weiß")
            slots = {"main": {"color": main[2], "material": main[3]}, "legs": {"color": "#1f1f1f", "material": "blackMetal"},
                     "detail": {"color": "#2a2724", "material": "matte"}}
            if len(cols) > 1:
                slots["secondary"] = {"color": cols[1][2], "material": cols[1][3]}
            if arch == "wardrobe":
                doors = re.search(r"(\d+) tür", nl)
                params = {"doors": int(doors.group(1)) if doors else max(1, round(W / 55)), "handle": "edge"}
            else:
                params = {
                    "doorShare": 0.45 if "tür" in nl else 0.0,
                    "drawerShare": 0.35 if "schublade" in nl else 0.0,
                    "backs": "rückwand" in nl or "ruckwand" in nl or line == "Tone",
                    "legH": 0.1 if "beine" in nl else 0.0,
                    "plywood": line == "Original Classic",
                    "pattern": "grid" if line == "Tone" else "slant",
                }
                if cat == "desk":
                    params["desk"] = True
                if line == "Tone" and not ("tür" in nl or "schublade" in nl):
                    params["doorShare"] = 0.7
            series = line
        typ_name = re.sub(r"\s+mit .*$", "", name).strip()
        lab = lambda k: TYLKO_LABEL.get(k, k[:1].upper() + k[1:])
        color_name = (lab(cols[0][4]) if cols else "Weiß") + (" + " + lab(cols[1][4]) if len(cols) > 1 else "")
        variant = {"name": color_name, "slots": slots, "price": price, "url": p.get("url")}
        # Gruppierung: Typ + Linie + Maßklasse (10 cm) → Farben als Varianten
        gk = (series, cat, arch, re.sub(r" in .*$", "", typ_name), round(W / 10), round(H / 10), round(D / 5))
        g = groups.get(gk)
        feats = [x for x in ("Türen" if "tür" in nl else "", "Schubladen" if "schublade" in nl else "", "Rückwände" if ("rückwand" in nl or "ruckwand" in nl) else "",
                             "Beine" if "beine" in nl else "", "Kleiderstange" if "kleiderstange" in nl else "") if x]
        if g:
            if not any(v["name"] == variant["name"] for v in g["variants"]) and len(g["variants"]) < 16:
                g["variants"].append(variant)
            g["price"] = min(g["price"], price)
            continue
        base = re.sub(r" in .*$", "", typ_name)
        groups[gk] = {
            "id": "tyl-" + re.sub(r"[^a-z0-9]+", "-", f"{series}-{base}-{int(W)}x{int(H)}x{int(D)}".lower().translate(str.maketrans({"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss"})))[:70],
            "vendor": "Tylko", "brand": "Tylko", "series": series,
            "name": f"Tylko {series} {base} {int(W)} × {int(H)} cm" + (f" ({', '.join(feats)})" if feats else ""),
            "category": cat, "archetype": arch, "w": W, "d": D, "h": H, "price": price, "url": p.get("url"), "image": p.get("image"),
            "params": params, "mount": "floor", "variants": [variant], "premium": True, "resizable": arch != "sofaModular",
            "tags": ["Tylko", series, "maßgefertigt"] + feats,
            "description": f"{desc[:200]}. Maßgefertigt (Breite/Höhe/Tiefe konfigurierbar), Lieferung inkl. Montageanleitung.",
        }
    items = list(groups.values())
    # Ausdünnen: je (Linie, Kategorie) höchstens 60 Größen, nach Häufigkeit der Farben (beliebte Konfigurationen)
    out, per = [], {}
    for e in sorted(items, key=lambda e: -len(e["variants"])):
        fix_geometry(e)
        k = (e["series"], e["category"])
        if per.get(k, 0) >= 140:
            continue
        per[k] = per.get(k, 0) + 1
        out.append(e)
    return out


# ------------------------------------------------------------------ Leuchten (lampe.de)
LAMP_TYPE = {  # Produktart → (Kategorie, Montage)
    "Tischleuchte": ("tableLamp", "floor"), "Leseleuchte": ("tableLamp", "floor"), "Schreibtischleuchte": ("tableLamp", "floor"),
    "Stehlampe": ("floorLamp", "floor"), "Bodenleuchte": ("floorLamp", "floor"),
    "Pendelleuchte": ("pendant", "ceiling"), "Hängeleuchte": ("pendant", "ceiling"), "Kronleuchter": ("pendant", "ceiling"),
    "Deckenleuchte": ("ceilingLamp", "ceiling"), "Wand- und Deckenleuchte": ("ceilingLamp", "ceiling"),
    "Wandleuchte": ("wallLamp", "wall"),
}
METAL_COLORS = {"messing": ("#c9a55c", "brass"), "gold": ("#c9a55c", "brass"), "champagner": ("#cdb88f", "brass"),
                "kupfer": ("#b8703e", "copper"), "chrom": ("#c6cbd0", "chrome"), "silber": ("#c6cbd0", "chrome"), "nickel": ("#b9b7b0", "steel"),
                "edelstahl": ("#b9bcbf", "steel"), "aluminium": ("#c4c6c8", "steel"), "titan": ("#8d8f91", "steel"),
                "schwarz": ("#1d1d1d", "blackMetal"), "anthrazit": ("#3a3b3c", "blackMetal"), "grau": ("#8d8d8a", "matte"),
                "weiß": ("#f2f1ed", "matte"), "beige": ("#d9cbb4", "matte"), "sand": ("#d8c7a8", "matte"), "braun": ("#6f4d36", "matte")}


LAMP_MID_BRANDS = {"Albert Leuchten", "Nordlux", "Paul Neuhaus Leuchten", "SCHÖNER WOHNEN-Kollektion", "Ideallux", "Fabas Luce", "Design For The People by Nordlux", "By Rydens"}


def cm(v):
    m = re.match(r"([\d.,]+)\s*(mm|cm|m)?", v or "")
    if not m:
        return None
    x = float(m.group(1).replace(",", "."))
    return x / 10 if m.group(2) == "mm" else (x * 100 if m.group(2) == "m" else x)


def lamp_slots(a, name):
    lc = (a.get("Farbe der Leuchte") or name).lower()
    col, mat = next((v for k, v in METAL_COLORS.items() if k in lc), (color_of(lc, "#1d1d1d"), "matte"))
    if (a.get("Material der Leuchte") or "").lower() in ("kunststoff", "polycarbonat") and mat not in ("brass", "chrome"):
        mat = "plastic"
    sm = (a.get("Material des Schirms") or "").lower()
    sc_txt = (a.get("Farbe des Schirms") or "").lower()
    from finish import _find_color
    fc = _find_color(sc_txt)
    if "glas" in sm or "plexi" in sm or "acryl" in sm:
        shade = {"color": "#f6f4ee", "material": "opal"} if any(k in sc_txt for k in ("weiß", "opal", "satiniert", "milch")) or not sc_txt else (
            {"color": "#e8eef0", "material": "glass"} if any(k in sc_txt for k in ("klar", "transparent")) else {"color": fc[0] if fc else "#e8e2d6", "material": "glass"})
    elif "stoff" in sm:
        shade = {"color": fc[0] if fc else "#efe9dd", "material": "linen"}
    elif "rattan" in sm or "geflecht" in sm:
        shade = {"color": "#c49a6c", "material": "rattan"}
    elif "papier" in sm:
        shade = {"color": "#f3efe6", "material": "paper"}
    elif "metall" in sm:
        c2, m2 = next((v for k, v in METAL_COLORS.items() if k in sc_txt), (col, mat))
        shade = {"color": c2, "material": m2}
    else:
        shade = {"color": "#f6f4ee", "material": "opal"}
    return {"main": {"color": col, "material": mat}, "shade": shade, "frame": {"color": col, "material": mat}}


def lampe():
    f = RES / "lampe_products.json"
    if not f.exists():
        return []
    groups = {}
    for p in json.loads(f.read_text()):
        a = p["attrs"]
        typ = a.get("Produktart")
        if typ not in LAMP_TYPE or not p.get("price") or (a.get("Verwendungsbereich") or "").lower().startswith("außen"):
            continue
        if p["brand"] in LAMP_MID_BRANDS and float(p["price"]) < 99:
            continue  # Mittelklasse-Marken: nur höherwertige Modelle
        cat, mount = LAMP_TYPE[typ]
        nm_l = p["name"].lower()
        # Produktname hat Vorrang vor „Produktart“ (z. B. Leseleuchte, die eine Wandleuchte ist)
        for kw, ty in (("wandleuchte", "Wandleuchte"), ("wandlampe", "Wandleuchte"), ("stehleuchte", "Stehlampe"), ("stehlampe", "Stehlampe"),
                       ("tischleuchte", "Tischleuchte"), ("tischlampe", "Tischleuchte"), ("pendelleuchte", "Pendelleuchte"),
                       ("hängeleuchte", "Hängeleuchte"), ("deckenleuchte", "Deckenleuchte")):
            if kw in nm_l:
                typ = ty
                cat, mount = LAMP_TYPE[ty]
                break
        if cat == "tableLamp" and (cm(a.get("Höhe")) or 0) > 100:
            cat = "floorLamp"  # Leseleuchten in Stehhöhe
        name = re.sub(r",\s*\d+-flammig$", "", p["name"]).strip()
        nl = name.lower()
        H, D, L, B, A = (cm(a.get(k)) for k in ("Höhe", "Durchmesser", "Länge", "Breite", "Ausladung"))
        form = (a.get("Bauform") or "").lower()
        n = int(re.sub(r"\D", "", a.get("Anzahl Flammen") or "1") or 1)
        params = {}
        W = D or B or L or 30
        DD = D or B or W
        HH = H or 30
        if cat == "tableLamp":
            arch = "lampTask" if (typ == "Leseleuchte" or any(k in nl for k in ("tolomeo", "demetra", "tizio", "gelenk", "schreibtischleuchte")) or (L and D and L > 2 * D)) else (
                "lampTableGlobe" if form in ("kugel",) or "eclisse" in nl else ("lampTableMushroom" if any(k in nl for k in ("pilz", "mushroom", "panthella", "nessino", "eclisse")) or form == "halbrund" else "lampTableShade"))
            W = L if arch == "lampTask" and L else W
            DD = D or min(W, 30)
        elif cat == "floorLamp":
            arch = "lampTask" if (typ == "Leseleuchte" or "tolomeo" in nl or "lese" in nl) else ("lampFloorArc" if any(k in nl for k in ("bogen", "arc")) or form == "gebogen" else (
                "lampFloorGlobe" if form == "kugel" else ("lampFloorTripod" if "dreibein" in nl or "tripod" in nl else "lampFloorShade")))
            if arch == "lampFloorArc":
                W = L or A or 150
                DD = D or 40
            elif arch == "lampFloorGlobe":
                params["globe"] = round((D or 30) / 100, 3)
            HH = H or 160
        elif cat == "pendant":
            span = L or B or D or 0
            linear = span > 1.6 * (B if (B and L) else (D or 20)) and (form in ("länglich", "rechteckig") or (L and not D))
            if linear:
                arch = "pendantLinear"
                W, DD = L or 100, B or D or 12
                if n >= 3:
                    params["heads"] = n
                    params["shape"] = "globe" if "glas" in (a.get("Material des Schirms") or "").lower() else "dome"
            elif n >= 3 or typ == "Kronleuchter":
                arch = "pendantCluster"
            elif form in ("kugel", "oval", "organisch", "tropfenförmig", "birnenförmig") or "glas" in (a.get("Material des Schirms") or "").lower():
                arch = "pendantGlobe"
            else:
                arch = "pendantDome"
            # Höhenangaben bei Pendeln enthalten meist die Abhängung → Leuchtenkörper abschätzen
            body = min(HH, max(12, (D or W) * (0.9 if arch == "pendantGlobe" else 0.6)))
            if HH > 60:
                params["maxHang"] = round(HH / 100, 2)
            HH = body if arch != "pendantLinear" else min(HH, 12 if n < 3 else max(15, DD))
        elif cat == "ceilingLamp":
            arch = "ceilingDisc" if (HH or 10) <= 12 or form == "flach" else "ceilingDome"
            if form in ("eckig", "quadratisch", "rechteckig", "länglich"):
                arch = "ceilingDisc"
                W, DD = L or B or W, B or D or W
            HH = min(HH, 45)
            if arch == "ceilingDome":
                params["shape"] = "vanja" if form in ("kugel", "rund") else "dome"
        else:  # Wandleuchte
            flat = (A or 0) <= 12 and form in ("flach", "rund", "eckig", "quadratisch", "rechteckig", "länglich", "halbrund")
            arch = "wallGlobe" if form == "kugel" else "wallSconce"
            if flat and arch == "wallSconce":
                params["shape"] = "plate"
            W = B or L or D or 20
            DD = A or (D if arch == "wallGlobe" else 12) or 12
            HH = H or (W if flat else 25)
        if max(W, DD) < 8:
            continue  # unplausible Maße (z. B. nur Baldachin angegeben)
        slots = lamp_slots(a, name)
        variant = {"name": (a.get("Farbe der Leuchte") or "Standard")[:40] + (f" / {a.get('Farbe des Schirms')}" if a.get("Farbe des Schirms") and a.get("Farbe des Schirms") != a.get("Farbe der Leuchte") else ""),
                   "slots": slots, "price": float(p["price"]), "url": p["url"]}
        # Familie: Produktname ohne Farbe → Varianten
        fam = re.sub(r"\s+(LED\s+)?[A-ZÄÖÜa-zäöü, /-]*$", "", name) if False else re.sub(r"\s+(Schwarz|Weiß|Gold|Messing|Chrom|Silber|Grau|Kupfer|Aluminium|Nickel|Beige|Anthrazit|Edelstahl|Braun|Sand|Orange|Titan|Champagner)\b.*$", "", name)
        key = (p["brand"], fam, round(W / 5), round(HH / 5), arch)
        g = groups.get(key)
        if g:
            if not any(v["name"] == variant["name"] for v in g["variants"]) and len(g["variants"]) < 12:
                g["variants"].append(variant)
            g["price"] = min(g["price"], variant["price"])
            continue
        designer = a.get("Designer")
        light = ", ".join(dict.fromkeys(x for x in (a.get("Fassung"), "LED" if a.get("LED") == "Ja" else "", "dimmbar" if "dimm" in json.dumps(a).lower() else "") if x))
        groups[key] = finalize({
            "id": "lam-" + re.sub(r"[^a-z0-9]+", "-", p["url"].rsplit("/", 1)[-1].replace(".html", "").lower())[:70],
            "vendor": "lampe.de", "brand": p["brand"], "series": fam, "name": fam, "category": cat, "archetype": arch,
            "w": round(W, 1), "d": round(DD, 1), "h": round(HH, 1), "price": float(p["price"]), "url": p["url"], "image": p.get("image"),
            "params": params, "variants": [variant], "premium": True,
            "tags": [p["brand"], typ] + ([designer] if designer else []) + (["Made in Germany"] if a.get("Made in Germany") == "Ja" else []),
            "description": "; ".join(x for x in (f"Design: {designer}" if designer else "", f"{typ}, {n}-flammig", light,
                                                  f"Material: {a.get('Material der Leuchte')}" if a.get("Material der Leuchte") else "",
                                                  f"Schirm: {a.get('Material des Schirms')}" if a.get("Material des Schirms") else "",
                                                  f"Abhängung bis {params['maxHang'] * 100:.0f} cm" if params.get("maxHang") else "") if x),
        })
        if mount == "wall":
            groups[key]["elev"] = round(max(0.3, 1.7 - HH / 200), 2)  # Leuchtenmitte ≈ 1,70 m
        elif cat == "pendant":
            groups[key]["elev"] = round(min(2.56 - HH / 100 - 0.05, 2.0), 2)  # Durchgangshöhe ≥ 2,00 m
    return list(groups.values())


def merge_color_variants(items):
    """Gleiche Produkte in verschiedenen Farben (eigene Shop-URLs) zu einem Eintrag mit Varianten zusammenfassen."""
    out, index = [], {}
    for e in items:
        key = (e["vendor"], e["name"], round(e["w"]), round(e["d"]), round(e["h"]), e["archetype"])
        if key in index:
            tgt = index[key]
            have = {v["name"].lower() for v in tgt["variants"]}
            for v in e["variants"]:
                if v["name"].lower() not in have and len(tgt["variants"]) < 24:
                    v = dict(v)
                    v.setdefault("price", e["price"])
                    v.setdefault("url", e.get("url"))
                    tgt["variants"].append(v)
                    have.add(v["name"].lower())
            tgt["price"] = min(tgt["price"], e["price"])
            continue
        e["variants"][0].setdefault("price", e["price"])
        e["variants"][0].setdefault("url", e.get("url"))
        index[key] = e
        out.append(e)
    return out


def main():
    groups = [("Konzepte", concept_items()), ("Westwing", merge_color_variants(westwing())), ("IKEA", merge_color_variants(ikea())), ("JYSK", merge_color_variants(jysk())), ("Tylko", tylko()), ("lampe.de", lampe()), ("Ergänzungen", generic_items())]
    seen = set(); cat = []
    for label, items in groups:
        k = 0
        for e in items:
            if e["id"] in seen or (e["vendor"] not in ("Bestand",) and not e.get("concepts") and EXCLUDE_NAME.search(e["name"])):
                continue
            seen.add(e["id"]); cat.append(e); k += 1
        print(f"{label}: {k}")
    for e in cat:
        for kk in ("w", "d", "h", "price"):
            if isinstance(e.get(kk), (int, float)):
                e[kk] = round(float(e[kk]), 2)
    (DATA / "catalog.json").write_text(json.dumps(cat, ensure_ascii=False, separators=(",", ":")))
    by = {}
    for e in cat:
        by.setdefault((e["vendor"], e["category"]), 0)
        by[(e["vendor"], e["category"])] += 1
    print("Gesamt:", len(cat), "Einträge,", round((DATA / "catalog.json").stat().st_size / 1e6, 2), "MB")


if __name__ == "__main__":
    main()
