"""Extrahiert die exakte Geometrie der Wohnung WE 13 aus der Vektor-PDF des Grundrisses.

Ausgabe: app/src/data/apartment.json (Meter, Planachsen: x nach rechts, y nach unten).
Maßstab 1:50 auf A2 -> 1 m = 56,6929 pt (verifiziert an Maßstabsleiste 0..5 m).
"""
import json, math, sys
from pathlib import Path
import pymupdf as fitz
from shapely.geometry import Polygon, LineString, Point, box
from shapely.ops import unary_union
from shapely import affinity

ROOT = Path(__file__).resolve().parents[1]
PDF = ROOT / "WE13_Grundriss_Innenmasse2.pdf"
OUT = ROOT / "app/src/data/apartment.json"

PT_PER_M = 72 / 25.4 * 20  # 1:50 -> 20 mm je Meter
OX, OY = 62.362, 113.386   # linke/obere Grenze der Wandkontur

CEILING = 2.56             # Raumhöhe (Fertigmaß, Vorgabe Nutzer; Konzept-PDF nennt 2,58 m)
DOOR_H = 2.01              # lichte Türhöhe (Rohbau 2,135 m abzgl. Fußbodenaufbau)
WINDOW_H = 2.56            # bodentiefe Fenster bis Decke (Rohbau 2,72 m)


def m(pt):
    return (round((pt[0] - OX) / PT_PER_M, 4), round((pt[1] - OY) / PT_PER_M, 4))


def loops_from_items(items):
    loops, cur = [], []
    for it in items:
        if it[0] != "l":
            continue
        a, b = (it[1].x, it[1].y), (it[2].x, it[2].y)
        if cur and (abs(a[0] - cur[-1][0]) > 1e-3 or abs(a[1] - cur[-1][1]) > 1e-3):
            loops.append(cur)
            cur = []
        if not cur:
            cur = [a]
        cur.append(b)
    if cur:
        loops.append(cur)
    return loops


def poly_pts(items):
    return [(it[1].x, it[1].y) for it in items if it[0] == "l"]


def rect_items(x):
    it = x["items"][0]
    if it[0] == "re":
        r = it[1]
        return [(r.x0, r.y0), (r.x1, r.y0), (r.x1, r.y1), (r.x0, r.y1)]
    return poly_pts(x["items"])


def centerline(corners):
    """Mittellinie eines schmalen Rechtecks entlang der Längsachse."""
    p = corners[:4]
    e01 = math.dist(p[0], p[1]); e12 = math.dist(p[1], p[2])
    if e01 >= e12:
        a = ((p[0][0] + p[3][0]) / 2, (p[0][1] + p[3][1]) / 2)
        b = ((p[1][0] + p[2][0]) / 2, (p[1][1] + p[2][1]) / 2)
        t = e12
    else:
        a = ((p[0][0] + p[1][0]) / 2, (p[0][1] + p[1][1]) / 2)
        b = ((p[3][0] + p[2][0]) / 2, (p[3][1] + p[2][1]) / 2)
        t = e01
    return a, b, t


