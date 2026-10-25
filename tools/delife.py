"""DELIFE-Sortiment (delife.de) → Katalogeinträge mit allen Ausführungen.

Quelle: research/data/delife_products.json (scrape_delife.py) und research/data/delife_colors.json (delife_colors.py).
Je Produktfamilie (Variantenwechsel des Shops) und Gestellart bzw. Maß entsteht ein Eintrag; die übrigen Wahlmöglichkeiten
des Shops (Bezug, Farbe, Gestellfarbe, Plattenstärke …) werden Ausführungsachsen mit eigenem Preis, Link und Foto.
Farben: Bezüge aus dem Produktfoto gemessen, Platten/Korpusse nach Dekorname (Laminam®, Keramik, Akazie …),
Gestelle nach Gestellfarbe/-material. Gestellformen und Schalenformen sind nach Produktfoto nachgebaut
(Archetyp chairFlex, tableRect mit legStyle edge/uframe/slant/spider/glass/pillars/cone/ribbon).
"""
import colorsys
import json
import re
from pathlib import Path

from finish import parse_finish

RES = Path(__file__).resolve().parent / "research/data"
MAX_VARIANTS = 150

# ------------------------------------------------------------------ Kategorien (nach dem ersten Wort des Artikelnamens)
NAME_CAT = [
    (r"^(Esszimmerstuhl|Drehstuhl|Freischwinger|Armlehnstuhl|Stuhl)\b", "chair"),
    (r"^(Barstuhl|Barhocker|Tresenhocker)\b", "chair"),
    (r"^Outdoorstuhl\b", "outdoor"),
    (r"^(Esstisch|Esszimmertisch|Küchentisch|Konferenztisch)\b", "diningTable"),
    (r"^Outdoortisch\b", "diningTable"),
    (r"^(Couchtisch|Sofatisch)\b", "coffeeTable"),
    (r"^Beistelltisch\b", "sideTable"),
    (r"^(Konsolentisch|Konsole)\b", "console"),
    (r"^(Lowboard|Designer-Lowboard|Design-Lowboard|TV-Board|Fernsehtisch)\b", "lowboard"),
    (r"^(Sideboard|Design-Sideboard)\b", "sideboard"),
    (r"^(Highboard|Vitrine|Barschrank|Kommode)\b", "cabinet"),
    (r"^(Regal|Bücherregal|Standregal|2er-Set-Standregal)\b", "shelf"),
    (r"^Schreibtisch\b", "desk"),
    (r"^(Esszimmerbank|Sitzbank|Bank)\b", "bench"),
    (r"^(Boxspringbett|Polsterbettgestell|Polsterbett|Boxspringgestell|Bett|Dream)\b", "bed"),
    (r"^(Ecksofa|Eckcouch|Wohnlandschaft)\b", "sofa"),
    (r"^(Big-Sofa|Sofa|Hussensofa|[23]-Sitzer|Schlafsofa)\b", "sofa"),
    (r"^(Loungesessel|Sessel|Cocktailsessel)\b", "armchair"),
    (r"^Hocker\b", "pouf"),
    (r"^(Kissen|Wurfkissen)\b", "textile"),
    (r"^(Vase|Schale|Figur|Skulptur|Gong)\b", "decor"),
    (r"^Gemälde\b", "art"),
    (r"^Spiegel\b", "mirror"),
    (r"^Teppich\b", "rug"),
    (r"^(Pendelleuchte|Hängeleuchte|Lampenschirm)\b", "pendant"),
    (r"^Deckenleuchte\b", "ceilingLamp"),
]
SKIP = re.compile(r"^(Stoffmuster|Holzmuster|Geschenkgutschein|Fuß|W-Gestell|Sonnenschirm|Lattenrost)\b|Fußvariantenset|Ersatz|Zubehör")
SIZE_GROUPS = {"Breite", "Höhe", "Tiefe", "Breite Liegefläche", "Sitztiefe", "Gutscheinwert"}
FRAME_GROUPS = ("Sitzgestell", "Gestell", "Sitzgestell Eckbank")

# ------------------------------------------------------------------ Stuhlsystem „Flex“: Schalenform nach Produktfoto
FLEX = {  # Modell → (Schale, Steppung)
    "Abelia": ("arm", "seam"), "Alja": ("arm", "seam"), "Caja": ("tub", "none"), "Clea": ("arm", "seam"), "Earnest": ("side", "tufted"),
    "Elso": ("side", "none"), "Gaio": ("tub", "tufted"), "Greg": ("arm", "channel"), "Heira": ("arm", "none"), "Jada": ("tub", "channel"),
    "Jova": ("arm", "seam"), "Kaira": ("arm", "seam"), "Keila": ("arm", "channel"), "Lelio": ("side", "none"), "Luan": ("arm", "seam"),
    "Luiga": ("side", "channel"), "Nela": ("arm", "none"), "Nube": ("shell", "none"), "Pejo": ("arm", "seam"), "Pela": ("side", "seam"),
    "Taimi": ("arm", "tufted"), "Vinja": ("arm", "none"), "Vinka": ("tub", "none"), "Xana": ("arm", "none"), "Yago": ("arm", "none"),
    "Yulo": ("arm", "seam"), "Zelia": ("arm", "channel"), "Zoa": ("arm", "none"),
}
CHAIR_BASE = {  # Sitzgestell → (base, Drehfunktion)
    "Gestell konisch": ("cone", False), "Kreuzgestell konisch": ("cross", False), "Kreuzgestell kantig": ("crossSquare", False),
    "Kreuzgestell breit": ("crossFlat", False), "Kreuzgestell mit Wippfunktion": ("crossFlat", True), "Holzgestell kantig": ("wood", False),
    "Fußkreuz Wippfunktion": ("star", True), "Kufengestell": ("sled", False), "Freischwinger flach": ("cantilever", False),
    "Säule": ("column", True), "Säulengestell": ("column", True), "Kufengestell flach": ("sled", False),
}
# DELIFE-Tischgestelle → tableRect-Parameter (Form nach Produktfoto, Maße aus „Maße Gestell“)
TABLE_BASE = {
    "V-Gestell": {"legStyle": "edge"}, "Prisma": {"legStyle": "edge"},
    "Breit": {"legStyle": "uframe", "frameW": 0.075}, "Schmal": {"legStyle": "uframe", "frameW": 0.10, "bar": 0.03},
    "Schräg": {"legStyle": "slant", "frameW": 0.075},
    "Kreuzgestell": {"legStyle": "spider", "bar": "square", "legSize": 0.05}, "Spider": {"legStyle": "spider", "bar": "flat", "legSize": 0.05},
    "Estelar": {"legStyle": "spider", "bar": "round", "legSize": 0.045}, "Zenthara": {"legStyle": "spider", "bar": "square", "legSize": 0.055},
    "Glas": {"legStyle": "glass"}, "Pilier": {"legStyle": "pillars", "pillarD": 0.30}, "Troa": {"legStyle": "pillars", "pillars": 1, "pillarD": 0.43},
    "Cono": {"legStyle": "cone"}, "W-Gestell": {"legStyle": "ribbon", "ribbon": "w"}, "Infinity": {"legStyle": "ribbon", "ribbon": "infinity"},
    "Wave": {"legStyle": "ribbon", "ribbon": "wave"}, "Origami": {"legStyle": "ribbon", "ribbon": "origami"},
}

