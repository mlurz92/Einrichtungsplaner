"""Regressionstests für finish.py (Ausführungstext → Bauteilfarben). Aufruf: python3 tools/test_finish.py"""
from finish import slots_from

CASES = [
    # (Kategorie, Ausführung, Produktname, Slot, erwartete Farbe, erwartetes Material)
    ("sofa", "Gunnared beige", "SÖDERHAMN 3er-Sofa", "main", "#d6c7ae", "melange"),
    ("sofa", "mit Récamiere/Kelinge dunkelgelb", "SÖDERHAMN", "main", "#bf9530", "fabric"),
    ("sofa", "ohne Abschluss/Fridtuna dunkel graublau", "x", "main", None, "leather"),
    ("armchair", "Grann / Bomstad goldbraun / Holz", "LANDSKRONA Sessel", "main", "#9a6a35", "leather"),
    ("armchair", "Grann / Bomstad goldbraun / Holz", "LANDSKRONA Sessel", "legs", None, "oak"),
    ("sofa", "Bouclé meliert, rostrot", "x", "main", "#a5563b", "boucleMel"),
    ("sofa", "Viarp beige / braun", "POÄNG", "main", "#d6c7ae", "linen"),
    ("sofa", "Chenille off white", "x", "main", "#ede8dc", "chenille"),
    ("chair", "Grann hellbraun / weiß", "TOSSBERG", "legs", "#f3f1ec", "lacquer"),
    ("sideTable", "Mangoholz, dunkel", "x", "top", "#493322", "mango"),
    ("art", "Beige, Rot, marmoriert", "Bild", "secondary", "#b23a32", "canvas"),
    ("pouf", "Kunstfell dunkelbraun", "x", "main", "#4e3a2c", "fur"),
    ("sofa", "Djuparp / dunkel grünblau Eiche", "SMEDSTORP", "main", None, "velvet"),
    ("wardrobe", "weiß/Eicheneff wlas", "PAX / BERGSBO Kleiderschrank", "main", "#e3d6c2", "oak"),
    ("coffeeTable", "Marmor-optik schwarz, glänzend", "Couchtisch", "top", "#1d1d1d", "marble"),
    ("coffeeTable", "schwarzbraun/Glas", "VITTSJÖ", "top", None, "glass"),
    ("coffeeTable", "Transparent Braun, Silberfarben", "Couchtisch Jouri", "top", "#7a5a43", "glass"),
    ("diningTable", "Warme Eiche, Schwarz", "Esstisch", "legs", "#1d1d1d", "blackMetal"),
    ("console", "DUNKELGRÜN marmoriert / Beine Metall goldfarben", "Konsole", "legs", None, "brass"),
    ("sideboard", "Off white, glänzend", "x", "main", "#ede8dc", "gloss"),
    ("tableLamp", "Hellgrün", "Tischlampe EIVIN Porzellan", "main", "#b9c9a8", "ceramic"),
    ("tableLamp", "Hellgrün", "Tischlampe EIVIN Porzellan", "shade", None, "opal"),
    ("floorLamp", "Beige, Dunkelbraun", "Tripod-Stehlampe Jake aus Massivholz", "legs", "#4e3a2c", "oak"),
    ("floorLamp", "Weiß, goldfarben", "Bogenlampe Niels", "main", None, "brass"),
    ("armchair", "Teddy-bouclé off white, helles buchenholz", "x", "main", "#ede8dc", "teddy"),
]


def main():
    bad = 0
    for cat, txt, name, slot, col, mat in CASES:
        s = (slots_from(cat, txt, name) or {}).get(slot) or {}
        ok = (col is None or s.get("color") == col) and s.get("material") == mat
        if not ok:
            bad += 1
            print("FEHLER", cat, txt, slot, s, "erwartet", col, mat)
    print(f"{len(CASES) - bad}/{len(CASES)} ok")
    raise SystemExit(1 if bad else 0)


if __name__ == "__main__":
    main()
