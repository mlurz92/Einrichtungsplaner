"""Liest Westwing-Kategorien (Top-Produkte nach Beliebtheit) und Produktseiten aus.
Aufruf: python3 -I scrape_westwing.py <out.json>"""
import sys, re, json, html, time, urllib.request

CATS = {  # Kategorie → max. Produkte (nach Beliebtheit, mehrere Listenseiten)
    "sofas": 160, "sessel": 120, "couchtische": 90, "beistelltische": 70, "esstische": 80, "stuehle": 90,
    "sideboards": 80, "lowboards": 50, "konsolen": 40, "vitrinen": 30, "regale": 50, "kommoden": 45,
    "betten": 70, "nachttische": 45, "schreibtische": 35, "buerostuehle": 25, "hocker-poufs": 45, "sitzbaenke": 30,
    "barhocker": 25, "teppiche": 90, "stehleuchten": 60, "pendelleuchten": 70, "tischleuchten": 60, "wandleuchten": 40,
    "deckenleuchten": 40, "spiegel": 50, "bilder": 60, "vasen": 40, "kissen": 40, "plaids-decken": 25, "vorhaenge": 25,
    "gartensofas-lounge-sofas": 25, "gartentische": 25, "gartenstuehle": 25, "gartensessel-lounge-sessel": 20,
}
PAGES = 4
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
                img = g.get("image")
                img = img[0] if isinstance(img, list) and img else img
                out["image"] = img.get("contentUrl") if isinstance(img, dict) else img
                offs = g.get("offers") or []
                if isinstance(offs, dict):
                    offs = [offs]
                if offs:
                    out["price"] = offs[0].get("price")
    m = re.search(r'data-testid="product-size-text"[^>]*>(.*?)</div>', s, re.S)
    if m:
        out["size"] = html.unescape(re.sub(r"<[^>]+>", " ", m.group(1))).strip()
    m = re.search(r'colorDisplayVariant\\?",\{[^}]*\},\\?"([^"\\]+)', s)
    if m:
        out["colorDisplay"] = m.group(1)
    m = re.search(r'materialVariant\\?",\{[^}]*\},\\?"(.*?)\\?",', s)
    if m:
        out["materialText"] = m.group(1).replace("\\\\n", " ").replace("\\n", " ")[:300]
    out["variants"] = sorted(set(re.findall(r'data-testid="color-thumbnail-square-([^"]+)"', s)))
    return out

import concurrent.futures as cf


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
    cat, l = args
    try:
        p = product("https://www.westwing.de" + l)
        p["category"] = cat
        return p
    except Exception as e:
        return {"url": l, "category": cat, "err": str(e)}


jobs, seen = [], set()
for cat, k in CATS.items():
    ls = links_of(cat, k)
    for l in ls:
        if l not in seen:
            seen.add(l)
            jobs.append((cat, l))
    print(cat, len(ls), flush=True)
res = []
with cf.ThreadPoolExecutor(6) as ex:
    for i, p in enumerate(ex.map(fetch, jobs)):
        res.append(p)
        if i % 200 == 0:
            print("produkte", i, flush=True)
json.dump(res, open(sys.argv[1], "w"), ensure_ascii=False, indent=0)
print("done", len(res))