# ------------------------------------------------------------------ Dekore/Materialien (Platte, Korpus)
DECOR = [  # Schlüssel im Farb-/Materialtext → (Farbe, Material)
    ("noir d", ("#45403c", "marbleNoir")), ("nero greco", ("#2b2b2c", "marble")), ("agatablack", ("#232324", "marble")),
    ("calacatta", ("#ebe6de", "marble")), ("statuariet", ("#efedea", "marble")), ("emperador", ("#5b4535", "marble")),
    ("travertin", ("#e2d5c0", "travertine")), ("onice grigio", ("#cbc8c1", "marble")), ("onice oro", ("#dbc8a3", "marble")),
    ("patagonia", ("#bba78c", "marble")), ("minas", ("#e3dccf", "stone")), ("sabbia", ("#c6a982", "oak")),
    ("beton", ("#9d9b96", "stone")), ("schwarz 3d", ("#202021", "stone")), ("perlmutt 3d", ("#d9d4cb", "stone")),
    ("schiefer", ("#3e4043", "stone")), ("forest fire", ("#6b5444", "stone")), ("echter marmor", ("#e9e2d8", "marble")),
    ("onyx pearl", ("#d6d1c6", "marble")), ("onyx champagne", ("#d8c6a5", "marble")), ("reliefglas", ("#2a2a2c", "glass")),
    ("marmor schwarz", ("#262627", "marble")), ("marmor weiß", ("#ece8e2", "marble")), ("marmor", ("#e9e2d8", "marble")),
]
DECOR_NAMES = ["Laminam®", "Laminam", "Statuarietto", "Sabbia", "Travertino Bianco", "Minas Melange", "Calacatta Luxe", "Nero Greco", "Noir Desir",
               "Emperador Extra Lucidato", "Onice Grigio", "Onice Oro", "Patagonia Poliert", "Agatablack", "Beton Grau", "Iris FMG", "Perlmutt", "Champagner"]
# Dekorname der Platte für die Ausführungsbezeichnung („Braun“ → „Laminam® Noir Désir Braun“)
DECOR_LABEL = [("noir desir", "Laminam® Noir Désir"), ("noir désir", "Laminam® Noir Désir"), ("nero greco", "Laminam® Nero Greco"),
               ("statuarietto", "Laminam® Statuarietto"), ("travertino bianco", "Laminam® Travertino Bianco"), ("sabbia", "Laminam® Sabbia"),
               ("calacatta luxe", "Calacatta Luxe"), ("minas melange", "Minas Melange"), ("emperador", "Emperador"), ("onyx pearl", "Onyx Pearl"),
               ("onyx champagne", "Onyx Champagne"), ("onice oro", "Onice Oro"), ("onice grigio", "Onice Grigio"), ("patagonia", "Patagonia"),
               ("agatablack", "Agatablack"), ("beton grau", "Beton"), ("reliefglas", "Reliefglas")]
# Teppiche: Hauptfarbe laut Datenblatt → Garnfarbe
RUG_COLOR = [("steingrau", "#b9b2a6"), ("creme", "#ebe2cf"), ("beige", "#d3c3a8"), ("schlamm", "#a39582"), ("rot", "#9c3b30"),
             ("violett", "#6a4d6e"), ("gelb", "#d4ad4c"), ("grün", "#6f7f5a"), ("blau", "#4c6280"), ("grau", "#a7a49e")]
