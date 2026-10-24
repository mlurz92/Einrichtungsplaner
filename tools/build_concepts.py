"""Erzeugt aus den vier Möblierungskonzept-PDFs vollständige Projektdateien für den Einrichtungsplaner.

Eingaben:
  tools/out/concept_products_<n>.json  (extract_concepts.py – Produktlisten inkl. Preise/Links)
  tools/out/shapes_<n>.json            (extract_shapes.py – Möbelformen aus dem Möblierungsplan)
  app/src/data/apartment.json          (extract_floorplan.py – Grundriss)
Ausgaben:
  app/src/data/concepts/concept<n>.json  (Projekt: platzierte Objekte, Budgetpositionen, Wand-/Bodengestaltung)
  app/src/data/conceptCatalog.json       (Katalogeinträge aller Konzeptprodukte)

Koordinaten in Metern (Planachsen). Rotation: Vorderseite zeigt bei 0° nach +y; der 8°-Flügel
ergibt die Grundwinkel S=8 (Front Süd), W=98 (Front West), N=188 (Front Nord), E=278 (Front Ost).
"""
import json, math, re, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "tools/out"
DATA = ROOT / "app/src/data"
APT = json.loads((DATA / "apartment.json").read_text())
CEIL = APT["ceilingHeight"]

S, W, N, E = 8, 98, 188, 278          # Flügel (8° gedreht)
S0, W0, N0, E0 = 0, 90, 180, 270      # orthogonaler Teil (Diele, Arbeit, Bad, Balkon 1)

WALL_WHITE = "#f3f0e8"   # warmweiß matt (NCS S 0502-Y)
CEIL_WHITE = "#f7f5f0"
OAK_FLOOR = "#cfae84"

TITLES = {
    1: ("Konzept 1 · Travertin · Kupfer · Salbei", "Luxus-Design-Möblierung mit Westwing, IKEA und JYSK, Wandgestaltung mit OBI-Material"),
    2: ("Konzept 2 · Espresso · Petrol · Chrom", "Design-Airbnb / Boutique-Hotel-Look mit Westwing und Designleuchten"),
    3: ("Konzept 3 · Stone · Petrol · Salbei", "Gedeckte Basis + Statement-Pieces: Westwing, Tylko, Designleuchten"),
    4: ("Konzept 4 · Ivory · Petrol · Messing", "Designer-Look aus Westwing, Tylko, IKEA, JYSK + Messing-Designleuchten"),
}


def slot(color, material):
    return {"color": color, "material": material}


def room_of(x, y):
    from_pts = None
    for r in APT["rooms"]:
        if point_in_poly(x, y, r["polygon"]):
            return r["id"]
    return from_pts


def point_in_poly(x, y, poly):
    inside = False
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]; x2, y2 = poly[(i + 1) % n]
        if (y1 > y) != (y2 > y):
            xi = x1 + (y - y1) * (x2 - x1) / (y2 - y1)
            if xi > x:
                inside = not inside
    return inside


def wall_edge(room_id, x, y):
    """Index der Raumkante, die dem Punkt am nächsten liegt."""
    r = next(r for r in APT["rooms"] if r["id"] == room_id)
    best = None
    P = r["polygon"]
    for i in range(len(P)):
        ax, ay = P[i]; bx, by = P[(i + 1) % len(P)]
        dx, dy = bx - ax, by - ay
        L2 = dx * dx + dy * dy
        t = max(0, min(1, ((x - ax) * dx + (y - ay) * dy) / L2))
        d = math.hypot(ax + t * dx - x, ay + t * dy - y)
        if best is None or d < best[0]:
            best = (d, i)
    return best[1]


def along(x, y, ang_deg, dist):
    a = math.radians(ang_deg)
    return (x + math.cos(a) * dist, y + math.sin(a) * dist)


def face_toward(x, y, tx, ty):
    """Rotation, bei der die Vorderseite von (x,y) zum Ziel (tx,ty) zeigt."""
    fx, fy = tx - x, ty - y
    return round(math.degrees(math.atan2(-fx, fy)) % 360, 2)


# ------------------------------------------------------------------ Formen der Pläne
SHAPES = {n: json.loads((OUT / f"shapes_{n}.json").read_text())["shapes"] for n in (1, 2, 3, 4)}


def snap(n, x, y, w=None, d=None, tol=0.3):
    """Mittelpunkt der Planform in Konzept n nahe (x,y) mit passenden Maßen (Planabweichungen je Konzept)."""
    best = None
    for s in SHAPES[n]:
        if s["fill"] == "ceiling":
            continue
        dist = math.hypot(s["c"][0] - x, s["c"][1] - y)
        if dist > tol:
            continue
        if w is not None and d is not None:
            dm = min(abs(s["L"] - max(w, d)) + abs(s["W"] - min(w, d)), 9)
            if dm > 0.12:
                continue
        else:
            dm = 0
        score = dist + dm
        if best is None or score < best[0]:
            best = (score, s)
    return (best[1]["c"][0], best[1]["c"][1], best[1]) if best else (x, y, None)


# ------------------------------------------------------------------ Produkte
PRODUCTS = {n: json.loads((OUT / f"concept_products_{n}.json").read_text()) for n in (1, 2, 3, 4)}
VENDORS = {"Westwing", "IKEA", "JYSK", "Designhandel", "Tylko", "OBI", "Fachhandel"}


def prod(n, pos):
    for p in PRODUCTS[n]:
        if p["pos"] == pos:
            return p
    return None


def vendor_of(p):
    v = (p.get("vendor") or "").strip()
    for k in VENDORS:
        if k in v:
            return k
    return "Fachhandel"


def part(n, pos, qty=None):
    p = prod(n, pos)
    if not p:
        raise KeyError(f"Konzept {n}: Position {pos} fehlt")
    q = qty if qty is not None else (p["qty"] or 1)
    unit = p["unit"] if p["unit"] is not None else (p["total"] or 0) / max(p["qty"] or 1, 1)
    return {"pos": pos, "name": p["name"], "variant": p["variant"], "vendor": vendor_of(p), "qty": q,
            "unit": round(unit, 2), "url": p["url"], "dims": p["dims"], "delivery": p["delivery"]}


CATALOG = {}
# Hauptkatalog (build_catalog.py): Produkte, die nicht aus den Konzept-PDFs stammen (z. B. Essplatz seit v2.0.1)
MAIN_CATALOG = {e["id"]: e for e in json.loads((DATA / "catalog.json").read_text())}


