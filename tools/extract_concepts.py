"""Extrahiert die Produktlisten (Pos., Produkt, Ausführung, Maße, Händler, Anzahl, Preise, Lieferzeit, Link)
aus den vier Möblierungskonzept-PDFs. Ausgabe: tools/out/concept_products_<n>.json"""
import json, re, sys
from pathlib import Path
import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[1]
FILES = {
    1: "WE13_Moeblierungskonzept.pdf",
    2: "WE13_Moeblierungskonzept_2.pdf",
    3: "WE13_Moeblierungskonzept_3.pdf",
    4: "WE13_Moeblierungskonzept_4.pdf",
}
OUT = ROOT / "tools/out"


def euro(s):
    s = s.replace("€", "").replace(".", "").replace(",", ".").replace("\xa0", "").strip()
    try:
        return float(s)
    except ValueError:
        return None


def parse(n):
    doc = fitz.open(ROOT / FILES[n])
    items = []
    section = None
    for pno in range(len(doc)):
        page = doc[pno]
        spans = []
        for b in page.get_text("dict")["blocks"]:
            for l in b.get("lines", []):
                for s in l["spans"]:
                    if s["text"].strip():
                        spans.append(s)
        HN = ("Pos.", "Produkt · Ausführung", "Maße", "Händler", "Anz.", "Einzel", "Summe", "Lieferung")
        hspans = [s for s in spans if s["font"].startswith("Inter-Semi") and s["color"] == 0x6B6B6B and s["text"].strip() in HN]
        if not any(s["text"].strip() == "Händler" for s in hspans):
            continue
        headers = []
        for s in sorted(hspans, key=lambda s: s["bbox"][1]):
            if headers and abs(headers[-1][0] - s["bbox"][1]) < 4:
                headers[-1][1][s["text"].strip()] = s["bbox"][0]
            else:
                headers.append((s["bbox"][1], {s["text"].strip(): s["bbox"][0]}))
        # fehlende Spalten (z. B. leere Maße-Spalte) aus der ersten vollständigen Kopfzeile ergänzen
        full = next((h[1] for h in headers if len(h[1]) == len(HN)), None)
        if full:
            for h in headers:
                for k, v in full.items():
                    h[1].setdefault(k, v)
        links = page.get_links()
        spans.sort(key=lambda s: (round(s["bbox"][1]), s["bbox"][0]))
        cur = None
        for s in spans:
            x0, y0, x1, y1 = s["bbox"]
            t = s["text"].strip()
            cand = [h for h in headers if h[0] <= y0 + 1]
            X = (cand[-1] if cand else headers[0])[1]
            if s["font"].startswith("Source-Serif") and s["size"] > 10:
                section = t
                continue
            if s["color"] == 0x6B6B6B or y0 < 50 or y0 > page.rect.height - 40:
                continue
            if x0 < X["Produkt · Ausführung"] - 5:
                if s["font"].startswith("Inter-Semi") and re.match(r"^[A-Z]{1,3}\d", t):
                    cur = {"pos": t, "room": section, "name": [], "variant": [], "note": [], "tags": [], "dims": [],
                           "vendor": "", "qty": None, "unit": None, "total": None, "delivery": [], "url": None, "page": pno + 1}
                    items.append(cur)
                continue
            if cur is None:
                continue
            if x0 < X["Maße"] - 3:
                col = s["color"]
                if s["size"] < 6.5 and s["font"].startswith("Inter-Semi"):
                    cur["tags"].append(t)
                elif col == 0x2F3A31 or (s["size"] >= 7.5 and col not in (0x777777,)):
                    cur["name"].append(t)
                    if not cur["url"]:
                        for lk in links:
                            r = lk["from"]
                            if lk.get("uri") and r.y0 - 2 <= y0 <= r.y1 and r.x0 - 2 <= x0 <= r.x1:
                                cur["url"] = lk["uri"]
                elif col == 0x777777:
                    cur["variant"].append(t)
                else:
                    cur["note"].append(t)
            elif x0 < X["Händler"] - 3:
                cur["dims"].append(t)
            elif x0 < X["Anz."] + 10 and not t.endswith("€"):
                if re.fullmatch(r"\d+", t):
                    cur["qty"] = int(t)
                else:
                    cur["vendor"] = (cur["vendor"] + " " + t).strip()
            elif t.endswith("€") or t.startswith("€") or re.fullmatch(r"[\d.]+,\d\d", t):
                if cur["unit"] is None and not s["font"].startswith("Inter-Semi"):
                    cur["unit"] = euro(t)
                else:
                    cur["total"] = euro(t)
            elif x0 >= X["Lieferung"] - 3:
                cur["delivery"].append(t)
            elif re.fullmatch(r"\d+", t):
                cur["qty"] = int(t)
    for it in items:
        it["name"] = re.sub(r"\s+[\d.]+,\d{1,2}\s*€?$", "", " ".join(it["name"]).replace(" ,", ",")).strip()
        it["variant"] = " ".join(it["variant"])
        it["note"] = " ".join(it["note"])
        it["dims"] = " ".join(it["dims"]).replace("\xa0", " ")
        it["delivery"] = " ".join(it["delivery"])
    return items


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    for n in FILES:
        items = parse(n)
        (OUT / f"concept_products_{n}.json").write_text(json.dumps(items, ensure_ascii=False, indent=1))
        tot = sum(i["total"] or 0 for i in items)
        print(n, len(items), round(tot, 2))
