"""Liest Westwing-Kategorien (Top-Produkte nach Beliebtheit), Produktseiten und alle Farb-/Materialvarianten aus.

Jede Produktseite hat eine Farbauswahl (data-testid="color-selector…") mit Link, Name und Musterbild je Ausführung.
Die verlinkten Varianten-Seiten werden ebenfalls gelesen (Preis, Bild, Maße je Ausführung).
Aufruf: python3 -I scrape_westwing.py <out.json>"""
import sys, re, json, html, urllib.request
import concurrent.futures as cf

CATS = {  # Kategorie → max. Produkte (nach Beliebtheit, mehrere Listenseiten)
    "sofas": 240, "sessel": 180, "couchtische": 140, "beistelltische": 110, "esstische": 120, "stuehle": 140,
    "sideboards": 120, "lowboards": 80, "konsolen": 60, "vitrinen": 45, "regale": 80, "kommoden": 70,
    "betten": 110, "nachttische": 70, "schreibtische": 50, "buerostuehle": 35, "hocker-poufs": 70, "sitzbaenke": 45,
    "barhocker": 40, "teppiche": 130, "stehleuchten": 90, "pendelleuchten": 100, "tischleuchten": 90, "wandleuchten": 60,
    "deckenleuchten": 60, "spiegel": 70, "bilder": 80, "vasen": 60, "kissen": 50, "plaids-decken": 30, "vorhaenge": 35,
    "gartensofas-lounge-sofas": 35, "gartentische": 35, "gartenstuehle": 35, "gartensessel-lounge-sessel": 30,
}
PAGES = 7
UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"}


def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def product(u):
    s = get(u)
    out = {"url": u}
    for lm in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            d = json.loads(lm.group(1))
        except Exception:
            continue
        for g in d.get("@graph", [d]) if isinstance(d, dict) else []:
            if g.get("@type") == "Product":
                out["name"] = g.get("name")
                out["brand"] = (g.get("brand") or {}).get("name") if isinstance(g.get("brand"), dict) else g.get("brand")
                out["color"] = g.get("color")
                out["material"] = g.get("material")
                out["sku"] = g.get("sku")
                img = g.get("image")
                img = img[0] if isinstance(img, list) and img else img
                out["image"] = img.get("contentUrl") if isinstance(img, dict) else img
                offs = g.get("offers") or []
                if isinstance(offs, dict):
                    offs = [offs]
                if offs:
                    out["price"] = offs[0].get("price")
                    out["available"] = "InStock" in str(offs[0].get("availability") or "")
    m = re.search(r'data-testid="product-size-text"[^>]*>(.*?)</div>', s, re.S)
    if m:
        out["size"] = html.unescape(re.sub(r"<[^>]+>", " ", m.group(1))).strip()
    m = re.search(r'colorDisplayVariant\\?",\{[^}]*\},\\?"([^"\\]+)', s)
    if m:
        out["colorDisplay"] = m.group(1)
    m = re.search(r'materialVariant\\?",\{[^}]*\},\\?"(.*?)\\?",', s)
    if m:
        out["materialText"] = m.group(1).replace("\\\\n", " ").replace("\\n", " ")[:300]
    # Farbauswahl: Name, Link und Musterbild je Ausführung
    links = []
    for a in re.finditer(r'<a data-testid="color-thumbnail-([^"]+)"[^>]*href="([^"]+)"[^>]*>(.*?)</a>', s, re.S):
        img = re.search(r'<img[^>]*src="([^"]+)"[^>]*alt="([^"]*)"', a.group(3), re.S)
        href = html.unescape(a.group(2)).split("?")[0]
        links.append({
            "key": html.unescape(a.group(1)),
            "name": html.unescape(img.group(2)) if img else html.unescape(a.group(1)),
            "url": "https://www.westwing.de" + href if href.startswith("/") else href,
            "swatch": html.unescape(img.group(1)) if img else None,
        })
    out["variantLinks"] = links
    out["variants"] = sorted({l["key"] for l in links})
    return out


def links_of(cat, k):
    links = []
    for page in range(1, PAGES + 1):
        try:
            s = get(f"https://www.westwing.de/{cat}/" + (f"?page={page}" if page > 1 else ""))
        except Exception as e:
            print("cat err", cat, page, e, flush=True)
            break
        new = [l for l in re.findall(r'href="(/[a-z0-9-]+\.html)"', s) if re.search(r"\d{5,}\.html$", l) and l not in links]
        links += list(dict.fromkeys(new))
        if len(links) >= k or not new:
            break
    return links[:k]


def fetch(args):
    cat, u, via = args
    try:
        p = product(u)
        p["category"] = cat
        if via:
            p["variantOf"] = via
        return p
    except Exception as e:
        return {"url": u, "category": cat, "err": str(e)}


def main():
    jobs, seen = [], set()
    for cat, k in CATS.items():
        ls = links_of(cat, k)
        for l in ls:
            u = "https://www.westwing.de" + l
            if u not in seen:
                seen.add(u)
                jobs.append((cat, u, None))
        print(cat, len(ls), flush=True)
    res = []
    with cf.ThreadPoolExecutor(8) as ex:
        for i, p in enumerate(ex.map(fetch, jobs)):
            res.append(p)
            if i % 200 == 0:
                print("produkte", i, flush=True)
    # Varianten-Seiten, die nicht schon als Produkt gelesen wurden
    more = []
    for p in res:
        for l in p.get("variantLinks") or []:
            if l["url"] not in seen:
                seen.add(l["url"])
                more.append((p["category"], l["url"], p["url"]))
    print("varianten", len(more), flush=True)
    with cf.ThreadPoolExecutor(8) as ex:
        for i, p in enumerate(ex.map(fetch, more)):
            res.append(p)
            if i % 200 == 0:
                print("varianten", i, flush=True)
    json.dump(res, open(sys.argv[1], "w"), ensure_ascii=False, indent=0)
    print("done", len(res))


if __name__ == "__main__":
    main()