WOOD = [  # (Holz, Farbton) → (Farbe, Material)
    ("akazie", "platin", ("#cfc6b7", "oak")), ("akazie", "dunkelbraun", ("#4c3426", "walnut")), ("akazie", "hellbraun", ("#a87d53", "oak")),
    ("akazie", "braun", ("#7a5536", "walnut")), ("akazie", "tabak", ("#7a5a3a", "walnut")), ("akazie", "schwarz", ("#2b2622", "oakDark")),
    ("akazie", "", ("#b68955", "oak")), ("eiche", "schwarz", ("#2d2824", "oakDark")), ("eiche", "", ("#c7a273", "oak")),
    ("sheesham", "", ("#8f6440", "walnut")), ("mango", "", ("#7a5538", "mango")), ("esche", "", ("#d6c09d", "ash")), ("bambus", "", ("#c9a06a", "oak")),
]
FRAME_COLOR = [  # Gestellfarbe/-material → (Farbe, Material)
    ("gold-schwarz", ("#6e5a36", "brass")), ("black antique", ("#2b2623", "blackMetal")), ("graphit", ("#46484b", "steel")),
    ("titan", ("#8a8378", "steel")), ("silbergrau", ("#9a9da1", "steel")), ("silber gebürstet", ("#b8bbbe", "steel")), ("edelstahl", ("#b8bbbe", "steel")),
    ("silber", ("#c6cbd0", "chrome")), ("chrom", ("#c6cbd0", "chrome")), ("gold", ("#c9a55c", "brass")), ("messing", ("#c3a160", "brass")),
    ("kupfer", ("#b8703e", "copper")), ("weiß", ("#efeee9", "lacquer")), ("weiss", ("#efeee9", "lacquer")), ("transparent", ("#e8eef0", "glass")),
    ("acryl", ("#e8eef0", "glass")), ("glas", ("#e8eef0", "glass")), ("eiche", ("#c7a273", "oak")), ("natur", ("#c7a273", "oak")),
    ("akazie", ("#a87d53", "oak")), ("holz", ("#c7a273", "oak")), ("aluminium", ("#c4c6c8", "steel")), ("schwarz", ("#1b1b1b", "blackMetal")),
]
TEXTILE = [  # Bezugsmaterial → Materialvorlage
    ("echt-leder", "leather"), ("echt leder", "leather"), ("leder", "leather"), ("kunstleder", "leather"), ("teddy", "teddy"),
    ("bouclé", "boucle"), ("boucle", "boucle"), ("plüsch", "velvet"), ("samt", "velvet"), ("velour", "velvet"), ("cord", "cord"),
    ("chenille", "chenille"), ("mikrofaser", "microfiber"), ("microfaser", "microfiber"), ("microvelours", "microfiber"),
    ("strukturstoff", "melange"), ("webstoff", "fabric"), ("flachgewebe", "linen"), ("wolle", "wool"), ("viskose", "velvet"),
]
UPH = ("chair", "outdoor", "sofa", "armchair", "pouf", "bench", "bed", "textile")
BENCH_BASE = {"Kufengestell flach": "sled", "Kufengestell kantig": "sledSquare", "Kreuzgestell kantig": "crossSquare", "Kreuzgestell": "crossSquare"}
# Wahlmöglichkeiten ohne sichtbaren Unterschied (Matratze, Hocker als Beigabe, Kombinationshinweis): Ausführungen mit gleicher
# Darstellung werden zu einer zusammengefasst (günstigste bleibt, Preis „ab“)
NEUTRAL = {"open": 0, "openPos": "end", "drawers": 0, "shape": "rect", "side": "right", "corner": False, "liveEdge": False,
           "extendable": False, "swivel": False}
NONVISUAL = re.compile(r"hocker|matratze|topper|kombinierbar|freestyle|cozy|icon|pure", re.I)

# Farbfamilien wie audit_catalog.py: gemessene Fotofarbe minimal in den Bereich des Farbnamens verschieben
# (Studiolicht hellt Anthrazit/Schwarz auf, Pastelltöne verlieren Sättigung)
FAMILY_KEYS = [("weiß", "weiss", "white", "creme", "elfenbein", "offwhite", "off white", "naturweiß"), ("schwarz", "black", "anthrazit", "graphit"),
               ("grau", "grey", "gray", "silber", "greige", "taupe"), ("beige", "sand", "kaschmir", "schlamm"),
               ("braun", "hellbraun", "cognac", "espresso", "nougat", "karamell", "mokka", "walnuss", "nussbaum", "eiche dunkel", "dunkle eiche"),
               ("grün", "salbei", "oliv", "petrol", "türkis", "mint"), ("blau", "marine", "navy", "nachtblau", "mitternachtsblau"),
               ("rot", "bordeaux", "weinrot", "burgund", "terrakotta", "rost", "rosa", "pink", "altrosa", "koralle"),
               ("gelb", "senf", "ocker", "gold", "messing", "curry")]


def _family(text):
    n, best = (text or "").lower(), None
    for i, fam in enumerate(FAMILY_KEYS):
        for k in fam:
            m = re.search(r"(?<![a-zäöüß])" + re.escape(k), n)
            if m and (best is None or m.start() < best[1]):
                best = (i, m.start())
    return FAMILY_KEYS[best[0]][0] if best else None


def _fit(label, hexc):
    fam = _family(label)
    if not fam:
        return hexc
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    hh, l, sat = colorsys.rgb_to_hls(r, g, b)
    h = hh * 360

    def clamp_h(a, b_):
        return min(max(h, a), b_)
    if fam == "weiß":
        l = max(l, 0.8)
    elif fam == "schwarz":
        l = min(l, 0.28)
    elif fam == "grau" and l < 0.7:
        sat = min(sat, 0.22)
    elif fam == "beige":
        l, sat = max(l, 0.57), min(sat, 0.5)
        if sat >= 0.12:
            h = clamp_h(22, 58)
    elif fam == "braun":
        l = min(l, 0.58)
        if sat >= 0.14:
            h = clamp_h(12, 43)
    elif fam == "grün":
        h, sat = clamp_h(62, 198), max(sat, 0.1)
    elif fam == "blau":
        h, sat = clamp_h(182, 258), max(sat, 0.1)
    elif fam == "rot":
        if 23 < h < 322:
            h = 23 if h < 170 else 322
        sat = max(sat, 0.17)
    elif fam == "gelb":
        h, sat = clamp_h(32, 63), max(sat, 0.27)
    r, g, b = colorsys.hls_to_rgb(h / 360, l, sat)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def _first(table, text, default=None):
    t = (text or "").lower()
    for k, v in table:
        if k in t:
            return v
    return default


def _lift(hexc, f=1.12):
    """Fotofarbe → Albedo: Schattierung der Studioaufnahme leicht ausgleichen (linear × f)."""
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    r, g, b = colorsys.hls_to_rgb(h, min(0.92, l * f), min(1, s * 1.04))
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def _num(s):
    return float(s.replace(",", "."))


def dims_of(r):
    """Außenmaße (cm) aus „Maße ca.: B… x T… x H…“, sonst aus den strukturierten Shopangaben."""
    for line in (r["details"].get("Produktmaße") or []):
        m = re.search(r"Maße(?: ca\.)?:\s*(?:Ø\s*([\d,]+)|B\s*([\d,]+)(?:\s*-\s*[\d,]+)?\s*x\s*T\s*([\d,]+)(?:\s*-\s*[\d,]+)?)\s*x\s*H\s*([\d,]+)", line)
        if m:
            if m.group(1):
                return _num(m.group(1)), _num(m.group(1)), _num(m.group(4))
            return _num(m.group(2)), _num(m.group(3)), _num(m.group(4))
    return r.get("w"), r.get("d"), r.get("h")