def cat_id(name, vendor):
    base = re.sub(r"[^a-z0-9]+", "-", name.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss").replace("å", "a"))[:48].strip("-")
    return f"{vendor.lower()[:3]}-{base}"


def register(n, pos, category, arch, w, d, h, mount, slots, params=None, elev=None, extra_tags=()):
    """Katalogeintrag (zusammengeführt über die Konzepte) anlegen bzw. Variante ergänzen."""
    p = prod(n, pos)
    vendor = vendor_of(p)
    cid = cat_id(p["name"], vendor)
    var_name = p["variant"] or "Standard"
    e = CATALOG.get(cid)
    if e is None:
        e = CATALOG[cid] = {
            "id": cid, "vendor": vendor, "name": p["name"], "category": category,
            "w": round(w * 100, 1), "d": round(d * 100, 1), "h": round(h * 100, 1),
            "price": p["unit"] if p["unit"] is not None else p["total"], "url": p["url"],
            "archetype": arch, "params": params or {}, "mount": mount, "variants": [],
            "tags": ["Konzept"] + list(extra_tags), "premium": vendor in ("Westwing", "Designhandel", "Tylko"),
            "delivery": p["delivery"], "description": p["note"], "concepts": [],
        }
        if elev is not None:
            e["elev"] = elev
    if n not in e["concepts"]:
        e["concepts"].append(n)
    if not any(v["name"] == var_name for v in e["variants"]):
        e["variants"].append({"name": var_name, "slots": slots})
    return cid, var_name


# ------------------------------------------------------------------ Platzierte Objekte
class Builder:
    def __init__(self, n):
        self.n = n
        self.items = []
        self.budget = []
        self.used = set()
        self.walls = {}
        self.rooms = {}
        self.replaced = []

    def add(self, pos, category, arch, place, dims, slots, mount="floor", params=None, parts=None, label=None,
            elev=0.0, price_from=None, opening=None, catalog_pos=None):
        """place: Liste (x, y, rot[, elev]); dims: (w, d, h) in m."""
        n = self.n
        cpos = catalog_pos or pos.split("/")[0].split("–")[0]
        w, d, h = dims
        cid, var = register(n, cpos, category, arch, w, d, h, mount, slots, params, elev if mount != "floor" else None)
        if parts is None:
            parts = [part(n, cpos)]
        for pp in parts:
            self.used.add(pp["pos"])
        k = len(place)
        for i, pl in enumerate(place):
            x, y, rot = pl[0], pl[1], pl[2]
            el = pl[3] if len(pl) > 3 else elev
            # Stückliste nur beim ersten Exemplar, wenn die Menge die Anzahl der Exemplare übersteigt
            if k > 1:
                ip = [dict(pp, qty=pp["qty"] / k) for pp in parts]
            else:
                ip = parts
            self.items.append({
                "id": hashlib.md5(f"{n}-{pos}-{i}".encode()).hexdigest()[:10],
                "catalogId": cid, "pos": pos, "label": label or prod(n, cpos)["name"],
                "x": round(x, 4), "y": round(y, 4), "rot": round(rot % 360, 2), "elev": round(el, 3),
                "w": round(w, 3), "d": round(d, 3), "h": round(h, 3), "variant": var,
                "slots": slots, "params": params or {}, "mount": mount, "room": room_of(x, y),
                "parts": ip, **({"opening": opening} if opening else {}),
            })

    def add_cat(self, pos, cid, variant, place, slots=None, dims=None, params=None, label=None):
        """Produkt aus dem Hauptkatalog platzieren (je Exemplar eine Stückliste mit Menge 1)."""
        n = self.n
        src = MAIN_CATALOG[cid]
        v = next(v for v in src["variants"] if v["name"] == variant)
        w, d, h = dims or (src["w"] / 100, src["d"] / 100, src["h"] / 100)
        slots = slots or v["slots"]
        params = {**src.get("params", {}), **(params or {})}
        e = CATALOG.get(cid)
        if e is None:
            e = CATALOG[cid] = json.loads(json.dumps(src))
            e["concepts"] = []
        if n not in e["concepts"]:
            e["concepts"].append(n)
        pp = {"pos": pos, "name": src["name"], "variant": variant, "vendor": src["vendor"], "qty": 1,
              "unit": round(v.get("price", src["price"]), 2), "url": v.get("url", src.get("url")),
              "dims": f"B {w * 100:g} × T {d * 100:g} × H {h * 100:g}", "delivery": src.get("delivery")}
        for i, pl in enumerate(place):
            x, y, rot = pl[0], pl[1], pl[2]
            el = pl[3] if len(pl) > 3 else 0.0
            self.items.append({
                "id": hashlib.md5(f"{n}-{pos}-{cid}-{i}".encode()).hexdigest()[:10],
                "catalogId": cid, "pos": pos, "label": label or src["name"],
                "x": round(x, 4), "y": round(y, 4), "rot": round(rot % 360, 2), "elev": round(el, 3),
                "w": round(w, 3), "d": round(d, 3), "h": round(h, 3), "variant": variant,
                "slots": slots, "params": params, "mount": src.get("mount", "floor"), "room": room_of(x, y),
                "parts": [dict(pp)],
            })

    def retire(self, pos, category, arch, dims, slots, params=None, mount="floor"):
        """PDF-Position, die im Konzept ersetzt wurde: bleibt Katalogprodukt (gespeicherte Projekte), ohne Konzeptzuordnung."""
        cid, _ = register(self.n, pos, category, arch, *dims, mount, slots, params)
        if self.n in CATALOG[cid]["concepts"]:
            CATALOG[cid]["concepts"].remove(self.n)
        self.used.add(pos)
        self.replaced.append(pos)

    def line(self, pos, room=None, category="Zubehör"):
        p = prod(self.n, pos)
        if p is None:
            return
        self.used.add(pos)
        self.budget.append({
            "id": hashlib.md5(f"{self.n}-b-{pos}".encode()).hexdigest()[:10], "pos": pos,
            "room": room or p["room"], "name": p["name"], "variant": p["variant"], "vendor": vendor_of(p),
            "qty": p["qty"] or 1, "unit": p["unit"] if p["unit"] is not None else p["total"],
            "url": p["url"], "note": p["note"], "category": category,
        })

    def existing(self, label, category, arch, x, y, rot, dims, slots, mount="floor", params=None, elev=0.0, cid=None, built_in=False, description=None):
        cid = cid or "bestand-" + re.sub(r"[^a-z0-9]+", "-", label.lower())[:40]
        if cid not in CATALOG:
            CATALOG[cid] = {"id": cid, "vendor": "Bestand", "name": label, "category": category,
                            "w": round(dims[0] * 100, 1), "d": round(dims[1] * 100, 1), "h": round(dims[2] * 100, 1),
                            "price": 0, "archetype": arch, "params": params or {}, "mount": mount,
                            "variants": [{"name": "Bestand", "slots": slots}], "tags": ["Bestand"] + (["Einbau"] if built_in else []), "concepts": [],
                            "resizable": False if built_in else None}
            if CATALOG[cid]["resizable"] is None:
                del CATALOG[cid]["resizable"]
            if description:
                CATALOG[cid]["description"] = description
        extra = {"builtIn": True} if built_in else {}
        self.items.append({
            "id": hashlib.md5(f"{self.n}-x-{label}-{x}-{y}".encode()).hexdigest()[:10], "catalogId": cid,
            "label": label, "x": round(x, 4), "y": round(y, 4), "rot": rot, "elev": elev,
            "w": dims[0], "d": dims[1], "h": dims[2], "variant": "Bestand", "slots": slots,
            "params": params or {}, "mount": mount, "room": room_of(x, y), "existing": True, "locked": True, **extra,
        })

    def finish(self):
        missing = [p["pos"] for p in PRODUCTS[self.n] if p["pos"] not in self.used]
        assert not missing, f"Konzept {self.n}: nicht zugeordnet: {missing}"
        total = round(sum(pp["qty"] * pp["unit"] for it in self.items for pp in it.get("parts", [])) +
                      sum(b["qty"] * b["unit"] for b in self.budget), 2)
        return total


def curtain_place(opening_ids, offset=0.09, extra=0.30, track=None):
    """Vorhang an der Raumseite einer oder mehrerer Fensteröffnungen (Deckenschiene)."""
    ops = [o for o in APT["openings"] if o["id"] in opening_ids]
    ax, ay = ops[0]["a"]; bx, by = ops[-1]["b"]
    # Reihenfolge entlang der Wand
    pts = [tuple(o["a"]) for o in ops] + [tuple(o["b"]) for o in ops]
    ux, uy = bx - ax, by - ay
    L = math.hypot(ux, uy); ux, uy = ux / L, uy / L
    ts = [(px - ax) * ux + (py - ay) * uy for px, py in pts]
    t0, t1 = min(ts), max(ts)
    cx, cy = ax + ux * (t0 + t1) / 2, ay + uy * (t0 + t1) / 2
    # Raumseite: Normale, die in einen Innenraum zeigt
    nx, ny = -uy, ux
    rv = ops[0]["reveal"]
    rcx = sum(p[0] for p in rv) / len(rv); rcy = sum(p[1] for p in rv) / len(rv)
    depth = ops[0]["depth"]
    for sgn in (1, -1):
        tx, ty = rcx + nx * sgn * (depth / 2 + 0.3), rcy + ny * sgn * (depth / 2 + 0.3)
        r = room_of(tx, ty)
        if r and not r.startswith("13.08") and not r.startswith("13.09"):
            break
    face_x, face_y = rcx + nx * sgn * depth / 2, rcy + ny * sgn * depth / 2
    # Mittelpunkt der Vorhangschiene auf der Wandoberfläche + Abstand
    px = face_x + (cx - (ax + ux * (t0 + t1) / 2)) + nx * sgn * offset
    py = face_y + (cy - (ay + uy * (t0 + t1) / 2)) + ny * sgn * offset
    # Mitte entlang der Wand korrigieren (rcx liegt in der Mitte der ersten Öffnung)
    mid_first = ((ops[0]["a"][0] + ops[0]["b"][0]) / 2, (ops[0]["a"][1] + ops[0]["b"][1]) / 2)
    shift = (cx - mid_first[0]) * ux + (cy - mid_first[1]) * uy
    px, py = face_x + ux * shift + nx * sgn * offset, face_y + uy * shift + ny * sgn * offset
    width = track if track else (t1 - t0) + extra
    rot = face_toward(px, py, px + nx * sgn, py + ny * sgn)
    return (px, py, rot), width


# ------------------------------------------------------------------ Konzeptdefinitionen
def build(n):
    B = Builder(n)
    k = n
    # ---------- Farb- und Materialtabellen je Konzept
    if k == 1:
        sofa_c = slot("#b9aa97", "boucle"); legs = slot("#1d1d1d", "blackMetal")
        stone = slot("#e3d6c1", "travertine"); dark_oak = slot("#5e4130", "oakDark")
        accent_metal = slot("#b8703e", "copper")
        armchair_c = slot("#a7b59e", "velvet")
    elif k == 2:
        sofa_c = slot("#5d4231", "boucle"); legs = slot("#1d1d1d", "blackMetal")
        stone = slot("#3f5d4e", "marbleGreen"); dark_oak = slot("#4d3626", "oakDark")
        accent_metal = slot("#c6cbd0", "chrome")
        armchair_c = slot("#2f7074", "boucle")
    elif k == 3:
        sofa_c = slot("#cfc6b8", "boucle"); legs = slot("#1d1d1d", "blackMetal")
        stone = slot("#ece5d9", "travertine"); dark_oak = slot("#caa77e", "oak")
        accent_metal = slot("#c6cbd0", "chrome")
        armchair_c = slot("#2f7074", "boucle")
    else:
        sofa_c = slot("#ddd6c8", "cord"); legs = slot("#1d1d1d", "blackMetal")
        stone = slot("#e8ddcb", "travertine"); dark_oak = slot("#caa77e", "oak")
        accent_metal = slot("#c9a55c", "brass")
        armchair_c = slot("#2f7074", "boucle")
    opal = slot("#f6f4ee", "opal")

    # ================= WOHNEN =================
    if k == 2:
        x, y, _ = snap(k, 4.27, 6.95)
        B.add("W1", "sofa", "sofa", [(x, y, N)], (2.28, 1.04, 0.80), {"main": sofa_c, "legs": legs},
              params={"seats": 3, "armWidth": 0.2, "armHeight": 0.61, "seatHeight": 0.40, "backHeight": 0.80, "style": "tribeca"})
    else:
        x, y, _ = snap(k, 4.306, 7.026)
        B.add("W1", "sofa", "sofaModular", [(x, y, N)], (2.38, 1.19, 0.68), {"main": sofa_c, "legs": legs},
              params={"modules": 2, "armWidth": 0.32, "armHeight": 0.25, "seatHeight": 0.43, "backDepth": 0.25})
    # Couchtisch
    if k == 1:
        B.add("W2", "coffeeTable", "coffeeDuo", [(4.585, 5.636, S)], (1.35, 0.88, 0.35), {"main": stone},
              params={"a_w": 0.80, "a_d": 0.70, "a_h": 0.35, "b_w": 0.70, "b_d": 0.53, "b_h": 0.23,
                      "a_x": -0.352, "a_y": 0.04, "b_x": 0.352, "b_y": -0.04, "b_rot": 90})
    elif k == 2:
        x, y, _ = snap(k, 4.44, 5.69)
        B.add("W2", "coffeeTable", "tableOval", [(x, y, S)], (1.17, 0.70, 0.30), {"top": slot("#7e5638", "burl"), "legs": slot("#5a3b26", "burl")},
              params={"base": "panel", "organic": True})
    elif k == 3:
        x, y, _ = snap(k, 4.48, 5.77)
        B.add("W2", "coffeeTable", "coffeeBlock", [(x, y, S)], (1.00, 0.55, 0.35), {"main": stone}, params={"twoLevel": True})
    else:
        x, y, _ = snap(k, 4.48, 5.79)
        B.add("W2", "coffeeTable", "coffeeBlock", [(x, y, S)], (1.00, 0.50, 0.35), {"main": stone}, params={"plinth": True})
    # Lowboard
    if k == 1:
        B.add("W3", "lowboard", "lowboard", [(4.661, 4.501, S)], (1.75, 0.43, 0.55), {"main": dark_oak, "legs": dark_oak},
              params={"doors": 3, "legHeight": 0.15, "front": "flat"})
    elif k == 2:
        x, y, _ = snap(k, 4.61, 4.50)
        B.add("W3", "lowboard", "lowboard", [(x, y, S)], (1.80, 0.45, 0.50), {"main": dark_oak, "legs": legs},
              params={"doors": 3, "legHeight": 0.10, "front": "ribbed"})
    else:
        B.add("W3", "lowboard", "lowboard", [(4.66, 4.51, S)], (1.80, 0.45, 0.55), {"main": slot("#c9a477", "oak"), "legs": slot("#c9a477", "oak")},
              params={"doors": 2, "drawers": 1, "legHeight": 0.15, "front": "flat"})
    lb_h = 0.50 if k == 2 else 0.55
    # TV (nicht im Budget, Bestand des Nutzers) – Bildmitte über dem Lowboard
    B.existing("TV 65″ (vorhanden)", "media", "tv", 4.69, 4.30, S, (1.45, 0.04, 0.83), {"main": slot("#111111", "gloss")}, mount="wall", elev=1.02)
    # Sessel
    ax, ay, _ = snap(k, 5.90, 5.86)
    B.add("W4", "armchair", "armchairRound", [(ax, ay, W)], (0.97, 0.90, 0.72), {"main": armchair_c, "legs": legs},
          params={"seatHeight": 0.44})
    # Beistelltisch
    if k == 1:
        B.add("W5", "sideTable", "sideRound", [(5.995, 5.138, 0)], (0.35, 0.35, 0.50), {"main": stone}, params={"style": "column"})
    elif k == 2:
        B.add("W5", "sideTable", "sideRound", [(5.97, 5.13, 0)], (0.35, 0.35, 0.45), {"main": slot("#c6cbd0", "chrome")}, params={"style": "drum"})
    elif k == 3:
        B.add("W5", "sideTable", "sideContainer", [(5.93, 5.13, 0)], (0.42, 0.42, 0.62), {"main": slot("#2f7074", "gloss")}, params={"tiers": 2})
    else:
        B.add("W5", "sideTable", "sideRound", [(5.93, 5.13, 0)], (0.35, 0.35, 0.50), {"main": stone}, params={"style": "column"})
    # Stehleuchte
    if k == 1:
        B.add("W6", "floorLamp", "lampFloorShade", [(5.829, 6.609, 0)], (0.43, 0.43, 1.83),
              {"main": accent_metal, "shade": opal}, params={"shape": "mushroom"})
    elif k in (2, 3):
        B.add("W6", "floorLamp", "lampFloorShade", [(5.79, 6.58, 0)], (0.36, 0.36, 1.48),
              {"main": accent_metal, "shade": accent_metal}, params={"shape": "cone"})
    else:
        B.add("W6", "floorLamp", "lampFloorGlobe", [(5.79, 6.58, 0)], (0.275, 0.275, 1.35),
              {"main": accent_metal, "shade": opal}, params={"globe": 0.20})
    # Deckenleuchte Wohnen (DA 5,20 / 6,59)
    if k == 1:
        B.add("W7", "ceilingLamp", "ceilingDome", [(5.199, 6.591, 0, CEIL - 0.15)], (0.40, 0.40, 0.15),
              {"main": opal, "frame": slot("#c0c0c0", "chrome")}, mount="ceiling", params={"organic": True})
    else:
        B.add("W7", "pendant", "pendantGlobe", [(5.199, 6.591, 0, 2.10)], (0.45, 0.45, 0.36),
              {"main": opal, "frame": slot("#ffffff", "matte")}, mount="ceiling")
    # Teppich
    rug_c = {1: slot("#dcd6cb", "wool"), 2: slot("#d6c2a4", "wool"), 3: slot("#e4e2dd", "wool"), 4: slot("#f0ebe1", "wool")}[k]
    rug_p = {1: {"pattern": "braided"}, 2: {"pattern": "relief", "color2": "#a9583a"}, 3: {"pattern": "plain"}, 4: {"pattern": "relief"}}[k]
    B.add("W8", "rug", "rugRect", [(4.868, 6.191, S)], (3.00, 2.00, 0.015), {"main": rug_c}, params=rug_p)
    # Kissen auf dem Sofa (4 Stück, Farben aus dem Plan)
    cush = [(3.663, 7.218, N - 6), (4.099, 7.279, N + 4), (4.911, 7.394, N - 4), (5.267, 7.444, N + 7)]
    if k == 2:
        cush = [(3.63 + 0.0, 7.09 + 0.0, N - 6), (4.07, 7.15, N + 4), (4.82, 7.26, N - 4), (5.23, 7.32, N + 7)]
    seat_h = 0.40 if k == 2 else 0.43
    cush = [(cx, cy, r, seat_h + 0.02) for cx, cy, r in cush]
    if k == 1:
        B.add("W9", "textile", "cushion", cush, (0.50, 0.16, 0.50), {"main": slot("#a7b59e", "linen")},
              parts=[part(1, "W9"), part(1, "W10")], label="Kissen DYTÅG graugrün")
    else:
        w9c = {2: slot("#a8573a", "linen"), 3: slot("#2f7074", "velvet"), 4: slot("#2f7074", "velvet")}[k]
        w23c = {2: slot("#6e232f", "velvet"), 3: slot("#9caf95", "velvet"), 4: slot("#f4efe4", "boucle")}[k]
        B.add("W9", "textile", "cushion", [cush[0], cush[3]], (0.50, 0.16, 0.50), {"main": w9c}, parts=[part(k, "W9")])
        B.add("W23", "textile", "cushion", [cush[1], cush[2]], (0.48 if k == 4 else 0.50, 0.16, 0.48 if k == 4 else 0.50), {"main": w23c}, parts=[part(k, "W23")])
        B.line("W10", category="Textil")
    # Plaid
    if k == 1:
        B.add("W11", "textile", "throw", [(3.773, 6.724, N, seat_h)], (0.46, 0.66, 0.06), {"main": slot("#c8d3c1", "wool")}, params={"pattern": "zigzag"})
    elif k == 2:
        B.add("W11", "textile", "throw", [(3.72, 6.70, N, seat_h)], (0.46, 0.62, 0.06), {"main": slot("#7b3b34", "wool")}, params={"fringe": True})
    elif k == 3:
        B.add("W11", "textile", "throw", [(3.773, 6.724, N, seat_h)], (0.46, 0.66, 0.06), {"main": slot("#c8d3c1", "wool")}, params={"pattern": "zigzag"})
    else:
        B.add("W11", "textile", "throw", [(3.32, 6.69, N, 0.5)], (0.30, 0.62, 0.30), {"main": slot("#f6f2e9", "wool")}, params={"draped": True})
    # Vorhänge Wohnen: Balkonfenster, Ost 1, Ost 2
    cur_c = {1: (slot("#f7f4ec", "linen"), None), 2: (slot("#e5dccb", "linen"), None), 3: (slot("#e5dccb", "linen"), None),
             4: (slot("#f4f0e7", "linen"), None)}[k]
    for i, (oid, trk) in enumerate([("W-B1L", 2.25), ("W-O1", 2.53), ("W-O2", 2.11)]):
        pl, wdt = curtain_place([oid], track=trk)
        parts = [part(k, "W13", 1), part(k, "W14", 2), part(k, "W15", 2)]
        B.add(f"W13–W15", "curtain", "curtain", [(pl[0], pl[1], pl[2], 0.0)], (wdt, 0.12, CEIL - 0.03), {"main": cur_c[0]},
              mount="ceiling", params={"layers": 1, "open": 0.85, "track": True, "sheer": True},
              parts=parts, opening=oid, label=f"Vorhang {['Balkonfenster', 'Ostfenster 1', 'Ostfenster 2'][i]}", catalog_pos="W13")
        B.items[-1]["id"] += str(i)
    # Tischleuchte Lowboard
    if k == 1:
        B.add("W17", "tableLamp", "lampTableMushroom", [(4.042, 4.414, 0, lb_h)], (0.30, 0.30, 0.35), {"main": accent_metal, "shade": opal})
    elif k == 2:
        B.add("W17", "tableLamp", "lampTableMushroom", [(3.94, 4.40, 0, lb_h)], (0.16, 0.16, 0.238),
              {"main": accent_metal, "shade": slot("#8a6a4f", "gloss")}, params={"shape": "panthella"})
    elif k == 3:
        B.add("W17", "tableLamp", "lampTableMushroom", [(3.99, 4.41, 0, lb_h)], (0.16, 0.16, 0.295), {"main": accent_metal, "shade": accent_metal}, params={"shape": "flowerpot"})
    else:
        B.add("W17", "tableLamp", "lampTableMushroom", [(3.99, 4.41, 0, lb_h)], (0.15, 0.15, 0.30), {"main": accent_metal, "shade": accent_metal}, params={"shape": "cone"})
    # Lamellenwand (Nordwand, raumhoch)
    lam = {1: slot("#c9a273", "oak"), 2: slot("#6b4a33", "walnut"), 3: slot("#c9a273", "oak"), 4: slot("#c9a273", "oak")}[k]
    B.add("W18", "wallPanel", "lamella", [(4.695, 4.258, S, 0.0)], (2.40, 0.021, CEIL), {"main": lam, "secondary": slot("#141414", "fabric")},
          mount="wall", params={"slat": 0.027, "gap": 0.0135})
    # Bild Westwand
    art = {1: ("#d8cdbc", "#8f8576", "#b38c60", "scenario", (0.92, 1.20)), 2: ("#8a6248", "#3b2a20", "#b38c60", "vibranium", (0.90, 1.20)),
           3: ("#7f9a7a", "#2f5e66", "#e2c7c0", "greenpetite", (0.88, 1.18)), 4: ("#f2efe8", "#22365a", "#c9a273", "blueplay", (0.92, 1.20))}[k]
    wx, wy, _ = snap(k, 3.31, 5.55)
    B.add("W19", "art", "art", [(wx, wy, E, 0.95)], (art[4][0], 0.04, art[4][1]),
          {"main": slot(art[0], "canvas"), "secondary": slot(art[1], "canvas"), "frame": slot(art[2], "oak")},
          mount="wall", params={"motif": art[3]})
    # Großpflanze
    if k == 4:
        B.add("W24", "decor", "plantPot", [(6.10, 4.70, 0)], (0.40, 0.40, 0.59), {"main": slot("#e6dccb", "matte")}, params={"shape": "hourglass"})
        B.add("W20", "plant", "plantTree", [(6.10, 4.70, 0, 0.45)], (0.50, 0.50, 1.80), {"main": slot("#4f6b3a", "plant"), "secondary": slot("#e6dccb", "matte")},
              params={"species": "moneytree", "pot": False})
    else:
        pot = {1: "#d9ccb4", 2: "#4a3628", 3: "#b8b1a6"}[k]
        B.add("W20", "plant", "plantTree", [(6.097, 4.697, 0)], (0.48, 0.48, 1.70), {"main": slot("#5b6e45", "plant"), "secondary": slot(pot, "ceramic")},
              params={"species": "olive", "pot": True, "potD": 0.32, "potH": 0.36})
    # Vitrine/Regal hinter dem Sofa
    if k == 1:
        B.add("W21", "cabinet", "vitrine", [(3.516, 8.441, N)], (0.85, 0.40, 1.70), {"main": slot("#a7b59e", "matte"), "secondary": slot("#e8efe8", "ribbedGlass")},
              params={"shelves": 4, "legHeight": 0.10})
    elif k == 2:
        B.add("W21", "cabinet", "vitrine", [(3.51, 8.44, N)], (0.90, 0.40, 1.80), {"main": dark_oak, "secondary": slot("#d8dcd8", "glass")}, params={"shelves": 4, "legHeight": 0.12})
    else:
        tc = slot("#93a88e", "matte") if k == 3 else slot("#e8dfcf", "matte")
        B.add("W21", "shelf", "shelfOpen", [(3.52, 8.44, N)], (0.85, 0.40, 1.70), {"main": tc}, params={"rows": 5, "cols": 2, "doorsBottom": 2, "style": "tylko"})
    # Pflege/Wandfarbe als Budgetpositionen
    B.line("W22", category="Wand & Oberfläche" if k != 1 else "Pflege")
    if k == 2:
        B.line("W24", category="Wand & Oberfläche")
    if k == 4:
        B.add("W25", "decor", "tray", [(4.36, 5.80, S + 10, 0.35)], (0.30, 0.30, 0.04), {"main": slot("#e3d6c1", "marble")})
        B.add("W28", "decor", "candles", [(4.33, 5.77, 0, 0.39), (4.41, 5.84, 0, 0.39)], (0.08, 0.08, 0.17), {"main": slot("#c9a55c", "brass")})
        B.add("W27", "decor", "bowl", [(4.66, 5.84, S, 0.35 + 0.07)], (0.35, 0.30, 0.10), {"main": slot("#d9cdb8", "marble")})
        B.add("W29", "decor", "books", [(4.66, 5.84, S + 3, 0.35)], (0.34, 0.26, 0.07), {"main": slot("#ece6da", "paper"), "secondary": slot("#d6cbb7", "paper")}, params={"count": 2, "lying": True})
        B.add("W26", "decor", "vase", [(5.40, 4.61, 0, lb_h)], (0.25, 0.25, 0.32), {"main": slot("#ece3d2", "ceramic")}, params={"branches": True})

    # ================= ESSEN =================
    # Seit v2.0.1: rechteckiger Esstisch für 6 Personen, Längsachse im Plan von oben nach unten (parallel zur Ostfensterwand),
    # je 3 Stühle an den Längsseiten, Teppich mit ≥ 60 cm Überstand an den Stuhlseiten, lineare Pendelleuchte > 50 % der Tischlänge.
    # Die runden Tische, Stühle, Pendelleuchten und Teppiche der Konzept-PDFs bleiben Katalogprodukte.
    if k in (1, 4):
        B.retire("E1", "diningTable", "tablePedestal", (1.20, 1.20, 0.75), {"top": slot("#e7ddd0", "marble"), "legs": slot("#3e2c22", "mango")},
                 params={"round": True, "footD": 0.61, "base": "column"})
    else:
        tc = slot("#3f5d4e", "marbleGreen") if k == 2 else slot("#e9e0d2", "marble")
        B.retire("E1", "diningTable", "tablePedestal", (1.20, 1.20, 0.76), {"top": tc, "legs": slot("#b9b4aa", "steel")},
                 params={"round": True, "footD": 0.55, "base": "cone"})
    if k == 2:
        old_cs = {"main": slot("#6b4429", "leather"), "legs": slot("#c6cbd0", "chrome")}
        B.retire("E2", "chair", "cantilever", (0.50, 0.53, 0.81), old_cs, params={"seatHeight": 0.46})
        B.retire("E12", "chair", "cantilever", (0.50, 0.53, 0.81), old_cs, params={"seatHeight": 0.46})
    else:
        old_cs = {1: {"main": slot("#a7b59e", "boucle"), "legs": slot("#a37a52", "oak")},
                  3: {"main": slot("#a3b39a", "boucle"), "legs": slot("#a37a52", "oak")},
                  4: {"main": slot("#efebe1", "fabric"), "legs": slot("#c9a477", "oak")}}[k]
        B.retire("E2", "chair", "diningArmchair", (0.58, 0.54, 0.80), old_cs, params={"seatHeight": 0.48, "armHeight": 0.70})
        B.retire("E12", "chair", "diningArmchair", (0.58, 0.54, 0.80), old_cs, params={"seatHeight": 0.48, "armHeight": 0.70})
    if k == 1:
        B.retire("E3", "pendant", "pendantGlobe", (0.16, 0.16, 0.26), {"main": slot("#b8703e", "copper"), "shade": opal}, mount="ceiling",
                 params={"shape": "kushi", "anchorX": 5.909, "anchorY": 9.374})
    elif k in (2, 3):
        B.retire("E3", "pendant", "pendantMirrorBall", (0.40, 0.40, 0.40), {"main": slot("#d9dde0", "chrome")}, mount="ceiling")
    else:
        B.retire("E3", "pendant", "pendantDome", (0.47, 0.47, 0.235), {"main": slot("#c9a55c", "brass")}, mount="ceiling", params={"shape": "semi"})
    rc = {1: slot("#cbbfae", "wool"), 2: slot("#b8653f", "wool"), 3: slot("#e8e0d2", "wool"), 4: slot("#f0ebe1", "wool")}[k]
    B.retire("E9", "rug", "rugRound", (2.50, 2.50, 0.012), {"main": rc},
             params={"pattern": "rings" if k in (1, 4) else ("relief" if k == 2 else "plain"), **({"color2": "#efe5d6"} if k == 2 else {})})

    # Essplatz im Flügel-Koordinatensystem (u nach Osten, v nach Süden): zwischen Sofarücken (v 6,95) und Sideboardfront (v 10,53;
    # ≥ 80 cm Bewegungsfläche vor dem Sideboard),
    # Westseite = Laufweg zu Küche und Schlafzimmer (mehr Abstand), Ostseite = Fensterwand (u 9,04).
    def wing(u, v):
        a = math.radians(S)
        return (u * math.cos(a) - v * math.sin(a), u * math.sin(a) + v * math.cos(a))
    TU, TV = 7.35, 8.70
    tx, ty = wing(TU, TV)
    # Seit 2.0.3: dunkle Stein-/Keramiktische (kein Holz), Stühle mit Metallgestell, Pendelleuchte ≥ 75 % der Tischlänge
    dining = {
        1: dict(table=("hoe-juka-50309767", "Steinplatte Schwarz, Schrägsäule Metall bronzefarben", None),
                chair=("wes-boucle-armlehnstuhl-adrien-159664", "Bouclé Olivgrün, Schwarz"),
                lamp=("lam-paul-neuhaus-pure-e-popup-pendelleuchte-2558-97", "Bronze / Weiß", None),
                rug=("ike-80593762", "Grün / weiß / schwarz handgewebt")),
        2: dict(table=("hoe-giovanni-40305478", "Keramik Grau, Design-Gestell Edelstahl gebürstet", None),
                chair=("wes-leder-stuhl-jordan-172068", "Leder Braun, Silberfarben glänzend"),
                lamp=("lam-hollaender-suopare-pendelleuchte-300-k-16111-s", "Silber", None),
                rug=("ike-80593762", "Grau / weiß / schwarz handgewebt")),
        3: dict(table=("hoe-talia-50304622", "Steinplatte Grau, Gestell Metall Schwarz", None),
                chair=("wes-polsterstuhl-tess-166841", "Webstoff Off White, Schwarz matt"),
                lamp=("lam-paul-neuhaus-rika-pendelleuchte-2115-18", "Schwarz / Rauchfarben", None),
                rug=("ike-00640673", "Beige")),
        4: dict(table=("boc-alicante-3700128t0850a07", "Keramik aschgrau, Steinoptik, Gestell matter aschgrauer Strukturlack", None),
                chair=("wes-polsterstuhl-tess-166841", "Samt Hellbeige, Goldfarben matt"),
                lamp=("lam-paul-neuhaus-adriana-pendelleuchte-2568-24", "Messing", None),
                rug=("ike-00640673", "Elfenbeinweiß")),
    }[k]
    t_id, t_var, t_slots = dining["table"]
    tbl = MAIN_CATALOG[t_id]
    TL, TD = tbl["w"] / 100, tbl["d"] / 100
    # Tisch: Länge (w) entlang v → Rotation W (98°)
    B.add_cat("E1", t_id, t_var, [(tx, ty, W)], slots=t_slots)
    # 6 Stühle, je 3 an den Längsseiten (Westseite Front nach Osten, Ostseite Front nach Westen), Sitz 12 cm unter der Tischkante
    c_id, c_var = dining["chair"]
    ch = MAIN_CATALOG[c_id]
    off = TD / 2 + ch["d"] / 200 - 0.12
    pitch = 0.65 if TL >= 1.95 else 0.60
    seats = [wing(TU - off, TV + s) + (E,) for s in (-pitch, 0, pitch)] + [wing(TU + off, TV + s) + (W,) for s in (-pitch, 0, pitch)]
    B.add_cat("E2", c_id, c_var, seats)
    # Nischenplatz am Ostfenster: gleiches Stuhlmodell
    B.add_cat("E12", c_id, c_var, [(7.513, 7.34, S)], label=f"{ch['name']} (Nischenplatz)")
    # Lineare Pendelleuchte mittig über dem Tisch, parallel zur Längsachse, Unterkante 65 cm über der Tischplatte
    l_id, l_var, l_slots = dining["lamp"]
    lamp = MAIN_CATALOG[l_id]
    assert 0.75 * tbl["w"] <= lamp["w"] <= tbl["w"], f"Konzept {k}: Pendelleuchte {lamp['w']} cm nicht 75–100 % der Tischlänge {tbl['w']} cm"
    B.add_cat("E3", l_id, l_var, [(tx, ty, W, round(tbl["h"] / 100 + 0.65, 2))], slots=l_slots)
    # Teppich: lange Seite entlang v, Überstand an den Stuhlseiten ≥ 60 cm (Stühle bleiben zurückgeschoben auf dem Teppich)
    r_id, r_var = dining["rug"]
    rug = MAIN_CATALOG[r_id]
    rw, rd = sorted((rug["w"], rug["d"]))
    assert (rw - tbl["d"]) / 2 >= 60 and rd > tbl["w"], f"Konzept {k}: Teppich {rw}×{rd} zu klein für Tisch {tbl['w']}×{tbl['d']}"
    B.add_cat("E9", r_id, r_var, [(tx, ty, S)], dims=(rw / 100, rd / 100, rug["h"] / 100))
    # Sideboard
    if k == 1:
        B.add("E4", "sideboard", "sideboard", [(5.688, 11.668, N)], (1.65, 0.43, 0.75), {"main": dark_oak, "legs": dark_oak},
              params={"doors": 3, "legHeight": 0.10, "front": "flat"})
    else:
        sbc = {2: (dark_oak, slot("#c6cbd0", "chrome")), 3: (slot("#c9a477", "oak"), slot("#b9b4aa", "steel")), 4: (slot("#c9a477", "oak"), slot("#c9a55c", "brass"))}[k]
        B.add("E4", "sideboard", "sideboard", [(5.69, 11.66, N)], (1.60, 0.45, 0.75), {"main": sbc[0], "legs": sbc[0], "detail": sbc[1]},
              params={"doors": 4, "legHeight": 0.17, "front": "ribbed"})
    sb_h = 0.75
    # Wandleuchte Ostpfeiler
    if k == 1:
        B.add("E5", "wallLamp", "wallSconce", [(7.66, 9.838, W, 1.70)], (0.28, 0.13, 0.21), {"main": accent_metal}, mount="wall", params={"shape": "mabell"})
    else:
        B.add("E5", "wallLamp", "wallGlobe", [(7.66, 9.838, W, 1.70)], (0.20, 0.28 if k != 4 else 0.25, 0.20), {"main": accent_metal, "shade": opal}, mount="wall")
    # Tischleuchte Sideboard
    if k == 1:
        B.add("E6", "tableLamp", "lampTableLayered", [(5.168, 11.595, 0, sb_h)], (0.33, 0.33, 0.45), {"main": slot("#b8703e", "copper"), "shade": opal})
    else:
        B.add("E6", "tableLamp", "lampTableGlobe", [(5.22, 11.60, 0, sb_h)], (0.32 if k != 4 else 0.20, 0.32 if k != 4 else 0.20, 0.442),
              {"main": accent_metal, "shade": opal}, params={"globe": 0.20, "ic": True})
    # Bilder über dem Sideboard (Südwand, Unterkante 0,95 bzw. Bildpaar im Profilrahmen)
    ax0, ay0 = 5.657, 11.885
    if k == 1:
        p1 = along(ax0, ay0, S, -0.33); p2 = along(ax0, ay0, S, 0.33)
        B.add("E7", "art", "art", [(p1[0], p1[1], N, 1.085), (p2[0], p2[1], N, 1.085)], (0.53, 0.03, 0.73),
              {"main": slot("#e1d6c4", "canvas"), "secondary": slot("#9b8a74", "canvas"), "frame": slot("#a39484", "matte")},
              mount="wall", params={"motif": "growing", "mat": True})
        B.add("E10–E11", "molding", "molding", [(ax0, ay0 + 0.005, N, 0.95)], (1.40, 0.019, 1.00), {"main": slot(WALL_WHITE, "matte")},
              mount="wall", params={"profile": 0.04}, parts=[part(1, "E10"), part(1, "E11")], catalog_pos="E10", label="Profilrahmen Orac PX120 um das Bildpaar")
        B.add("E8", "decor", "plantPot", [(6.258, 11.748, 0, sb_h)], (0.24, 0.24, 0.26), {"main": slot("#a7b59e", "ceramic")}, params={"plant": True})
    else:
        artE = {2: ("#7b4a32", "#e9e2d6", "#1d1d1d", "rust", (0.90, 1.20)), 3: ("#8fa98c", "#eef0ea", "#151515", "greenlayer", (0.91, 1.21)),
                4: ("#e8dccb", "#c9a55c", "#c8b389", "everlast", (0.90, 1.18))}[k]
        B.add("E7", "art", "art", [(ax0, ay0, N, 0.95)], (artE[4][0], 0.04, artE[4][1]),
              {"main": slot(artE[0], "canvas"), "secondary": slot(artE[1], "canvas"), "frame": slot(artE[2], "matte")}, mount="wall", params={"motif": artE[3]})
    if k == 4:
        B.add("E10", "decor", "bowl", [(tx, ty, S, 0.75)], (0.41, 0.31, 0.24), {"main": slot("#f1ede4", "ceramic")}, params={"footed": True})
        B.add("E11", "decor", "candles", [(x + tx - 5.909, y + ty - 9.374, 0, z) for x, y, z in ((5.70, 9.42, 0.75), (5.74, 9.32, 0.75), (5.72, 9.37, 0.82))], (0.10, 0.10, 0.07), {"main": slot("#c9a55c", "brass")}, params={"stack": True})
        B.add("E13", "decor", "vase", [(5.08, 11.56, 0, sb_h)], (0.32, 0.32, 0.40), {"main": slot("#e6dccb", "ceramic")}, params={"pampas": True})
        B.add("E15", "decor", "books", [(6.25, 11.74, S + 180, sb_h)], (0.23, 0.30, 0.04), {"main": slot("#e9e4d8", "paper"), "secondary": slot("#d1c3a7", "ceramic")}, params={"count": 1, "lying": True, "object": True})

    # ================= DIELE =================
    pax_front = slot("#f3eee3", "lacquer") if k == 1 else slot("#c9a87e", "oak")
    fparts = [part(k, "F1"), part(k, "F2"), part(k, "F3")]
    for pz in ("F4", "F5", "F6", "F17"):
        if prod(k, pz):
            fparts.append(part(k, pz))
    B.add("F1–F6", "wardrobe", "wardrobe", [(9.612, 1.456, E0)], (1.50, 0.37, 2.36), {"main": pax_front, "secondary": slot("#f3f1ec", "matte")},
          params={"modules": "100,50", "doors": 3, "fascia": round(CEIL - 2.36, 3), "fasciaColor": WALL_WHITE if k != 2 else "#e7dccb", "handle": "edge"},
          parts=fparts, catalog_pos="F1", label="PAX/TONSTAD Garderobe 150 × 35 × 236 + Deckenblende")
    # Konsole
    if k in (1, 4):
        B.add("F7", "console", "console", [(7.378, 2.525, S0)], (1.10, 0.40, 0.80), {"top": slot("#e3d6c1", "travertine"), "main": slot("#4b3326", "oakDark")}, params={"style": "chandler"})
    else:
        tc = slot("#3f5d4e", "marbleGreen") if k == 2 else slot("#ece5d9", "marble")
        B.add("F7", "console", "console", [(7.38, 2.52, S0)], (1.20, 0.40, 0.80), {"top": tc, "main": slot("#b9b4aa", "steel")}, params={"style": "noam"})
    # Spiegel
    if k == 1:
        B.add("F8", "mirror", "mirrorRound", [(7.378, 2.34, S0, 1.20)], (0.60, 0.03, 0.60), {"frame": slot("#6b4a33", "walnut")}, mount="wall")
        B.add("F16", "molding", "molding", [(7.378, 2.335, S0, 0.90)], (1.30, 0.019, 1.20), {"main": slot(WALL_WHITE, "matte")}, mount="wall", params={"profile": 0.04})
    elif k in (2, 3):
        B.add("F8", "mirror", "mirrorRound", [(7.38, 2.34, S0, 1.165)], (0.63, 0.03, 0.67), {"frame": slot("#c6cbd0", "chrome")}, mount="wall", params={"rays": True})
    else:
        B.add("F8", "mirror", "mirrorArch", [(7.38, 2.34, S0, 1.045)], (0.60, 0.03, 1.01), {"frame": slot("#c9a55c", "brass")}, mount="wall")
    # Tischleuchte Konsole
    if k == 1:
        B.add("F9", "tableLamp", "lampTableMushroom", [(7.006, 2.526, 0, 0.80)], (0.30, 0.30, 0.35), {"main": accent_metal, "shade": opal})
    elif k in (2, 3):
        B.add("F9", "tableLamp", "lampTableMushroom", [(7.006, 2.526, 0, 0.80)], (0.16, 0.16, 0.295), {"main": accent_metal, "shade": accent_metal}, params={"shape": "flowerpot"})
    else:
        B.add("F9", "tableLamp", "lampTableMushroom", [(7.006, 2.526, 0, 0.80)], (0.16, 0.16, 0.24), {"main": accent_metal, "shade": accent_metal}, params={"shape": "panthella"})
    # Deckenleuchten Diele
    dl = [(10.504, 1.168, 0, CEIL - 0.23), (10.504, 2.979, 0, CEIL - 0.23), (7.138, 2.96, 0, CEIL - 0.23)]
    if k == 1:
        B.add("F10", "ceilingLamp", "ceilingDome", dl, (0.20, 0.20, 0.23), {"main": opal, "frame": slot("#1d1d1d", "blackMetal")}, mount="ceiling", params={"shape": "lido"})
    else:
        B.add("F10", "ceilingLamp", "ceilingDome", [(a, b, c, CEIL - 0.24) for a, b, c, _ in dl], (0.20, 0.20, 0.24), {"main": opal, "frame": slot("#c6cbd0", "chrome")}, mount="ceiling", params={"shape": "vanja"})
    if k == 1:
        B.add("F11", "decor", "plantPot", [(7.766, 2.526, 0, 0.80)], (0.24, 0.24, 0.26), {"main": slot("#a7b59e", "ceramic")}, params={"plant": True})
    if k == 4:
        B.add("F18", "decor", "vase", [(7.75, 2.52, 0, 0.80)], (0.25, 0.25, 0.32), {"main": slot("#ece3d2", "ceramic")}, params={"branches": True, "tray": True})
    # Vorhang Balkontür (Diele)
    pl, wdt = curtain_place(["W-B1"], track=3.45)
    cc = cur_c[0]
    B.add("F12–F14", "curtain", "curtain", [(pl[0], pl[1], pl[2], 0.0)], (wdt, 0.12, CEIL - 0.03), {"main": cc}, mount="ceiling",
          params={"layers": 1, "open": 0.8, "track": True, "sheer": True}, parts=[part(k, "F12"), part(k, "F13"), part(k, "F14")],
          opening="W-B1", catalog_pos="F12", label="Vorhang Fenstertür Balkon 1")
    # Schuhschrank
    if k == 1:
        B.add("F15", "cabinet", "dresser", [(11.041, 0.981, W0)], (0.49, 0.28, 1.35), {"main": slot("#2d2420", "matte")}, params={"flaps": 3, "legHeight": 0.0})
    else:
        B.add("F15", "cabinet", "dresser", [(11.03, 0.99, W0)], (0.56, 0.30, 1.29), {"main": slot("#4d3626", "oakDark"), "legs": slot("#1d1d1d", "blackMetal")}, params={"flaps": 3, "legHeight": 0.12})
    if k != 1 and prod(k, "F16"):
        B.line("F16")

    # ================= SCHLAFEN =================
    bed = {1: (slot("#b9aa97", "boucle"), slot("#c8d3c1", "linen"), slot("#f3efe6", "wool")),
           2: (slot("#6e7450", "cord"), slot("#c89c6b", "linen"), slot("#5b3a2c", "wool")),
           3: (slot("#3f6680", "cord"), slot("#d3dbca", "linen"), slot("#f3efe6", "wool")),
           4: (slot("#efe8dd", "cord"), slot("#fbfbf8", "linen"), slot("#d8ccb8", "wool"))}[k]
    bparts = [part(k, "S1"), part(k, "S3"), part(k, "S13"), part(k, "S14"), part(k, "S15")]
    B.add("S1/S3", "bed", "bed", [(5.964, 14.54, W)], (1.96, 2.22, 1.10), {"main": bed[0], "secondary": bed[1], "accent": bed[2], "legs": slot("#1d1d1d", "blackMetal")},
          params={"mattressW": 1.80, "mattressL": 2.00, "headboard": 1.10, "frameH": 0.35, "storage": True, "duvetSingle": k == 4},
          parts=bparts, catalog_pos="S1", label="Polsterbett Dream 180 × 200 + Matratze + Bettwäsche")
    ns = {1: ((7.00, 13.408), (6.646, 15.903), (0.45, 0.45, 0.52), slot("#5e3f2c", "walnut"), slot("#e3d6c1", "travertine")),
          2: ((7.00, 13.41), (6.65, 15.90), (0.45, 0.45, 0.58), slot("#3e2c22", "mango"), slot("#c6cbd0", "chrome")),
          3: ((7.02, 13.41), (6.67, 15.91), (0.50, 0.45, 0.55), slot("#c8bfb1", "lacquer"), slot("#b9b4aa", "steel")),
          4: ((7.04, 13.42), (6.69, 15.91), (0.45, 0.40, 0.50), slot("#c9a477", "oak"), slot("#e3d6c1", "travertine"))}[k]
    B.add("S4", "nightstand", "nightstand", [(ns[0][0], ns[0][1], W), (ns[1][0], ns[1][1], W)], ns[2], {"main": ns[3], "top": ns[4], "detail": ns[4]},
          params={"drawers": 2 if k in (3,) else 0, "door": k in (1, 2), "legHeight": 0.07 if k == 1 else 0.12})
    nh = ns[2][2]
    if k == 1:
        B.add("S5", "tableLamp", "lampTableMushroom", [(ns[0][0], ns[0][1], 0, nh), (ns[1][0], ns[1][1], 0, nh)], (0.30, 0.30, 0.35), {"main": accent_metal, "shade": opal})
    elif k in (2, 3):
        B.add("S5", "tableLamp", "lampTableMushroom", [(ns[0][0], ns[0][1], 0, nh), (ns[1][0], ns[1][1], 0, nh)], (0.23, 0.23, 0.50), {"main": accent_metal, "shade": accent_metal}, params={"shape": "flowerpot"})
    else:
        B.add("S5", "tableLamp", "lampTableGlobe", [(ns[0][0], ns[0][1], 0, nh), (ns[1][0], ns[1][1], 0, nh)], (0.176, 0.176, 0.38), {"main": accent_metal, "shade": opal}, params={"globe": 0.20, "ic": True})
    sl = [(5.351, 13.348, 0), (5.044, 15.526, 0)]
    if k == 1:
        B.add("S6", "ceilingLamp", "ceilingDome", [(a, b, c, CEIL - 0.23) for a, b, c in sl], (0.20, 0.20, 0.23), {"main": opal, "frame": slot("#1d1d1d", "blackMetal")}, mount="ceiling", params={"shape": "lido"})
    elif k in (2, 3):
        B.add("S6", "ceilingLamp", "ceilingDome", [(a, b, c, CEIL - 0.24) for a, b, c in sl], (0.20, 0.20, 0.24), {"main": opal, "frame": slot("#c6cbd0", "chrome")}, mount="ceiling", params={"shape": "vanja"})
    else:
        B.add("S6", "ceilingLamp", "ceilingDisc", [(a, b, c, CEIL - 0.18) for a, b, c in sl], (0.45, 0.45, 0.18), {"main": opal, "frame": slot("#c9a55c", "brass")}, mount="ceiling", params={"shape": "svep"})
    sparts = [part(k, "S7"), part(k, "S8"), part(k, "S9")]
    for pz in ("S10", "S11", "S21"):
        if prod(k, pz):
            sparts.append(part(k, pz))
    B.add("S7–S11", "wardrobe", "wardrobe", [(3.632, 14.192, E)], (3.00, 0.60, 2.36), {"main": pax_front, "secondary": slot("#f3f1ec", "matte")},
          params={"modules": "100,100,100", "doors": 6, "fascia": round(CEIL - 2.36, 3), "fasciaColor": "#75604f" if k == 2 else WALL_WHITE, "handle": "edge"},
          parts=sparts, catalog_pos="S7", label="PAX/TONSTAD Kleiderschrank 300 × 58 × 236 + Deckenblende")
    src = {1: slot("#e9e2d6", "wool"), 2: slot("#efe7da", "wool"), 3: slot("#ebe4d8", "wool"), 4: slot("#f0ebe1", "wool")}[k]
    B.add("S12", "rug", "rugRect", [(5.412, 14.463, W)], (3.00, 2.00, 0.015), {"main": src}, params={"pattern": "pebble" if k == 1 else ("relief" if k == 4 else "plain")})
    # Vorhänge Schlafen (2-läufig über beide Fenster)
    pl, wdt = curtain_place(["W-S1", "W-S2"], track=3.72)
    back = {1: slot("#d8ccb4", "linen"), 2: slot("#4a3128", "velvet"), 3: slot("#d8ccb4", "linen"), 4: slot("#d8ccb4", "linen")}[k]
    B.add("S16–S18", "curtain", "curtain", [(pl[0], pl[1], pl[2], 0.0)], (wdt, 0.16, CEIL - 0.03), {"main": cur_c[0], "secondary": back}, mount="ceiling",
          params={"layers": 2, "open": 0.85, "track": True, "sheer": True}, parts=[part(k, "S16"), part(k, "S17"), part(k, "S18")],
          catalog_pos="S16", label="Vorhänge Schlafen (Store + Verdunkelung)", opening="W-S1")
    s19 = {1: slot("#a7b59e", "linen"), 2: slot("#4a3128", "velvet"), 3: slot("#2f7074", "velvet"), 4: slot("#2f7074", "velvet")}[k]
    B.add("S19", "textile", "cushion", [(6.396, 14.288, W - 16, 0.62), (6.309, 14.912, W + 10, 0.62)], (0.50, 0.16, 0.50), {"main": s19})
    if k == 4:
        bx, by = 7.06, 14.30
        B.add("S23", "art", "art", [(bx, by, W, 1.30)], (1.50, 0.04, 1.00), {"main": slot("#f2f0ea", "canvas"), "secondary": slot("#2c4f7a", "canvas"), "frame": slot("#f2f0ea", "canvas")},
              mount="wall", params={"motif": "bluestroke", "noFrame": True})
    for pz in ("S20", "S22"):
        if prod(k, pz):
            B.line(pz, category="Wand & Oberfläche")

    # ================= ARBEIT / GAST =================
    a1 = {1: slot("#d9cbb7", "boucle"), 2: slot("#a5563b", "boucle"), 3: slot("#a3b39a", "boucle"), 4: slot("#d8cab5", "boucle")}[k]
    B.add("A1", "sofa", "sofaBed", [(13.102, 2.82, S0)], (1.80, 1.00, 0.70), {"main": a1, "legs": slot("#1d1d1d", "blackMetal")},
          params={"seats": 2, "armWidth": 0.20, "seatHeight": 0.43})
    if k == 4:
        B.add("A2", "desk", "desk", [(14.457, 3.65, W0)], (1.20, 0.60, 0.75), {"top": slot("#d8bc94", "oak"), "legs": slot("#c9a477", "oak")}, params={"style": "marte"})
        B.add("A3", "officeChair", "officeChair", [(13.762, 3.66, E0)], (0.57, 0.57, 0.80), {"main": slot("#f4f2eb", "boucle"), "legs": slot("#c9a55c", "brass")}, params={"style": "lounge"})
    else:
        B.add("A2", "desk", "deskStanding", [(14.457, 3.65, W0)], (1.20, 0.60, 0.75), {"top": slot("#6b4a33", "walnut"), "legs": slot("#1d1d1d", "blackMetal")})
        B.add("A3", "officeChair", "officeChair", [(13.762, 3.66, E0)], (0.68, 0.68, 1.10), {"main": slot("#d9cdb8", "fabric"), "legs": slot("#f2f2f2", "plastic")}, params={"style": "task"})
    if k in (1, 2):
        B.add("A4", "shelf", "bookcase", [(11.422, 4.28, E0)], (0.80, 0.28, 2.37), {"main": slot("#6b4a33", "walnut")},
              params={"rows": 7, "topper": 0.35}, parts=[part(k, "A4"), part(k, "A11")])
    else:
        tc = slot("#3b5670", "matte") if k == 3 else slot("#2e3f57", "matte")
        B.add("A4", "shelf", "shelfOpen", [(11.44, 4.28, E0)], (0.80, 0.32, 2.50), {"main": tc}, params={"rows": 7, "cols": 1, "doorsBottom": 1, "style": "tylko"})
    B.line("A12", category="Schutz")
    a12 = None
    a6 = {1: ("lampTableMushroom", (0.30, 0.30, 0.35), {"main": accent_metal, "shade": opal}, {}),
          2: ("lampTableMushroom", (0.16, 0.16, 0.295), {"main": accent_metal, "shade": accent_metal}, {"shape": "flowerpot"}),
          3: ("lampTableMushroom", (0.16, 0.16, 0.295), {"main": accent_metal, "shade": accent_metal}, {"shape": "flowerpot"}),
          4: ("lampTableShade", (0.16, 0.16, 0.51), {"main": slot("#1d1d1d", "blackMetal"), "shade": slot("#1d1d1d", "blackMetal"), "detail": slot("#c9a55c", "brass")}, {"shape": "bestlite"})}[k]
    B.add("A6", "tableLamp", a6[0], [(14.522, 3.27, 0, 0.75)], a6[1], a6[2], params=a6[3])
    if k == 1:
        B.add("A7", "ceilingLamp", "ceilingDome", [(13.014, 3.725, 0, CEIL - 0.23)], (0.20, 0.20, 0.23), {"main": opal, "frame": slot("#1d1d1d", "blackMetal")}, mount="ceiling", params={"shape": "lido"})
    else:
        B.add("A7", "ceilingLamp", "ceilingDome", [(13.014, 3.725, 0, CEIL - 0.24)], (0.20, 0.20, 0.24), {"main": opal, "frame": slot("#c6cbd0", "chrome")}, mount="ceiling", params={"shape": "vanja"})
    pl, wdt = curtain_place(["W-A1", "W-A2"], track=3.51)
    B.add("A8/A9", "curtain", "curtain", [(pl[0], pl[1], pl[2], 0.0)], (wdt, 0.12, CEIL - 0.03), {"main": cur_c[0]}, mount="ceiling",
          params={"layers": 1, "open": 0.85, "track": True, "sheer": True}, parts=[part(k, "A8"), part(k, "A9")], catalog_pos="A8",
          label="Vorhänge Arbeit / Gast", opening="W-A1")
    a10 = {1: slot("#a7b59e", "linen"), 2: slot("#a8573a", "linen"), 3: slot("#9caf95", "velvet"), 4: slot("#f4efe4", "boucle")}[k]
    B.add("A10", "textile", "cushion", [(12.742, 2.545, S0 - 5, 0.45), (13.512, 2.545, S0 + 6, 0.45)], (0.50, 0.16, 0.50), {"main": a10})
    for pz in ("A13", "A14", "A15"):
        if prod(k, pz):
            B.line(pz, category="Deko")

    # ================= KOCHEN / HWR =================
    if k == 1:
        B.add("K1", "ceilingLamp", "ceilingDome", [(2.148, 11.662, 0, CEIL - 0.23)], (0.20, 0.20, 0.23), {"main": opal, "frame": slot("#1d1d1d", "blackMetal")}, mount="ceiling", params={"shape": "lido"})
        B.add("H2", "ceilingLamp", "ceilingDome", [(2.468, 9.205, 0, CEIL - 0.23)], (0.20, 0.20, 0.23), {"main": opal, "frame": slot("#1d1d1d", "blackMetal")}, mount="ceiling", params={"shape": "lido"})
    else:
        B.add("K1", "ceilingLamp", "ceilingDisc", [(2.148, 11.662, 0, CEIL - 0.11)], (0.30, 0.30, 0.11), {"main": opal, "frame": slot("#c6cbd0", "chrome")}, mount="ceiling", params={"shape": "gasgrund"})
        B.add("H2", "ceilingLamp", "ceilingDisc", [(2.468, 9.205, 0, CEIL - 0.11)], (0.30, 0.30, 0.11), {"main": opal, "frame": slot("#c6cbd0", "chrome")}, mount="ceiling", params={"shape": "gasgrund"})
    B.add("H1", "shelf", "shelfOpen", [(1.256, 9.215, E), (3.49, 9.705, N)], (0.62, 0.40, 2.01), {"main": slot("#f2f2f0", "matte")}, params={"rows": 5, "cols": 1, "style": "boaxel"})

    # ================= BALKONE =================
    B.add("B1", "outdoor", "outdoorTable", [(1.892, 15.29, 0)], (0.65, 0.65, 0.72), {"main": slot("#a7b59e", "matte")}, params={"round": True})
    B.add("B2", "outdoor", "outdoorChair", [(1.347, 15.214, E), (2.436, 15.367, W)], (0.53, 0.55, 0.79), {"main": slot("#a7b59e", "matte")})
    B.add("B3", "outdoor", "outdoorSofa", [(10.134, 5.006, N0)], (1.52, 0.76, 0.76), {"main": slot("#f2f0eb", "matte"), "secondary": slot("#ded6c6", "fabric")})

    # ================= BESTAND: Einbauküche Alno 2060 (Höffner, Kaufvertrag 3037702), Sanitär mattschwarz, Waschmaschine =================
    # Küchenzeile an der Westwand (3.640 mm): Passstück, Geräte-Hochschrank 60 (Backofen), Wange, Unterschränke 30/80/45/45/30,
    # Wange, Geräte-Hochschrank 60 (Kühl-Gefrier-Kombination), Passstück; Oberschränke 90/50/90 mit Faltlifttüren und LED.
    # Gegenüber an der Ostwand: Sideboard aus 2 × Unterschrank 60 × 35 cm mit Wangen und Natursteinplatte, 763 mm von der Fensterwand.
    kp = next(r for r in APT["rooms"] if r["id"] == "13.02")["polygon"]
    (x1, y1), (x0, y0) = kp[1], kp[0]          # Westwand oben → unten
    L = math.hypot(x0 - x1, y0 - y1)
    ux, uy = (x0 - x1) / L, (y0 - y1) / L
    nx, ny = -uy, ux                              # nach Osten (Raum)
    if nx < 0:
        nx, ny = -nx, -ny
    KD = 0.65
    mx, my = (x0 + x1) / 2 + nx * KD / 2, (y0 + y1) / 2 + ny * KD / 2
    k_slots = {"main": slot("#7a5236", "oakDark"), "secondary": slot("#1c1c1c", "matte"), "top": slot("#e3d7c1", "granite"), "detail": slot("#1b1b1b", "blackMetal")}
    k_desc = ("Alno 2060, Front Walnuss-dunkel UV-Mattlack, Korpus schwarz, Griffleiste schwarz, Sockel 15 cm schwarz; "
              "Arbeitsplatte und Nischenrückwand Naturstein Verde Eucalypto poliert (38 / 20 mm), Arbeitshöhe 96 cm; "
              "AEG-Pyrolyse-Backofen, Induktionskochfeld mit integriertem Dunstabzug 80 cm, Geschirrspüler 45 cm vollintegriert, "
              "Kühl-Gefrier-Kombination 178 cm, Franke Granitspüle Black Matt mit Armatur Lina; Oberschränke mit Faltlifttüren und LED-Unterbauleuchten. "
              "Höffner Taucha, Kaufvertrag 3037702 vom 02.07.2026.")
    B.existing("Einbauküche Alno 2060 Walnuss dunkel (Bestand)", "kitchen", "kitchenAlno", mx, my, E, (round(L, 3), KD, 2.358), k_slots,
               cid="bestand-kueche-alno-2060", built_in=True, description=k_desc)
    (sx0, sy0), (sx1, sy1) = kp[2], kp[3]        # Ostwand oben → unten (Fensterwand unten)
    SL = math.hypot(sx1 - sx0, sy1 - sy0)
    sux, suy = (sx1 - sx0) / SL, (sy1 - sy0) / SL
    snx, sny = suy, -sux                         # nach Westen (Raum)
    if snx > 0:
        snx, sny = -snx, -sny
    s_along = 0.763 + 1.236 / 2                  # Abstand der Mitte von der Fensterwand
    SD = 0.375
    cx, cy = sx1 - sux * s_along + snx * SD / 2, sy1 - suy * s_along + sny * SD / 2
    B.existing("Küchen-Sideboard Alno 2060 mit Natursteinplatte (Bestand)", "kitchen", "kitchenAlnoSide", cx, cy, W, (1.236, SD, 0.968), k_slots,
               cid="bestand-kueche-alno-2060-sideboard", built_in=True,
               description="2 × Unterschrank 60 cm, Tiefe 35 cm, 1 Tür, Wangen Walnuss-dunkel, Natursteinplatte Verde Eucalypto 1.236 × 375 × 38 mm (Höffner, Kaufvertrag 3037702).")
    blk = slot("#1d1d1d", "blackMetal"); cer = slot("#f6f6f4", "ceramic")
    B.existing("Waschmaschine (Bestand)", "appliance", "washer", 11.662, 0.885, S0, (0.60, 0.60, 0.85), {"main": slot("#f4f4f2", "gloss"), "detail": slot("#2a2a2a", "glass")})
    B.existing("Wand-WC Bad (Bestand)", "bath", "toilet", 12.542, 0.86, S0, (0.37, 0.54, 0.40), {"main": cer, "detail": blk}, params={"plate": True})
    B.existing("Badewanne 180 × 80 (Bestand)", "bath", "bathtub", 13.852, 0.736, S0, (1.80, 0.80, 0.58), {"main": cer, "detail": blk})
    B.existing("Waschtisch Bad (Bestand)", "bath", "washbasin", 13.95, 1.95, N0, (0.80, 0.46, 0.85), {"main": cer, "secondary": slot("#d6c5ad", "oak"), "detail": blk}, params={"mirror": True})
    B.existing("Dusche 105 × 90 (Bestand)", "bath", "shower", 7.47, 0.884, S0, (1.05, 0.90, 2.00), {"main": slot("#e8e4dc", "stone"), "detail": blk}, params={"glass": True})
    B.existing("Wand-WC Gäste (Bestand)", "bath", "toilet", 8.75, 0.82, S0, (0.37, 0.54, 0.40), {"main": cer, "detail": blk}, params={"plate": True})
    B.existing("Handwaschbecken Gäste-WC (Bestand)", "bath", "washbasin", 9.08, 1.30, W0, (0.50, 0.30, 0.85), {"main": cer, "detail": blk}, params={"mirror": True, "small": True})

    total = B.finish()
    return B, total


def finishes(n):
    """Raumweise Boden/Decke/Wand + Wandflächen-Überschreibungen je Konzept."""
    floor_parkett = {"kind": "planks", "color": OAK_FLOOR, "angle": 0, "plankLength": 1.90, "plankWidth": 0.19, "productName": "Natureiche-Dielen L 1,90 m (Bestand)"}
    # Bestand: Feinsteinzeug 60 × 60 cm, Farbe „Iron“ (dunkles, leicht warmes Anthrazit), Fuge anthrazit
    tiles = {"kind": "tiles", "color": "#5e5b57", "color2": "#46443f", "angle": 0, "tileSize": 0.60, "productName": "Feinsteinzeug 60 × 60 cm, Farbe Iron (Bestand)"}
    deck = {"kind": "deck", "color": "#8a6a4c", "angle": 0, "plankWidth": 0.14, "productName": "Holzbelag Balkon (Bestand)"}
    wing = {"13.01": 8, "13.02": 8, "13.03": 8, "13.07": 8, "13.09": 8}
    base_wall = {"kind": "paint", "color": WALL_WHITE, "productName": "Warmweiß matt (NCS S 0502-Y)", "sheen": "matt"}
    rooms = {}
    for r in APT["rooms"]:
        rid = r["id"]
        if r["floor"] == "parkett":
            fl = dict(floor_parkett, angle=wing.get(rid, 0) + 90 if rid in ("13.01", "13.02", "13.03") else 90)
        elif r["floor"] == "fliesen":
            fl = dict(tiles, angle=wing.get(rid, 0))
        else:
            fl = dict(deck, angle=wing.get(rid, 0))
        wall = {"base": dict(base_wall)}
        if r["floor"] == "fliesen":
            wall = {"base": dict(base_wall), "lower": {"height": 1.20 if rid != "13.07" else 0.0, "surface": {"kind": "tiles", "color": "#e3dfd7", "color2": "#c9c4ba", "pattern": "large", "scale": 0.6}}}
        if r["outdoor"]:
            wall = {"base": {"kind": "paint", "color": "#e9e5dc", "productName": "Fassadenputz"}}
        rooms[rid] = {"floor": fl, "ceiling": CEIL_WHITE, "wall": wall}
    walls = {}
    if n == 1:
        walls[f"13.03:{wall_edge('13.03', 7.12, 14.31)}"] = {"base": {"kind": "paint", "color": "#c3cfb5", "productName": "Alpina Feine Farben No. 38 „Essenz der Natur“", "sheen": "edelmatt"}}
    elif n == 2:
        lime = {"kind": "limewash", "color": "#e7dccb", "color2": "#d8c9b2", "productName": "KREIDEZEIT Limewash Sand (Sumpfkalk)"}
        rooms["13.01"]["wall"] = {"base": lime}
        brown = {"kind": "paint", "color": "#75604f", "productName": "Alpina Feine Farben No. 5 „Dichter der Erde“", "sheen": "edelmatt"}
        rooms["13.03"]["wall"] = {"base": brown}
        rooms["13.03"]["ceiling"] = "#75604f"
    elif n == 3:
        greige = {"kind": "paint", "color": "#cfc6b8", "productName": "Alpina Feine Farben No. 35 „Wiege des Aromas“", "sheen": "edelmatt"}
        rooms["13.01"]["wall"] = {"base": dict(greige)}
        rooms["13.03"]["wall"] = {"base": dict(greige)}
    elif n == 4:
        white = {"kind": "paint", "color": "#f1ece3", "productName": "Alpina Feine Farben No. 36 „Tochter der Antike“", "sheen": "edelmatt"}
        for rid in ("13.01", "13.02", "13.03", "13.04", "13.07"):
            rooms[rid]["wall"] = {"base": dict(white)}
            rooms[rid]["ceiling"] = "#f1ece3"
        walls[f"13.03:{wall_edge('13.03', 7.12, 14.31)}"] = {"base": {"kind": "paint", "color": "#1f5a60", "productName": "Schöner Wohnen Designfarbe „Charmantes Petrolblau“", "sheen": "matt"}}
    return rooms, walls


def main():
    (DATA / "concepts").mkdir(parents=True, exist_ok=True)
    summary = []
    for n in (1, 2, 3, 4):
        B, total = build(n)
        rooms, walls = finishes(n)
        title, sub = TITLES[n]
        proj = {
            "version": 1, "name": title, "subtitle": sub, "conceptId": f"concept{n}",
            "createdAt": "2026-10-23T00:00:00Z", "updatedAt": "2026-10-23T00:00:00Z",
            "items": B.items, "budget": B.budget, "rooms": rooms, "walls": walls,
            "settings": {"doorsOpen": 0.0, "showDimensions": True, "snap": True, "gridSize": 0.05, "timeOfDay": 15.0, "budgetLimit": 40000},
        }
        (DATA / "concepts" / f"concept{n}.json").write_text(json.dumps(proj, ensure_ascii=False, indent=0))
        ref = round(sum(p["total"] or 0 for p in PRODUCTS[n]), 2)
        summary.append((n, len(B.items), len(B.budget), total, ref))
    cat = sorted(CATALOG.values(), key=lambda e: (e["category"], e["name"]))
    (DATA / "conceptCatalog.json").write_text(json.dumps(cat, ensure_ascii=False, indent=0))
    # Hauptkatalog: Konzeptzuordnung der Konzeptprodukte nachführen (ohne Neuaufbau aus den Händlerdaten)
    main_cat = json.loads((DATA / "catalog.json").read_text())
    changed = 0
    for e in main_cat:
        c = CATALOG.get(e["id"])
        if c is not None and e.get("concepts") != c["concepts"]:
            e["concepts"] = c["concepts"]
            changed += 1
        elif c is None and e.get("concepts"):
            del e["concepts"]  # früher per add_cat platziert, in keinem Konzept mehr
            changed += 1
    if changed:
        (DATA / "catalog.json").write_text(json.dumps(main_cat, ensure_ascii=False, separators=(",", ":")))
    print("Hauptkatalog: Konzeptzuordnung aktualisiert:", changed)
    for s in summary:
        print("Konzept %d: %d Objekte, %d Budgetzeilen, Summe %.2f € (PDF %.2f €)" % s)
    print("Katalog (Konzepte):", len(cat))


if __name__ == "__main__":
    main()
