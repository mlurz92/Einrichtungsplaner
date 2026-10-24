"""Alle vom Hersteller angebotenen Ausführungen je IKEA-Produkt (Bezug, Farbe, Korpus/Front …).

Die Suche (scrape_ikea.py) liefert je Produkt höchstens sechs Varianten. Die Produktseite enthält dagegen den
vollständigen Ausführungs-Wähler (productStylePickerProps.variationStyles: Achse → alle Optionen mit Link).
Je Produkt wird die Seite gelesen, dann jede Option (Preis, Bild, Beschreibung „Typ, Ausführung, Maß“);
bei mehreren Achsen auch die Optionen der Optionsseiten (Kombinationen), höchstens MAX je Produkt.
Aufruf: python3 -I scrape_ikea_options.py <ikea_products.json> <out.json>"""
import os, sys, re, json, gzip, time, urllib.request
import concurrent.futures as cf
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_catalog import ikea_cat  # noqa: E402

MAX = 60
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36", "Accept-Encoding": "gzip"}


def get(u):
    for i in range(3):
        try:
            r = urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60)
            b = r.read()
            if r.headers.get("Content-Encoding") == "gzip":
                b = gzip.decompress(b)
            return r.geturl(), b.decode("utf-8", "replace")
        except Exception:
            if i == 2:
                raise
            time.sleep(2 * (i + 1))


def obj_after(s, key):
    i = s.find(key)
    if i < 0:
        return None
    j = s.find("{", i)
    depth, ins, esc = 0, False, False
    for k in range(j, len(s)):
        ch = s[k]
        if ins:
            if esc:
                esc = False
            elif ch == "\\":
                esc = True
            elif ch == '"':
                ins = False
        elif ch == '"':
            ins = True
        elif ch == "{":
            depth += 1
        elif ch == "}":
            depth -= 1
            if depth == 0:
                return json.loads(s[j:k + 1])
    return None


def page(u):
    fu, s = get(u)
    if "/p/" not in fu:
        return None
    out = {"url": fu}
    m = re.search(r'"prefixedProductId":"([SA]?\d+)","price":([\d.]+)', s)
    if m:
        out["itemNo"] = m.group(1).lstrip("SA")
        out["price"] = float(m.group(2))
    m = re.search(r'"productDescriptionProps":\{"descriptionText":"((?:[^"\\]|\\.)*)"', s)
    if m:
        out["desc"] = json.loads('"' + m.group(1) + '"')
    m = re.search(r'"productName":"((?:[^"\\]|\\.)*)"', s)
    if m:
        out["name"] = json.loads('"' + m.group(1) + '"')
    m = re.search(r'<meta property="og:image" content="([^"]+)"', s)
    if m:
        out["image"] = m.group(1)
    pk = obj_after(s, '"productStylePickerProps"')
    axes = []
    for vs in (pk or {}).get("variationStyles") or []:
        axes.append({
            "title": (vs.get("title") or "").strip(), "code": vs.get("code"), "selected": vs.get("selectedOption"),
            "options": [{"title": o.get("title"), "url": o.get("url"), "id": o.get("linkId"),
                         "swatch": (o.get("valueImage") or {}).get("url")} for o in vs.get("allOptions") or []],
        })
    out["axes"] = axes
    return out


def crawl(root_url):
    try:
        first = page(root_url)
    except Exception as e:
        return {"root": root_url, "err": str(e)}
    if not first:
        return {"root": root_url, "err": "kein Produkt"}
    got = {first["url"].rstrip("/"): first}
    queue = [o["url"] for a in first["axes"] for o in a["options"] if o.get("url")]
    multi = len(first["axes"]) > 1
    while queue and len(got) < MAX:
        u = queue.pop(0)
        if not u or u.rstrip("/") in got:
            continue
        try:
            p = page(u)
        except Exception:
            continue
        if not p:
            continue
        got[u.rstrip("/")] = p
        got[p["url"].rstrip("/")] = p
        if multi:
            queue += [o["url"] for a in p["axes"] for o in a["options"] if o.get("url") and o["url"].rstrip("/") not in got]
    pages = list({id(p): p for p in got.values()}.values())
    for p in pages:
        p["sel"] = {a["title"]: a["selected"] for a in p["axes"]}
    return {"root": root_url, "axes": [{"title": a["title"], "code": a["code"],
                                        "options": [o["title"] for o in a["options"]],
                                        "swatches": {o["title"]: o["swatch"] for o in a["options"]}} for a in first["axes"]],
            "pages": [{k: p.get(k) for k in ("itemNo", "url", "price", "desc", "image", "sel")} for p in pages]}


def main():
    raw = json.load(open(sys.argv[1]))
    out_f = Path(sys.argv[2])
    done = json.loads(out_f.read_text()) if out_f.exists() else {}
    roots, seen = [], set()
    for p in raw:
        if not ikea_cat(p.get("type")) or not p.get("price"):
            continue
        key = (p["name"], p.get("type"), p.get("measure"))
        if key in seen or p["url"] in done:
            continue
        seen.add(key)
        roots.append(p["url"])
    print("produkte", len(roots), flush=True)
    with cf.ThreadPoolExecutor(int(os.environ.get("THREADS", "10"))) as ex:
        for i, r in enumerate(ex.map(crawl, roots)):
            done[r["root"]] = r
            if i % 50 == 0:
                out_f.write_text(json.dumps(done, ensure_ascii=False))
                print(i, flush=True)
    out_f.write_text(json.dumps(done, ensure_ascii=False))
    print("done", len(done))


if __name__ == "__main__":
    main()