def spec(r, key):
    """Zahl aus den Produktmaßen, z. B. „Sitzhöhe ca.: 47 cm“ → 47."""
    for line in (r["details"].get("Produktmaße") or []) + (r["details"].get("Weitere Details") or []):
        m = re.match(rf"{key}[^:]*:\s*B?\s*([\d,]+)", line)
        if m:
            return _num(m.group(1))
    return None


def frame_dims(r):
    for line in (r["details"].get("Produktmaße") or []):
        m = re.search(r"Maße Gestell[^:]*:\s*B\s*([\d,]+)\s*x\s*T\s*([\d,]+)", line)
        if m:
            return _num(m.group(1)) / 100, _num(m.group(2)) / 100
    return None


def parts(r):
    """„Teil: Angabe“ aus Produktmaterial/-farbe → {Teil: (Material, Farbe)}; Zeilen ohne Teil gehören zum Hauptteil."""
    out = {}
    for sec, idx in (("Produktmaterial", 0), ("Produktfarbe", 1)):
        for line in r["details"].get(sec) or []:
            line = line.lstrip("• ").strip()
            k, sep, v = line.partition(":")
            if not sep or len(k) > 26:
                k, v = "", line
            k = re.sub(r"^(Material|Farbe)\s+", "", k.strip()).lower()
            cur = list(out.get(k, ("", "")))
            cur[idx] = (cur[idx] + " " + v.strip()).strip()
            out[k] = tuple(cur)
    return out


def _part(pp, *keys):
    for k in keys:
        for name, v in pp.items():
            if name == k or name.startswith(k):
                return v
    return None


def surface(text, name=""):
    """Platten-/Korpusoberfläche aus Dekor-, Holz- oder allgemeinem Farbtext."""
    t = f"{text} {name}".lower()
    d = _first(DECOR, text) or (_first(DECOR, name) if "keramik" in t or "marmor" in t else None)
    if d:
        return {"color": d[0], "material": d[1]}
    for wood, tone, val in WOOD:
        if wood in t and tone in (text or "").lower():
            return {"color": val[0], "material": val[1]}
    segs = parse_finish(text)
    if segs:
        s = segs[0]
        mat = s["material"] or ("ceramic" if "keramik" in t else "lacquer")
        if "keramik" in t and mat in ("lacquer", "gloss", None):
            mat = "stone"
        return {"color": s["color"], "material": mat}
    return None


def frame_style(text):
    v = _first(FRAME_COLOR, text)
    return {"color": v[0], "material": v[1]} if v else None


def textile(mat_text):
    return _first(TEXTILE, mat_text, "fabric")


def slots_of(r, cat, measured):
    sel, pp, name = r["sel"], parts(r), r["name"]
    legs = None
    fm = _part(pp, "gestell", "stuhlgestell", "füße", "fuß", "möbelgleiter")
    gtxt = " ".join(x for x in (sel.get("Gestellmaterial"), sel.get("Gestellfarbe")) if x and x != "Metall") or (f"{fm[0]} {fm[1]}" if fm else "")
    if gtxt:
        legs = frame_style(gtxt)
    tail = re.search(r"gestell\b(.*)$", name, re.I)
    if tail and not sel.get("Gestellfarbe") and frame_style(tail.group(1)):
        legs = frame_style(tail.group(1))
    mtail = re.search(r"\bMetall\s+([A-Za-zäöüÄÖÜß]+)\s*$", name)  # „… Drehfuß höhenverstellbar Metall Titanfarben“
    if mtail and not sel.get("Gestellfarbe") and frame_style(mtail.group(1)):
        legs = frame_style(mtail.group(1))
    if cat == "rug":
        hf, zf = (_part(pp, "hauptfarbe") or ("", ""))[1], (_part(pp, "zweitfarbe") or ("", ""))[1]
        col = _first(RUG_COLOR, hf or name, "#d3c3a8")
        out = {"main": {"color": col, "material": "wool"}}
        if zf and zf.lower() != hf.lower():
            out["secondary"] = {"color": _first(RUG_COLOR, zf, col), "material": "wool"}
        return out
    if cat == "art":
        return {"main": {"color": "#d9cdb8", "material": "canvas"}, "secondary": {"color": "#8a6f55", "material": "canvas"},
                "frame": {"color": "#1b1b1b", "material": "blackMetal"}}
    if cat == "mirror":
        fr = _part(pp, "rahmen")
        fs = (surface(f"{fr[0]} {fr[1]}") if fr else None) or frame_style(name) or {"color": "#1b1b1b", "material": "blackMetal"}
        return {"frame": fs, "main": dict(fs)}
    if cat in UPH:
        cover = _part(pp, "schale", "sitzschale", "sitzpolster", "bezug", "polster", "korpus", "") or ("", "")
        mtxt = sel.get("Sitzmaterial") or sel.get("Material") or cover[0] or name
        ctxt = sel.get("Sitzfarbe") or sel.get("Farbe") or cover[1] or r.get("color") or ""
        mat = textile(f"{mtxt} {cover[0]}")
        col = measured.get(r["sku"])
        col = _lift(col) if col else (surface(ctxt) or {"color": "#a89a88"})["color"]
        col = _fit(f"{mtxt} {ctxt}", col)
        out = {"main": {"color": col, "material": mat}}
        two = re.search(r"([A-Za-zäöüÄÖÜß-]+)/([A-Za-zäöüÄÖÜß-]+)", ctxt)
        if two and two.group(1).lower() != two.group(2).lower():
            sec = surface(two.group(2))
            if sec:
                out["secondary"] = {"color": sec["color"], "material": mat}
        out["legs"] = legs or {"color": "#1b1b1b", "material": "blackMetal"}
        return out
    top_p = _part(pp, "tischplatte", "platte", "ablage", "korpus", "front", "")
    ttxt = " ".join(x for x in (sel.get("Material"), sel.get("Farbe")) if x)
    if sel.get("Farbe") and "marmor" in f"{ttxt} {name}".lower() and _first(DECOR, f"marmor {sel['Farbe']}") not in (None, _first(DECOR, "marmor")):
        d0 = _first(DECOR, f"marmor {sel['Farbe']}")
        top = {"color": d0[0], "material": d0[1]}
        legs = legs or {"color": "#1b1b1b", "material": "blackMetal"}
        return {"top": top, "main": dict(top), "legs": legs}
    if top_p:
        ttxt = f"{top_p[1]} {top_p[0]}".strip() + (f" {ttxt}" if not _first(DECOR, top_p[1]) else "")
    top = surface(ttxt, name) or {"color": "#b68955", "material": "oak"}
    out = {"top": top, "main": dict(top), "legs": legs or ({"color": "#1b1b1b", "material": "blackMetal"} if cat not in ("lowboard", "sideboard", "cabinet", "shelf") else dict(top))}
    korpus = _part(pp, "korpus")
    if cat in ("lowboard", "sideboard", "cabinet") and korpus and re.search(r"metallic gold", korpus[1], re.I):
        # Kazu/Yori: Korpus Metallic Gold, Deckplatte bzw. Frontfurnier Keramik Noir Désir
        out["main"] = {"color": "#9b8459", "material": "brass"}  # Metallic-Lack, gedämpfter als Messing
        pl, fu = _part(pp, "platte"), _part(pp, "furnier")
        if pl:
            out["top"] = surface(f"{pl[1]} {pl[0]}") or out["top"]
        if fu:
            out["front"] = surface(f"{fu[1]} {fu[0]}") or dict(out["top"])
            out["top"] = dict(out["main"])
    if cat in ("lowboard", "sideboard", "cabinet", "shelf", "desk", "console"):
        stone = _part(pp, "steinfurnier")
        if stone:
            sv = surface(" ".join(stone))
            if sv:
                out["detail"] = sv
    return out