def main():
    doc = fitz.open(PDF)
    page = doc[0]
    dr = page.get_drawings()

    def is_col(c, v, tol=0.01):
        return c is not None and all(abs(ci - v) < tol for ci in c)

    # Wände: eine Füllfläche dunkelgrau mit 12 Teilpfaden
    wall_draw = next(x for x in dr if is_col(x.get("fill"), 0.1647) and len(x["items"]) > 100)
    wall_polys = [Polygon(l) for l in loops_from_items(wall_draw["items"])]
    walls_u = unary_union(wall_polys)

    # Räume: weiß bzw. beige gefüllte Polygone (Reihenfolge = Zeichenreihenfolge im CAD-Export)
    room_meta = [
        ("13.01", "Essen / Wohnen / Flur", "parkett"),
        ("13.02", "Kochen", "parkett"),
        ("13.03", "Schlafen", "parkett"),
        ("13.04", "Arbeit / Gast / Kind", "parkett"),
        ("13.05", "Bad", "fliesen"),
        ("13.06", "Dusche / Gäste-WC", "fliesen"),
        ("13.07", "HWR", "fliesen"),
        ("13.08", "Balkon 1", "holz"),
        ("13.09", "Balkon 2", "holz"),
    ]
    room_draws = [x for x in dr if x["type"] == "f" and x["items"][0][0] == "l" and x["rect"].x1 < 960]
    assert len(room_draws) == 9, len(room_draws)
    rooms = []
    room_polys = []
    for (rid, name, floor), x in zip(room_meta, room_draws):
        pts = poly_pts(x["items"])
        poly = Polygon(pts).buffer(0)
        room_polys.append(poly)
        rooms.append({
            "id": rid, "name": name, "floor": floor,
            "outdoor": rid in ("13.08", "13.09"),
            "polygon": [m(p) for p in pts],
            "area": round(poly.area / PT_PER_M ** 2, 3),
            "perimeter": round(poly.length / PT_PER_M, 3),
        })
    solid_u = unary_union([walls_u] + room_polys)

    def gap_polygon(a, b):
        """Leibungsfläche (Wandöffnung) zwischen den Wandköpfen entlang a->b."""
        ax, ay = a; bx, by = b
        L = math.dist(a, b)
        ux, uy = (bx - ax) / L, (by - ay) / L
        nx, ny = -uy, ux
        spans = []
        for (px, py), s in ((a, -1), (b, 1)):
            q = (px + ux * s * 1.2, py + uy * s * 1.2)
            ray = LineString([(q[0] - nx * 40, q[1] - ny * 40), (q[0] + nx * 40, q[1] + ny * 40)])
            inter = ray.intersection(walls_u)
            segs = [g for g in getattr(inter, "geoms", [inter]) if not g.is_empty]
            best = None
            for g in segs:
                cs = list(g.coords)
                ts = [((c[0] - q[0]) * nx + (c[1] - q[1]) * ny) for c in cs]
                lo, hi = min(ts), max(ts)
                d = 0 if lo <= 0 <= hi else min(abs(lo), abs(hi))
                if best is None or d < best[0]:
                    best = (d, lo, hi)
            if best and best[0] < 4:
                spans.append((best[1], best[2]))
        if not spans:
            return None, 0, a, b
        lo, hi = min(spans, key=lambda s: s[1] - s[0])
        # tatsächliche Rohbauöffnung: freie Strecke zwischen den Wandköpfen in Wandmitte
        mid = (lo + hi) / 2
        cx, cy = (ax + bx) / 2 + nx * mid, (ay + by) / 2 + ny * mid
        axis = LineString([(cx - ux * 200, cy - uy * 200), (cx + ux * 200, cy + uy * 200)])
        free = axis.difference(walls_u)
        seg = min(getattr(free, "geoms", [free]), key=lambda g: g.distance(Point(cx, cy)))
        cs = list(seg.coords)
        ts = sorted(((c[0] - cx) * ux + (c[1] - cy) * uy) for c in cs)
        t0, t1 = ts[0], ts[-1]
        if t1 - t0 > L + 25 or t1 - t0 < L - 2:  # keine Wandköpfe gefunden -> Element-Länge
            t0, t1 = -L / 2, L / 2
        a = (cx + ux * t0 - nx * mid, cy + uy * t0 - ny * mid)
        b = (cx + ux * t1 - nx * mid, cy + uy * t1 - ny * mid)
        ax, ay = a; bx, by = b
        pts = [(ax + nx * lo, ay + ny * lo), (bx + nx * lo, by + ny * lo), (bx + nx * hi, by + ny * hi), (ax + nx * hi, ay + ny * hi)]
        return pts, (hi - lo), a, b

    openings = []

    # Fenster: weiße Rahmen 0,62 pt + Glaslinie
    win_names = {
        (540, 324): ("W-B1", "Wohnen → Balkon 1 (Fenstertür)", True),
        (480, 376): ("W-B1L", "Wohnen → Balkon 1 (Seitenfenster)", False),
        (509, 552): ("W-O1", "Wohnen Ostfassade 1", False),
        (488, 700): ("W-O2", "Wohnen Ostfassade 2", False),
        (130, 875): ("W-K", "Kochen → Balkon 2 (Fenstertür)", True),
        (270, 1021): ("W-S1", "Schlafen Südfenster 1", False),
        (348, 1032): ("W-S2", "Schlafen Südfenster 2", False),
        (729, 409): ("W-A1", "Arbeit Südfenster 1", False),
        (807, 409): ("W-A2", "Arbeit Südfenster 2", False),
    }
    for x in dr:
        if x["type"] == "fs" and is_col(x.get("fill"), 1.0) and is_col(x.get("color"), 0.1647) and abs((x.get("width") or 0) - 0.6236) < 0.01 and x["rect"].x1 < 960:
            key = next((k for k in win_names if abs(k[0] - x["rect"].x0) < 3 and abs(k[1] - x["rect"].y0) < 3), None)
            if key is None:
                continue
            wid, label, balcony_door = win_names[key]
            a, b, t = centerline(rect_items(x))
            gp, th, a, b = gap_polygon(a, b)
            openings.append({
                "id": wid, "type": "window", "label": label,
                "a": m(a), "b": m(b), "width": round(math.dist(a, b) / PT_PER_M, 3),
                "sill": 0.0, "height": WINDOW_H, "balconyDoor": balcony_door,
                "depth": round(th / PT_PER_M, 3),
                "reveal": [m(p) for p in gp] if gp else None,
            })

    # Türen: Türblatt 0,71 pt + Aufschlagbogen
    leaves = [x for x in dr if x["type"] == "fs" and is_col(x.get("fill"), 1.0) and is_col(x.get("color"), 0.1647) and abs((x.get("width") or 0) - 0.7087) < 0.01 and x["rect"].x1 < 960]
    arcs = [x for x in dr if x["type"] == "s" and x["items"][0][0] == "c" and x["rect"].x1 < 960]
    door_names = [
        ((621, 129), "D-ENT", "Wohnungseingangstür", "entrance"),
        ((353, 330), "D-T30", "T30-Tür Fluchttreppenhaus", "entrance"),
        ((272, 779), "D-SCH", "Tür Schlafen", "door"),
        ((701, 264), "D-ARB", "Tür Arbeit / Gast / Kind", "door"),
        ((701, 187), "D-BAD", "Tür Bad", "door"),
        ((570, 190), "D-DU", "Tür Dusche / Gäste-WC", "door"),
        ((165, 621), "D-HWR", "Tür HWR", "door"),
    ]
    for x in leaves:
        key = next((k for k in door_names if abs(k[0][0] - x["rect"].x0) < 4 and abs(k[0][1] - x["rect"].y0) < 4), None)
        if key is None:
            continue
        _, did, label, kind = key
        la, lb, t = centerline(rect_items(x))
        best = None
        for arc in arcs:
            it = arc["items"][0]
            p0, p3 = (it[1].x, it[1].y), (it[4].x, it[4].y)
            for tip_c, closed in ((p0, p3), (p3, p0)):
                for tip, hinge in ((la, lb), (lb, la)):
                    d = math.dist(tip, tip_c)
                    if best is None or d < best[0]:
                        best = (d, hinge, tip, closed)
        d, hinge, tip, closed = best
        assert d < 4, (did, d)
        # Leibung über Scharnier -> geschlossene Blattspitze
        gp, th, ga, gb = gap_polygon(hinge, closed)
        # Scharnierseite: Wandkopf, der dem Türblatt-Drehpunkt am nächsten liegt
        if math.dist(gb, hinge) < math.dist(ga, hinge):
            ga, gb = gb, ga
        # Aufschlagseite: Vorzeichen von tip relativ zur Linie hinge->closed
        hx, hy = hinge; cx, cy = closed; tx, ty = tip
        side = (cx - hx) * (ty - hy) - (cy - hy) * (tx - hx)
        openings.append({
            "id": did, "type": kind, "label": label,
            "a": m(ga), "b": m(gb), "width": round(math.dist(ga, gb) / PT_PER_M, 3),
            "leafWidth": round(math.dist(hinge, closed) / PT_PER_M, 3),
            "sill": 0.0, "height": DOOR_H,
            "hinge": "a", "swing": 1 if side > 0 else -1,
            "depth": round(th / PT_PER_M, 3),
            "reveal": [m(p) for p in gp] if gp else None,
        })

    # Geländer (Balkone)
    railings = []
    for x in leaves:
        if any(abs(k[0][0] - x["rect"].x0) < 4 and abs(k[0][1] - x["rect"].y0) < 4 for k in door_names):
            continue
        a, b, t = centerline(rect_items(x))
        railings.append({"a": m(a), "b": m(b)})

    # Installationsschacht HWR (Kreuz) und offene Raumgrenze Kochen/Wohnen
    shaft = None
    for x in dr:
        if x["rect"].x0 > 120 and x["rect"].x1 < 160 and 590 < x["rect"].y0 < 600:
            pass
    shaft = [m(p) for p in [(126.06, 607.9), (157.63, 597.39), (155.57, 612.05), (128.12, 593.24)]]

    data = {
        "name": "Wohnung WE 13",
        "source": "WE13_Grundriss_Innenmasse2.pdf (Rohbau-Innenmaße, Vektorgeometrie 1:50)",
        "units": "m",
        "axes": "x nach rechts (Plan-Ost), y nach unten (Plan-Süd)",
        "ceilingHeight": CEILING,
        "doorHeight": DOOR_H,
        "wingRotationDeg": 8.0,
        "walls": [[m(p) for p in list(pl.exterior.coords)[:-1]] for pl in wall_polys],
        "rooms": rooms,
        "openings": sorted(openings, key=lambda o: o["id"]),
        "railings": railings,
        "openBoundaries": [[m((278.43, 683.36)), m((266.02, 771.66))]],
        "shaft": shaft,
        "bounds": [0, 0, round((920.28 - OX) / PT_PER_M, 3), round((1064.77 - OY) / PT_PER_M, 3)],
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    for r in rooms:
        print(r["id"], r["name"], r["area"], r["perimeter"])
    for o in data["openings"]:
        print(o["id"], o["type"], o["width"], o["depth"], o.get("swing"))
    print("railings", len(railings))


if __name__ == "__main__":
    main()
