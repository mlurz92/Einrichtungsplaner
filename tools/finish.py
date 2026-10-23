"""Ausführungs-/Farbtexte der Händler → Bauteil-Slots (Farbe + Material) für die 3D-Darstellung.

Beispiele:
  „Gunnared beige“                → Stoff, Beige
  „weiß/Eicheneff wlas“           → Korpus Weiß, Front Eiche weiß lasiert
  „Marmor-Optik schwarz, goldfarben glänzend“ → Platte schwarzer Marmor, Gestell Messing
  „Warme Eiche, Schwarz“          → Eiche warm, Gestell Schwarz
  „ohne Abschluss/Fridtuna dunkel graublau“ → Kunstleder Graublau dunkel
Segmente werden an „/“ und „,“ getrennt; Segmente ohne Farb-/Materialangabe (Konfiguration) entfallen.
"""
import colorsys
import re

# ---------------------------------------------------------------- Farben (längste Schlüssel zuerst prüfen)
COLOR_WORDS = {
    # Weiß/Creme
    "reinweiß": "#f6f5f1", "weiß": "#f3f1ec", "weiss": "#f3f1ec", "white": "#f3f1ec", "off white": "#ede8dc", "off-white": "#ede8dc",
    "offwhite": "#ede8dc", "cremeweiß": "#ede6d8", "creme": "#ece3d0", "cremefarben": "#ece3d0", "elfenbeinweiß": "#ede6d6",
    "elfenbein": "#ede6d6", "naturweiß": "#efebe2", "ecru": "#e9e1cf", "perlweiß": "#ece9e2",
    # Beige/Sand/Taupe
    "hellbeige": "#e3d8c5", "beige": "#d6c7ae", "dunkelbeige": "#bba78b", "graubeige": "#c5bba9", "braunbeige": "#b69f83",
    "sand": "#d6c4a4", "sandfarben": "#d6c4a4", "greige": "#c9c0b2", "taupe": "#a49482", "natur": "#d8c3a0", "naturfarben": "#dccbae",
    "kaschmir": "#d9c9b1", "camel": "#b98d5c", "champagner": "#d8c8a6",
    # Braun
    "hellbraun": "#b08a63", "braun": "#7a5a43", "dunkelbraun": "#4e3a2c", "schwarzbraun": "#33261f", "graubraun": "#7a6a5b",
    "goldbraun": "#9a6a35", "rotbraun": "#7b3f2a", "cognac": "#9a5b34", "karamell": "#b98a5a", "nougat": "#a88468", "mokka": "#5a4334",
    "espresso": "#3b2a21", "schokobraun": "#45312a", "haselnuss": "#9b7653",
    # Grau/Schwarz
    "hellgrau": "#c9c8c4", "grau": "#8f8f8b", "mittelgrau": "#8b8b88", "dunkelgrau": "#4b4b49", "steingrau": "#8e8a83",
    "anthrazit": "#3a3b3c", "graphit": "#3c3e41", "schwarzgrau": "#2f2f2f", "schwarz": "#1d1d1d", "black": "#1d1d1d", "silber": "#c6cbd0",
    "silberfarben": "#c6cbd0",
    # Grün
    "hellgrün": "#b9c9a8", "grün": "#5d7a5a", "dunkelgrün": "#2f4a3a", "salbeigrün": "#a7b59e", "salbei": "#a7b59e", "graugrün": "#8c9a85",
    "olivgrün": "#6e7450", "oliv": "#6e7450", "moosgrün": "#56603d", "tannengrün": "#2f4a3a", "flaschengrün": "#24463a",
    "smaragdgrün": "#1f6b52", "mint": "#bcd8c6", "gelbgrün": "#a7ad4f", "dunkelgelbgrün": "#7c8236", "khaki": "#8a8457",
    # Blau/Petrol
    "hellblau": "#a9c1d6", "blau": "#3f6680", "dunkelblau": "#253a5e", "graublau": "#5b6f84", "nachtblau": "#22314a",
    "mitternachtsblau": "#28354d", "marineblau": "#1f2d4a", "navy": "#1f2d4a", "taubenblau": "#7d8fa6", "petrol": "#2f6d72",
    "dunkelpetrol": "#244f53", "grünblau": "#2f6670", "blaugrau": "#5b6f84", "schwarzblau": "#232b3b",
    "rostbraun": "#8a4a2e", "dunkeltürkis": "#245e5e", "helltürkis": "#7fbcb8", "pflaume": "#6e3b52", "mauve": "#9c7a8a",
    "petrolnah": "#2f6d72", "beerenrot": "#7a2e3b", "zimt": "#9b5d3a", "tabak": "#7a5a3a", "kastanie": "#6b3e2a", "schiefer": "#5a5f63", "beigegrau": "#b7ad9f", "graugelb": "#b5a77a", "bernsteinfarben": "#c98a3a", "bernstein": "#c98a3a", "amber": "#c98a3a", "rauchfarben": "#6b6660",
    "rauchgrau": "#6b6660", "transparent": "#e8eef0", "klar": "#e8eef0", "gelbbraun": "#9a7140", "olivbraun": "#6b5a3a", "steinbeige": "#cbbfac", "graurosa": "#c4a7a1", "türkis": "#3f8f8f", "grautürkis": "#5f8a8a", "dunkelgrautürkis": "#3c6466", "blaugrün": "#3e7a72",
    # Rot/Rosa/Orange/Gelb
    "rot": "#b23a32", "dunkelrot": "#7a2a2a", "weinrot": "#6e232f", "bordeaux": "#6a2230", "burgund": "#6b2430", "braunrot": "#7b3a2c",
    "rostrot": "#a5563b", "rost": "#a5563b", "terrakotta": "#b8653f", "terracotta": "#b8653f", "koralle": "#de7a62", "orange": "#d07a2f",
    "rosa": "#e3b8b4", "hellrosa": "#ecccc6", "altrosa": "#c99a96", "braunrosa": "#b98a7d", "puderrosa": "#e2bcb7", "pink": "#d98aa0",
    "lila": "#8b6c9a", "flieder": "#b9a7c4", "aubergine": "#4e2c3d", "gelb": "#e0c45a", "dunkelgelb": "#bf9530", "senf": "#c49a2e",
    "senfgelb": "#c49a2e", "ocker": "#c18f3c", "curry": "#c79a2c", "honig": "#c8963e",
    # Metalle als Farbe
    "gold": "#c9a55c", "goldfarben": "#c9a55c", "messing": "#c3a160", "messingfarben": "#c3a160", "kupfer": "#b8703e",
    "kupferfarben": "#b8703e", "bronze": "#8c6a43", "chrom": "#c6cbd0", "verchromt": "#c6cbd0", "vernickelt": "#b9b7b0", "nickel": "#b9b7b0",
    "edelstahl": "#b9bcbf", "edelstahlfarben": "#b9bcbf",
}
# Material-Schlüssel → (Material, Standardfarbe oder None)
MATERIAL_WORDS = [
    # Holz (zusammengesetzte Begriffe zuerst)
    ("eicheneff wlas", ("oak", "#e3d6c2")), ("weiß lasierte eiche", ("oak", "#e3d6c2")), ("weiß gebeizte eiche", ("oak", "#e3d6c2")),
    ("eichenachbildung weiß las", ("oak", "#e3d6c2")), ("weiß lasiert", ("oak", "#e6dccb")), ("weiß las", ("oak", "#e6dccb")),
    ("weiß gebeizt", ("oak", "#e6dccb")), ("dunkle eiche", ("oakDark", "#5e4433")), ("eiche dunkel", ("oakDark", "#5e4433")),
    ("dunkles eichenholz", ("oakDark", "#5e4433")), ("helles eichenholz", ("oak", "#d4b48a")), ("helle eiche", ("oak", "#d4b48a")),
    ("warme eiche", ("oak", "#b88a5a")), ("wild eiche", ("oak", "#c19a6b")), ("natürliche eiche", ("oak", "#c9a477")),
    ("eichenfurnier", ("oak", "#c9a477")), ("eichenachbildung", ("oak", "#c9a477")), ("eicheneffekt", ("oak", "#c9a477")),
    ("eicheneff", ("oak", "#c9a477")), ("eichenholz", ("oak", "#c9a477")), ("eiche", ("oak", "#c9a477")),
    ("nussbaumfurnier", ("walnut", "#6b4a33")), ("nussbaumnachbildung", ("walnut", "#6b4a33")), ("nussbaum", ("walnut", "#6b4a33")),
    ("walnussholz", ("walnut", "#6b4a33")), ("walnuss", ("walnut", "#6b4a33")), ("eschenfurnier", ("ash", "#d9c4a2")),
    ("helles eschenholz", ("ash", "#dcc8a6")), ("eschenholz", ("ash", "#d9c4a2")), ("esche", ("ash", "#d9c4a2")),
    ("birkenfurnier", ("ash", "#dcc19a")), ("birke", ("ash", "#dcc19a")), ("buchenfurnier", ("oak", "#cfa77a")), ("buche", ("oak", "#cfa77a")),
    ("kiefer", ("oak", "#d8b98a")), ("bambus", ("oak", "#c9a06a")), ("akazie", ("walnut", "#8e6440")), ("akazienholz", ("walnut", "#8e6440")),
    ("dunkles mangoholz", ("mango", "#4f3727")), ("mangoholz", ("mango", "#7a5538")), ("mango", ("mango", "#7a5538")),
    ("teakholz", ("oak", "#9a6c45")), ("teak", ("oak", "#9a6c45")), ("gummibaumholz", ("oak", "#b48a5e")), ("kautschuk", ("oak", "#b48a5e")),
    ("pappel", ("ash", "#d8c39f")), ("antikbeize", ("walnut", "#5a3d2a")), ("räuchereiche", ("oakDark", "#6a4c38")), ("wurzelholz", ("burl", "#8a5a36")),
    ("furnier", ("oak", "#c9a477")), ("massivholz", ("oak", "#c9a477")), ("holz", ("oak", "#c9a477")),
    ("lasiert", ("oak", None)), ("gebeizt", ("oak", None)), ("geölt", ("oak", None)),
    # Stein
    ("travertin", ("travertine", "#e3d6c1")), ("marmor-optik", ("marble", "#e7ddd0")), ("marmoroptik", ("marble", "#e7ddd0")),
    ("marmoriert", ("marble", "#e7ddd0")), ("marmor", ("marble", "#e7ddd0")), ("terrazzo", ("stone", "#ddd5c8")),
    ("beton", ("stone", "#a9a6a0")), ("stein", ("stone", "#b9b2a6")), ("keramik", ("ceramic", "#e9e3d8")), ("porzellan", ("ceramic", "#f1eee8")),
    ("steingut", ("ceramic", "#e6dfd2")), ("steinzeug", ("ceramic", "#d9d1c4")),
    # Glas/Spiegel
    ("rauchglas", ("glass", "#6b6660")), ("klarglas", ("glass", "#e8eef0")), ("milchglas", ("opal", "#f4f2ee")), ("frostglas", ("opal", "#f4f2ee")), ("mattglas", ("opal", "#f4f2ee")), ("opalglas", ("opal", "#f4f2ee")),
    ("riffelglas", ("ribbedGlass", "#e8eef0")), ("spiegelglas", ("mirror", "#d9dde0")), ("spiegel", ("mirror", "#d9dde0")), ("glas", ("glass", "#e8eef0")),
    # Metall
    ("messing", ("brass", "#c3a160")), ("goldfarben", ("brass", "#c9a55c")), ("gold", ("brass", "#c9a55c")), ("kupfer", ("copper", "#b8703e")),
    ("verchromt", ("chrome", "#c6cbd0")), ("chrom", ("chrome", "#c6cbd0")), ("vernickelt", ("steel", "#b9b7b0")), ("edelstahl", ("steel", "#b9bcbf")),
    ("silberfarben", ("chrome", "#c6cbd0")), ("aluminium", ("steel", "#c4c6c8")), ("stahl", ("blackMetal", None)), ("metall", ("blackMetal", None)),
    ("eisen", ("blackMetal", "#2a2a2a")),
    # Textil (IKEA-Bezugsnamen + Gattungen)
    ("kunstfell", ("fur", None)), ("fell", ("fur", None)), ("teddy-bouclé", ("teddy", None)), ("teddy", ("teddy", None)),
    ("bouclé meliert", ("boucleMel", None)), ("boucle meliert", ("boucleMel", None)), ("bouclé", ("boucle", None)), ("boucle", ("boucle", None)),
    ("chenille", ("chenille", None)), ("webstoff meliert", ("melange", None)),
    ("samt", ("velvet", None)), ("velours", ("velvet", None)), ("djuparp", ("velvet", None)), ("cord", ("cord", None)),
    ("johanneshov", ("cord", None)), ("leinen", ("linen", None)), ("leder", ("leather", None)), ("kunstleder", ("leather", None)),
    ("grann", ("leather", None)), ("bomstad", ("leather", None)), ("fridtuna", ("leather", None)), ("kimstad", ("leather", None)),
    ("glose", ("leather", None)), ("wolle", ("wool", None)), ("tibbleby", ("boucle", None)), ("kelinge", ("fabric", None)), ("alhamn", ("boucle", None)),
    ("gunnared", ("melange", None)), ("hillared", ("linen", None)), ("vissle", ("fabric", None)), ("remmarn", ("melange", None)),
    ("tonerud", ("melange", None)), ("kilanda", ("chenille", None)), ("hakebo", ("melange", None)), ("hallarp", ("wool", None)),
    ("lofallet", ("fabric", None)), ("tallmyra", ("boucleMel", None)), ("viarp", ("linen", None)), ("knisa", ("linen", None)),
    ("lejde", ("melange", None)), ("vibberbo", ("wool", None)), ("knäbäck", ("fabric", None)), ("gransel", ("melange", None)),
    ("sundhamn", ("linen", None)), ("talliden", ("melange", None)), ("tommaboda", ("chenille", None)), ("kuddarna", ("fabric", None)),
    ("webstoff", ("fabric", None)), ("chenille", ("fabric", None)), ("stoff", ("fabric", None)), ("baumwolle", ("linen", None)),
    ("jute", ("wool", "#b49a72")), ("sisal", ("wool", "#c2a97e")),
    # Sonstige
    ("rattan", ("rattan", "#c49a6c")), ("geflecht", ("rattan", "#c49a6c")), ("korb", ("rattan", "#c49a6c")), ("papier", ("paper", "#f3efe6")),
    ("hochglanz", ("gloss", None)), ("lackiert", ("lacquer", None)), ("kunststoff", ("plastic", None)),
]
TEXTILES = ("fabric", "melange", "chenille", "boucle", "boucleMel", "teddy", "fur", "velvet", "cord", "linen", "leather", "wool")
JUNK = re.compile(r"firesafety|artwall|no\.\s*\d|^\d+$", re.I)
FINISH = {"glänzend": "gloss", "matt": None, "meliert": None}