def category_of(r):
    n = r["name"].strip()
    if SKIP.search(n) or (r.get("category") in ("Gutscheine",)):
        return None
    for pat, cat in NAME_CAT:
        if re.match(pat, n):
            return cat
    return None


def model_of(n):
    m = re.search(r"\b([A-ZÄÖÜ][a-zäöüé]+)-Flex\b", n)
    if m:
        return m.group(1) + "-Flex"
    words = n.split()
    return words[1] if len(words) > 1 else words[0]


def frame_of(r):
    for g in FRAME_GROUPS:
        if r["sel"].get(g):
            return r["sel"][g]
    return None


def _strip(name, vals):
    """Variantenspezifische Angaben (Farben, Bezüge, Gestellfarben) aus dem Artikelnamen entfernen."""
    out = name
    for v in sorted({x for x in vals if x}, key=len, reverse=True):
        out = re.sub(r"(?<!\w)" + re.escape(v) + r"(?!\w)", " ", out, flags=re.I)
    out = re.sub(r"\b(Vintage|Antik Optik|Optik|Taschenfederkern|Edelstahl gebürstet|Edelstahl|Metall|Effektfinish Titan|Graphit|Titanfarbig)\b", " ", out)
    out = re.sub(r"\b\d{3}° drehbar\b|\bmit Wippfunktion\b|\bWippfunktion\b", " ", out)
    out = re.sub(r"\s+", " ", out).strip(" -,")
    words = out.split(" ")
    if len(words) > 2 and words[0] in words[2:]:  # „Freischwinger Pejo-Flex Freischwinger flach“ → „Freischwinger Pejo-Flex flach“
        k = words.index(words[0], 2)
        out = " ".join(words[:k] + words[k + 1:])
    return out


LABEL_ORDER = ["Sitzmaterial", "Material", "Sitzfarbe", "Farbe", "Tischplatte", "Ausführung", "Gestellmaterial", "Gestellfarbe",
               "Armlehne", "Hocker", "Ottomane", "Ausstattung", "Ausrichtung Eckbank", "Freestyle Design", "Kombinierbar mit"]


def _frame_label(gm, gf):
    """„Edelstahl gebürstet“ statt „Edelstahl gebürstet Silber gebürstet“, „Eiche natur“, sonst die Gestellfarbe."""
    if not gm or gm == "Metall":
        return gf or ""
    if gm.startswith("Edelstahl"):
        return gm
    return f"{gm} {gf.lower()}" if gf else gm


def _label(sel, axes):
    vals = []
    gm, gf = sel.get("Gestellmaterial"), sel.get("Gestellfarbe")
    for k in LABEL_ORDER:
        if k not in axes or not sel.get(k):
            continue
        v = sel[k]
        if k == "Gestellmaterial":
            continue
        if k == "Gestellfarbe":
            v = "Gestell " + _frame_label(gm, gf)
        if k == "Tischplatte" and re.match(r"[\d,]+\s*cm", v):
            v = f"Platte {v}"
        vals.append(v)
    if "Gestellmaterial" in axes and "Gestellfarbe" not in axes and gm:
        vals.append(f"Gestell {gm}")
    out = []
    for v in vals:  # „Mikrofaser“ + „Taupe Vintage“ → „Mikrofaser Taupe Vintage“
        if out and not v.startswith(("Gestell", "Platte")) and not out[-1].startswith(("Gestell", "Platte")) and len(out) == 1:
            out[-1] = f"{out[-1]} {v}"
        else:
            out.append(v)
    return ", ".join(out) or "Standard"


def _finish_suffix(label, r):
    """Bezugsoptik aus dem Artikelnamen ergänzen, die der Farbwähler weglässt:
    Sitzfarbe „Beige“, Artikel „… Mikrofaser Beige Vintage …“ → „Mikrofaser Beige Vintage“."""
    for k in ("Sitzfarbe", "Farbe"):
        v = r["sel"].get(k)
        if not v:
            continue
        m = re.search(r"(?<!\w)" + re.escape(v) + r" (Vintage|Antik)(?!\w)", r["name"])
        if m and m.group(0) not in label:
            label = re.sub(r"(?<!\w)" + re.escape(v) + r"(?!\w)", m.group(0), label, count=1)
        break
    return label


def _decor_label(label, r, cat):
    """Plattendekor aus dem Artikelnamen vor die Farbe setzen: „Braun, Gestell Schwarz“ → „Laminam® Noir Désir Braun, Gestell Schwarz“."""
    v = r["sel"].get("Farbe")
    if cat in UPH or not v:
        return label
    nl = r["name"].lower()
    dec = next((d for k, d in DECOR_LABEL if k in nl), None)
    if not dec or re.search(r"(?<!\w)" + re.escape(dec.lower()) + r"(?!\w)", label.lower()):
        return label
    first = dec.replace("Laminam® ", "").split()[0].lower()
    new = dec + (" Grau" if dec == "Beton" else "") if first in v.lower() else f"{dec} {v}"
    return re.sub(r"(?<!\w)" + re.escape(v) + r"(?!\w)", new, label, count=1)


def _slug(s):
    s = s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:40]


def _img(u):
    return f"{u}?imwidth=800" if u else None


def arch_params(r, cat, model, frame):
    """Archetyp und Formparameter einer Ausführung (Gestell, Schale, Platte, Seite der Ottomane/Ecke …)."""
    params, arch = {}, None
    nl = r["name"].lower()
    sel = r["sel"]
    if not frame and cat in ("chair", "outdoor", "bench"):  # Artikel ohne Gestell-Wähler: Gestellart aus dem Namen
        frame = next((k for k in sorted(set(CHAIR_BASE) | set(BENCH_BASE), key=len, reverse=True) if re.search(r"(?<!\w)" + re.escape(k) + r"(?!\w)", r["name"])), None)
    if cat in ("chair", "outdoor"):
        m = model.replace("-Flex", "")
        shell, stitch = FLEX.get(m, ("arm" if ("armlehn" in nl or spec(r, "Armlehnenhöhe")) else "side", "none"))
        base, swivel = CHAIR_BASE.get(frame or "", ("cone", False))
        if "drehstuhl" in nl or "360°" in nl:
            swivel = True
        seat = spec(r, "Sitzhöhe")
        arm = spec(r, "Armlehnenhöhe")
        params = {"shell": shell, "stitch": stitch, "base": base, "seatHeight": round((seat or (75 if "barstuhl" in nl else 48)) / 100, 3)}
        if arm:
            params["armHeight"] = round(arm / 100, 3)
        if swivel:
            params["swivel"] = True
        if sel.get("Armlehne"):
            params["shell"] = "side" if sel["Armlehne"].startswith("Ohne") else ("arm" if shell == "side" else shell)
            if params["shell"] == "side":
                params.pop("armHeight", None)
        arch = "chairFlex"
    elif cat == "bench" and (spec(r, "Sitzhöhe") or "flex" in nl):
        seat, arm, back = spec(r, "Sitzhöhe"), spec(r, "Armlehnenhöhe"), spec(r, "Rückenhöhe")
        fr = re.sub(r"^EBS-", "", frame or "")
        params = {"seatHeight": round((seat or 48) / 100, 3), "base": BENCH_BASE.get(fr, "legs"), "back": bool(back)}
        if arm:
            params["armHeight"] = round(arm / 100, 3)
        if "eckbank" in nl or "ecke" in " ".join(sel.values()).lower() or (r.get("d") or 0) > 120:
            params["corner"] = True
            params["side"] = "left" if re.search(r"\blinks\b", (sel.get("Ausrichtung Eckbank") or "") + " " + nl, re.I) else "right"
            sd = spec(r, "Sitztiefe")
            params["benchDepth"] = round(min(0.8, ((sd or 48) + 21) / 100), 3)
        arch = "benchFlex"
    elif cat == "diningTable" or (cat in ("console", "desk") and frame in TABLE_BASE):
        arch = "tableRect"
        t = spec(r, "Tischplattenstärke") or spec(r, "Maße Tischplatte")
        th = r["details"].get("Produktmaße") or []
        tl = next((re.search(r"x\s*H\s*([\d,]+)", l) for l in th if l.startswith("Maße Tischplatte")), None)
        top = _num(tl.group(1)) if tl else (t or 3.5)
        params = {"top": round(max(0.8, min(8, top)) / 100, 3), "radius": 0.004, "noApron": True}
        params.update(TABLE_BASE.get(frame or "", {"legStyle": "uframe", "frameW": 0.075}))
        fdim = frame_dims(r)
        if fdim and params.get("legStyle") in ("spider", "cone", "ribbon"):
            params["frameW"], params["frameD"] = round(fdim[0], 3), round(fdim[1], 3)
        elif fdim and params.get("legStyle") in ("uframe", "slant", "glass"):
            params["frameD"] = round(fdim[1], 3)
        ov = spec(r, "Tischplattenüberstände")
        if ov:
            params["overhang"] = round(ov / 100, 3)
        if re.search(r"live-edge|baumkante", " ".join(r["details"].get("Weitere Details") or []) + " " + nl, re.I):
            params["liveEdge"] = True
        if "ausziehbar" in nl:
            params["extendable"] = True
        if re.search(r"\boval\b", nl):
            params["shape"] = "oval"
        elif re.search(r"\bboot", nl) or "Boot" in " ".join(sel.values()):
            params["shape"] = "boat"
        elif re.search(r"\brund\b|ø", nl):
            params["shape"] = "round"
        pt = re.match(r"([\d,]+)\s*cm", sel.get("Tischplatte") or "")
        if pt:
            params["top"] = round(_num(pt.group(1)) / 100, 3)
    if cat in ("sofa", "armchair") and (sel.get("Ottomane") or re.search(r"\b(links|rechts)\b", nl)):
        params["side"] = "left" if re.search(r"links", (sel.get("Ottomane") or "") + " " + nl) else "right"
    if cat in ("sideboard", "lowboard", "cabinet"):
        txt = (sel.get("Ausführung") or "") + " " + r["name"]
        dm, tm = re.search(r"(\d+)\s*Schublade", txt), re.search(r"(\d+)\s*Tür", txt)
        if dm:
            params["drawers"] = int(dm.group(1))
        fm = re.search(r"(\d+)\s*(?:Fach|Fächer)", txt)
        if tm:
            params["doors"] = int(tm.group(1))
        if fm:
            params["open"] = int(fm.group(1))
            if re.search(r"mittig", txt):
                params["openPos"] = "center"
        elif dm and tm:
            params["doors"] = int(tm.group(1)) + 1  # Türen + Schubladenturm (eine Spalte)
    return arch, params