def _norm(t):
    t = t.lower().replace("ae", "ä") if False else t.lower()
    return (t.replace("weiss", "weiß").replace("gruen", "grün").replace("tuerkis", "türkis").replace("schwarzbr", "schwarzbr")
             .replace("–", "-"))


def _shade(hexc, f):
    r, g, b = (int(hexc[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    l = max(0.04, min(0.97, l * f if f < 1 else l + (1 - l) * (f - 1)))
    r, g, b = colorsys.hls_to_rgb(h, l, s)
    return "#%02x%02x%02x" % (round(r * 255), round(g * 255), round(b * 255))


def _find_color(seg):
    """Erste (früheste, längste) Farbangabe im Segment inkl. Modifikator hell/dunkel."""
    best = None
    for k, v in COLOR_WORDS.items():
        for m in re.finditer(r"(?<![a-zäöüß])" + re.escape(k) + r"(?![a-zäöüß])", seg):
            cand = (m.start(), -len(k), k, v)
            if best is None or cand < best:
                best = cand
    if not best:
        # zusammengesetzte Wörter („mintgrün“, „Grüntöne“, „Brauntöne“): Grundfarbe als Wortteil
        for k in ("türkis", "petrol", "grün", "blau", "braun", "grau", "beige", "rot", "rosa", "gelb", "weiß", "schwarz", "orange", "lila"):
            m = re.search(r"[a-zäöüß]*" + k + r"[a-zäöüß]*", seg)
            if m and (best is None or m.start() < best[0]):
                best = (m.start(), 0, k, COLOR_WORDS[k])
    if not best:
        return None
    col = best[3]
    before = seg[: best[0]]
    if re.search(r"(?:^|\s)(dunkel|dunkles|dunkle)\s*$", before):
        col = _shade(col, 0.7)
    elif re.search(r"(?:^|\s)(hell|helles|helle)\s*$", before):
        col = _shade(col, 1.35)
    return col, best[2]


# Diese Schlüssel nur als ganzes Wort (sonst „goldbraun“ → Messing, „steingrau“ → Stein)
STRICT = {"gold", "goldfarben", "kupfer", "messing", "chrom", "eisen", "stein", "korb", "teak", "holz", "glas", "stahl"}


def _find_material(seg):
    for k, v in MATERIAL_WORDS:
        tail = r"(?![a-zäöüß])" if k in STRICT else ""
        if re.search(r"(?<![a-zäöüß])" + re.escape(k) + tail, seg):
            return k, v
    return None, (None, None)


def parse_finish(text):
    """Liste von Segmenten: dict(color, material, label, kind) – kind: wood/stone/metal/glass/textile/other."""
    if not text or JUNK.search(text):
        return []
    out = []
    for raw in re.split(r"\s*[/,;]\s*|\s+und\s+|\s+&\s+", _norm(text)):
        seg = raw.strip(" -.")
        if not seg:
            continue
        mkey, (mat, mcol) = _find_material(seg)
        cf = _find_color(seg)
        # reine Oberflächenangabe („glänzend“, „matt“) gilt für das vorige Segment
        if out and re.fullmatch(r"(hell|dunkel)(\s+(geölt|gebeizt|lasiert|gebürstet))?", seg):
            out[-1]["color"] = _shade(out[-1]["color"], 1.3 if seg.startswith("hell") else 0.6)
            continue
        if not cf and not mat and out and re.fullmatch(r"(hoch)?glänzend|matt|seidenmatt|irisierend|lackiert", seg):
            prev = out[-1]
            if prev["material"] in (None, "lacquer", "matte", "gloss", "blackMetal"):
                prev["material"] = "gloss" if "glänz" in seg else ("lacquer" if seg != "matt" or prev["material"] is None else prev["material"])
            continue
        if not cf and not mat:
            continue
        # „Transparent Braun“ / „klar grau“ → getöntes Glas
        if cf and cf[1] in ("transparent", "klar"):
            rest_ = seg.replace(cf[1], " ")
            cf2 = _find_color(rest_)
            mat = mat or "glass"
            if cf2:
                cf = cf2
        color = cf[0] if cf else mcol
        # nachgestellte Helligkeit („Gummibaumholz dunkel“)
        if not cf and color and re.search(r"\bdunkle[snr]?\b|\bdunkel\b", seg):
            color = _shade(color, 0.6)
        elif not cf and color and re.search(r"\bhelle[snr]?\b|\bhell\b", seg):
            color = _shade(color, 1.3)
        # Material-Optik + Farbwort (z. B. „Marmor-Optik schwarz“, „Eiche schwarz gebeizt“) → Farbe gewinnt, Textur bleibt
        if mat in ("blackMetal",) and cf and cf[1] in ("gold", "goldfarben", "messing", "chrom", "silberfarben", "kupfer"):
            mat = {"gold": "brass", "goldfarben": "brass", "messing": "brass", "kupfer": "copper"}.get(cf[1], "chrome")
        if mat is None and cf and cf[1] in ("gold", "goldfarben", "messing", "messingfarben"):
            mat = "brass"
        if mat is None and cf and cf[1] in ("chrom", "verchromt", "silberfarben", "silber"):
            mat = "chrome"
        if mat is None and cf and cf[1] in ("kupfer", "kupferfarben"):
            mat = "copper"
        if mat is None and "glänzend" in seg:
            mat = "gloss"
        kind = ("wood" if mat in ("oak", "oakDark", "walnut", "ash", "mango", "burl") else "stone" if mat in ("marble", "travertine", "stone", "ceramic")
                else "metal" if mat in ("brass", "copper", "chrome", "steel", "blackMetal") else "glass" if mat in ("glass", "opal", "ribbedGlass", "mirror")
                else "textile" if mat in TEXTILES else "other")
        if mat == "blackMetal" and color is None:
            color = "#1d1d1d"
        out.append({"color": color or "#bdb5a8", "material": mat, "label": seg, "kind": kind, "has_color": bool(cf) or mcol is not None,
                    "color_pos": seg.find(cf[1]) if cf else -1, "mat_pos": seg.find(mkey) if mkey else -1})
    return _merge(out)


def _merge(segs):
    """Material ohne Farbe + folgende Farbangabe zusammenführen („Bouclé meliert, rostrot“, „Hochglanz / weiß“,
    „Djuparp / dunkel grünblau Eiche“ → Samt grünblau + Eiche)."""
    out = []
    i = 0
    while i < len(segs):
        a = segs[i]
        b = segs[i + 1] if i + 1 < len(segs) else None
        if b and not a["has_color"] and a["material"] and b["has_color"]:
            if b["material"] is None:
                out.append({**a, "color": b["color"], "has_color": True, "label": a["label"] + " " + b["label"]})
                i += 2
                continue
            if b["color_pos"] >= 0 and b["mat_pos"] > b["color_pos"] and b["kind"] != a["kind"]:
                # Farbe vor dem Material des Folgesegments gehört zum Bezug
                out.append({**a, "color": b["color"], "has_color": True})
                _, (m2, c2) = _find_material(b["label"][b["mat_pos"]:])
                out.append({**b, "color": c2 or b["color"]})
                i += 2
                continue
            if b["kind"] == a["kind"]:
                i += 1  # gleiches Material, zweites Segment trägt die Farbe („Grann / Bomstad goldbraun“)
                continue
        out.append(a)
        i += 1
    return out


UPHOLSTERED = ("sofa", "armchair", "pouf", "bench", "bed", "chair", "officeChair", "stool")
TABLES = ("coffeeTable", "sideTable", "diningTable", "console", "desk", "outdoor")
LAMPS = ("floorLamp", "tableLamp", "pendant", "ceilingLamp", "wallLamp")
STORAGE = ("sideboard", "lowboard", "cabinet", "shelf", "wardrobe", "dresser", "nightstand", "media", "kitchen", "bath")


def _dark(c):
    return sum(int(c[i:i + 2], 16) for i in (1, 3, 5)) < 220


def slots_from(category, text, name="", fallback=None):
    """Bauteil-Slots aus Ausführungstext (und ggf. Produktname) je Kategorie."""
    segs = parse_finish(text)
    if not segs and name:
        segs = parse_finish(name)
    if not segs:
        return fallback
    # Material aus dem Produktnamen, falls die Ausführung nur eine Farbe nennt („Tischlampe … Porzellan“, „Hellgrün“)
    _, (name_mat, _c) = _find_material(_norm(name))
    for s_ in segs[:1]:
        if s_["material"] is None and name_mat and name_mat not in ("blackMetal",) and category not in LAMPS:
            s_["material"] = name_mat
            s_["kind"] = ("wood" if name_mat in ("oak", "oakDark", "walnut", "ash", "mango", "burl") else "stone" if name_mat in ("marble", "travertine", "stone", "ceramic")
                          else "metal" if name_mat in ("brass", "copper", "chrome", "steel") else "glass" if name_mat in ("glass", "opal") else
                          "textile" if name_mat in TEXTILES else "other")
    first = segs[0]
    rest = segs[1:]
    def pick(kinds):
        return next((s for s in rest if s["kind"] in kinds), None)
    if category in UPHOLSTERED:
        tex = next((s for s in segs if s["kind"] == "textile"), None) or next((s for s in segs if s["kind"] not in ("wood", "metal")), None)
        legs = next((s for s in segs if s is not tex and s["kind"] in ("wood", "metal")), None) or \
            next((s for s in segs if s is not tex and s["kind"] == "other" and tex is not None), None)
        if tex is None:
            # nur Gestell angegeben („Dunkles Eschenholz“): Bezug aus dem Rückfall, Gestell aus der Ausführung
            fbm = (fallback or {}).get("main") or {"color": "#d9cbb4", "material": "fabric"}
            main = {"color": fbm["color"], "material": fbm["material"] if fbm["material"] in TEXTILES else "fabric"}
            if legs and fbm["color"] == legs["color"]:
                main["color"] = "#d9cbb4"
        else:
            main = {"color": tex["color"], "material": tex["material"] if tex["kind"] == "textile" else ("leather" if "leder" in name.lower() else "fabric")}
        lg = {"color": legs["color"], "material": legs["material"] or ("blackMetal" if _dark(legs["color"]) else "lacquer")} if legs else (
            {"color": "#a37a52", "material": "oak"} if "holz" in name.lower() else {"color": "#1d1d1d", "material": "blackMetal"})
        return {"main": main, "legs": lg}
    if category in TABLES:
        # Platte: Stein > Glas > Holz > erstes Segment; Gestell: nächstes übriges Segment
        top = next((s for s in segs if s["kind"] == "stone"), None) or next((s for s in segs if s["kind"] == "glass"), None) or \
            next((s for s in segs if s["kind"] == "wood"), None) or first
        legs = next((s for s in segs if s is not top), None) or (top if top["kind"] == "wood" else {"color": "#1d1d1d", "material": "blackMetal"})
        tm = top["material"] or ("lacquer" if top["kind"] == "other" else "oak")
        lm = legs["material"] or ("blackMetal" if _dark(legs["color"]) else "lacquer")
        return {"top": {"color": top["color"], "material": tm}, "main": {"color": top["color"], "material": tm},
                "legs": {"color": legs["color"], "material": lm}}
    if category in LAMPS:
        body = next((s for s in segs if s["kind"] in ("metal", "wood", "stone")), None)
        orig = body
        if body is None:
            # Händlerreihenfolge „Schirm, Gestell“ (z. B. „Beige, Dunkelbraun“ bei Holz-Stehlampen)
            orig = body = segs[-1] if len(segs) > 1 else first
            if name_mat and body["material"] is None:
                body = {**body, "material": name_mat}
        shade = next((s for s in segs if s is not orig), None)
        bm = body["material"] or "matte"
        sm = (shade["material"] if shade and shade["material"] else ("opal" if not shade or shade["color"] > "#e0" else "linen"))
        return {"main": {"color": body["color"], "material": bm}, "frame": {"color": body["color"], "material": bm}, "legs": {"color": body["color"], "material": bm},
                "shade": {"color": shade["color"] if shade else "#f6f4ee", "material": sm}}
    if category in ("rug", "curtain", "textile"):
        m = first["material"] if first["kind"] == "textile" else ("wool" if category == "rug" else "linen")
        out = {"main": {"color": first["color"], "material": m}}
        if rest:
            out["secondary"] = {"color": rest[0]["color"], "material": m}
        return out
    if category == "mirror":
        return {"frame": {"color": first["color"], "material": first["material"] or "blackMetal"}}
    if category in ("decor", "plant", "art"):
        out = {"main": {"color": first["color"], "material": first["material"] or ("canvas" if category == "art" else "ceramic")}}
        if rest:
            out["secondary"] = {"color": rest[0]["color"], "material": rest[0]["material"] or out["main"]["material"]}
        return out
    # Kleiderschrank-Kombinationen „KORPUS / FRONT“ (PAX / BERGSBO …) → sichtbare Front ist das letzte Segment
    main = segs[-1] if (category == "wardrobe" and " / " in name and len(segs) > 1) else first
    other = next((s for s in segs if s is not main), None)
    mm = main["material"] or "lacquer"
    out = {"main": {"color": main["color"], "material": mm}}
    if other and (other["kind"] in ("metal", "wood") or (other["kind"] == "other" and other["material"] is None)):
        om = other["material"] or ("blackMetal" if _dark(other["color"]) else "lacquer")
        out["legs"] = {"color": other["color"], "material": om}
        out["detail"] = {"color": other["color"], "material": om}
    elif other:
        out["secondary"] = {"color": other["color"], "material": other["material"] or mm}
    return out


def variant_label(text):
    """Lesbarer Variantenname (Großschreibung, Umlaute, IKEA-Abkürzungen)."""
    t = (text or "").strip()
    t = re.sub(r"\bwlas\b", "weiß lasiert", t)
    t = re.sub(r"\blas\.", "lasiert", t)
    t = re.sub(r"\bEicheneff\b", "Eicheneffekt", t)
    return t[:1].upper() + t[1:] if t else "Standard"