def entries(arch_for, finalize, stone_tags):
    f = RES / "delife_products.json"
    if not f.exists():
        return []
    data = json.loads(f.read_text())
    measured = json.loads((RES / "delife_colors.json").read_text()) if (RES / "delife_colors.json").exists() else {}
    fams = data["families"]
    groups = {}
    for r in data["rows"]:
        cat = category_of(r)
        if not cat or not r.get("price"):
            continue
        W, D, H = dims_of(r)
        if not W or not D or not H:
            continue
        # Artikel ohne Ausführungs-Wähler (eigene Familie je Farbe): nach Modell zusammenfassen
        fam = r["family"] if len(fams.get(r["family"]) or {}) else f"{cat}:{model_of(r['name'])}"
        key = (fam, cat, frame_of(r))
        lst = groups.setdefault(key, [])
        # Maßgruppen innerhalb der Familie (±3 cm)
        for g in lst:
            if abs(g["dims"][0] - W) <= 3 and abs(g["dims"][1] - D) <= 3 and abs(g["dims"][2] - H) <= 3:
                g["rows"].append(r)
                break
        else:
            lst.append({"dims": (W, D, H), "rows": [r]})
    out = []
    for (fam, cat, frame), dgroups in groups.items():
        for g in dgroups:
            rows = sorted(g["rows"], key=lambda r: (r["sku"] != "25387", r["availability"] != "InStock", r["price"], r["sku"]))
            rep = rows[0]
            W, D, H = g["dims"]
            axes_names = [k for k in LABEL_ORDER if k not in SIZE_GROUPS and len({r["sel"].get(k) for r in rows}) > 1]
            vary_vals = [r["sel"].get(k) for r in rows for k in axes_names] + [rep["sel"].get(k) for k in rep["sel"] if k not in SIZE_GROUPS and k not in FRAME_GROUPS]
            vary_vals += [rep.get("color")]
            if not axes_names and len(rows) > 1:
                vary_vals += [t for r in rows for t in r["name"].split() if not all(t in x["name"].split() for x in rows)]
            if "Farbe" in axes_names:
                vary_vals += DECOR_NAMES
            name = _strip(rep["name"], vary_vals)
            model = model_of(rep["name"])
            variants, seen, sigs, colmap = [], set(), {}, {}
            _, rep_params = arch_params(rep, cat, model, frame)
            common = set.intersection(*(set(r["name"].split()) for r in rows)) if len(rows) > 1 else set()
            labels, extra = {}, {}
            for r in rows:
                label = _label(r["sel"], axes_names) if axes_names else "Standard"
                label = _decor_label(_finish_suffix(label, r), r, cat)
                if not axes_names and len(rows) > 1:
                    # Ausführung aus dem Namensunterschied („Bouclé Schlamm Kreuzgestell kantig“)
                    label = " ".join(t for t in r["name"].split() if t not in common) or "Standard"
                labels[r["sku"]] = label
            by_label = {}
            for r in rows:
                by_label.setdefault(labels[r["sku"]].lower(), []).append(r)
            for same in by_label.values():
                # gleiche Bezeichnung, verschiedene Artikel (Gestellfarbe nur im Namen: „… Metall Weiß“ / „… Metall Schwarz“)
                if len(same) > 1 and len({x["name"] for x in same}) > 1:
                    shared = set.intersection(*(set(x["name"].split()) for x in same))
                    for x in same:
                        diff = " ".join(t for t in x["name"].split() if t not in shared)
                        if diff:
                            labels[x["sku"]] += f" {diff}"
                            extra[x["sku"]] = diff
            for r in rows:
                label = labels[r["sku"]]
                if r["sku"] == "25387":
                    label = "Laminam® Noir Désir Braun, V-Mittelfuß Flachstahl schwarz pulverbeschichtet"
                if label.lower() in seen:
                    continue
                seen.add(label.lower())
                v = {"name": label, "slots": slots_of(r, cat, measured), "price": float(r["price"]), "url": r["url"], "image": _img((r["images"] or [None])[0])}
                # Farbname der Ausführung (ohne Gestellangabe) ist maßgeblich: Fotofarbe in die Farbfamilie schieben,
                # gleiche Fotofarbe bei verschiedenem Farbnamen (geteiltes Shopfoto) → Farbe nach Namen
                cover = re.split(r"(?i),?\s*(?:\S*gestell|gestell)\b", label)[0]
                main = v["slots"].get("main")
                if main and cat in UPH:
                    c0 = main["color"]
                    if c0 in colmap and colmap[c0] != cover.lower():
                        nb = surface(re.sub(r"(?i)bouclé|boucle|mikrofaser\w*|strukturstoff|chenille|samt|cord|soft|vintage", " ", cover))
                        if nb and nb["color"] != c0:
                            c0 = nb["color"]
                        while c0 in colmap and colmap[c0] != cover.lower():
                            c0 = _lift(c0, 1.04)
                    c0 = _fit(cover, c0)
                    colmap.setdefault(c0, cover.lower())
                    main["color"] = c0
                elif main and cat not in UPH:
                    two = re.match(r"^\s*([A-Za-zäöüÄÖÜß-]+)/([A-Za-zäöüÄÖÜß-]+)\s*$", cover)
                    if two and cat in ("decor", "art"):
                        # Zweifarbige Patina (Gold/Olive, Silber/Creme): 30 % Zweitfarbe eingemischt
                        sec = surface(two.group(2)) or {"color": {"olive": "#6f6a3c", "creme": "#ede3cf"}.get(two.group(2).lower())}
                        if sec.get("color"):
                            a, b2 = main["color"], sec["color"]
                            main["color"] = "#" + "".join("%02x" % round(int(a[i:i + 2], 16) * 0.7 + int(b2[i:i + 2], 16) * 0.3) for i in (1, 3, 5))
                            if "top" in v["slots"]:
                                v["slots"]["top"]["color"] = main["color"]
                _, vp = arch_params(r, cat, model, frame)
                vp_full = vp
                vp = {k: x for k, x in vp.items() if rep_params.get(k) != x}
                for k in rep_params:  # beim Ausführungswechsel nicht vom Repräsentanten „erben“
                    if k not in vp_full and k in NEUTRAL:
                        vp[k] = NEUTRAL[k]
                if vp:
                    v["params"] = vp
                sig = json.dumps([v["slots"], vp], sort_keys=True)
                if sig in sigs and NONVISUAL.search(label + " " + sigs[sig]):
                    continue  # nur Matratze/Hocker/Kombination verschieden: günstigste Ausführung genügt
                sigs.setdefault(sig, label)
                opt = fams.get(r["family"], {})
                for k in ("Sitzfarbe", "Farbe"):
                    o = (opt.get(k) or {}).get(r["sel"].get(k) or "")
                    if o and o.get("img"):
                        v["swatch"] = o["img"] + "?imwidth=96"
                        break
                if axes_names:
                    v["opts"] = [r["sel"].get(k) or "–" for k in axes_names]
                    if r["sku"] in extra:
                        v["opts"][-1] = f"{v['opts'][-1]} {extra[r['sku']]}".replace("– ", "")
                variants.append(v)
                if len(variants) >= MAX_VARIANTS:
                    break
            if rep["sku"] == "25387":
                eid = "del-edge-25387"  # seit 2.0.6 in allen Konzepten
            else:
                eid = f"del-{_slug(model)}-{_slug(frame) + '-' if frame else ''}{min(r['sku'] for r in rows)}"
            arch, params = arch_params(rep, cat, model, frame)
            nl = rep["name"].lower()
            e = {
                "id": eid, "vendor": "DELIFE", "brand": "DELIFE", "series": model, "name": name, "category": cat,
                "w": W, "d": D, "h": H, "price": min(v["price"] for v in variants), "url": rep["url"], "image": _img((rep["images"] or [None])[0]),
                "archetype": arch or arch_for(cat, name, W, D, H), "params": params, "variants": variants,
                "tags": ["DELIFE", model], "premium": False, "description": "",
            }
            if len(axes_names) and len(variants) > 1:
                e["axes"] = [{"name": k, "values": list(dict.fromkeys(v["opts"][i] for v in variants))} for i, k in enumerate(axes_names)]
            # Beschreibung: Maße, Material, Farbe laut Datenblatt
            desc = [f"Maße lt. DELIFE: B {W:g} × T {D:g} × H {H:g} cm"]
            for line in (rep["details"].get("Produktmaße") or [])[1:5]:
                desc.append(line)
            if rep["details"].get("Produktmaterial"):
                desc.append("Material: " + "; ".join(rep["details"]["Produktmaterial"][:3]))
            if frame:
                desc.append(f"Gestell: {frame}")
            desc.append(f"{len(variants)} Ausführung{'en' if len(variants) != 1 else ''} lt. Shop (Stand 24.10.2026)")
            e["description"] = " · ".join(desc)[:400]
            mt = " ".join(rep["details"].get("Produktmaterial") or []) + " " + nl
            if cat == "diningTable" and re.search(r"keramik|laminam|marmor|stein", mt, re.I):
                plate = " ".join(rep["details"].get("Produktfarbe") or []) + " " + mt
                e["tags"].append("Keramik/Sinterstein")
                # „Steintisch“ (Filter Essplatz) nur für längliche Platten ab 160 cm, Beschreibung beginnt mit der Platte
                if W >= 159 and params.get("shape") not in ("round",) and W > D * 1.25:
                    e["tags"] += stone_tags(plate)
                    pl = next((x for x in (rep["details"].get("Produktmaterial") or []) if re.match(r"(Tisch)?[Pp]latte", x)), None) or (rep["details"].get("Produktmaterial") or [""])[0]
                    pc = next((x for x in (rep["details"].get("Produktfarbe") or []) if re.match(r"(Tisch)?[Pp]latte", x)), None)
                    lab = re.sub(r"^(Tisch)?[Pp]latte:\s*", "", pl) + (f", {re.sub(r'^(Tisch)?[Pp]latte:\s*', '', pc)}" if pc else "")
                    e["description"] = f"Platte: {lab.strip(' ,') or 'Keramik'} · " + e["description"]
            if cat == "diningTable" and W >= 195 and D >= 95:
                e["tags"].append(f"Rechteckig {round(W / 10) * 10:g} cm")
            if "outdoor" in nl:
                e["tags"].append("Outdoor")
            if params.get("liveEdge"):
                e["tags"].append("Baumkante")
            if params.get("swivel"):
                e["tags"].append("Drehstuhl")
            if params.get("base") == "cantilever":
                e["tags"].append("Freischwinger")
            if cat == "chair":
                e["tags"].append("Polsterstuhl")
            e["premium"] = e["price"] >= 600 or bool(re.search(r"laminam|echt-?leder|marmor", mt, re.I))
            if frame and frame.startswith("Wandbefestigung"):
                e["mount"], e["elev"] = "wall", 0.30
            fe = finalize(e)
            if frame and frame.startswith("Wandbefestigung"):
                fe["mount"], fe["elev"] = "wall", 0.30
            if eid == "del-edge-25387":
                fe["name"] = "DELIFE Esstisch Edge (Keramik Laminam® Noir Désir)"
                fe["params"] = {"top": 0.01, "radius": 0.004, "legStyle": "edge", "noApron": True}
                fe["description"] = ("Platte: Keramik Laminam® Noir Désir (Keramik auf Sicherheitsglas, 10 mm), anthrazitbraun mit ockerfarbener "
                                     "Aderung mit silbergrauem Kern · Gestell: V-Mittelfuß Flachstahl schwarz pulverbeschichtet, 150 × 50 × 70 cm, mittig unter der Platte · "
                                     "Größe: 200 × 100 × 74 cm, rechteckig, Platz für 6–8 Personen · Gewicht 129 kg · Preis DELIFE (delife.de), Art.-Nr. 25387 · "
                                     f"weitere Plattendekore als Ausführung ({len(variants)})")
                fe["tags"] = ["DELIFE", "Edge", "Steintisch", "Marmortisch", "Marmoroptik", "Keramik/Sinterstein", "Rechteckig 200 cm"]
                fe["premium"] = True
                fe["variants"][0]["slots"] = {"top": {"color": "#45403c", "material": "marbleNoir"}, "main": {"color": "#45403c", "material": "marbleNoir"},
                                              "legs": {"color": "#1b1b1b", "material": "blackMetal"}}
            out.append(fe)
    return out
