"""Liest Westwing-Kategorien (Top-Produkte nach Beliebtheit) und Produktseiten aus.
Aufruf: python3 -I scrape_westwing.py <out.json>"""
import sys, re, json, html, time, urllib.request

CATS = {
    "sofas": 40, "sessel": 36, "couchtische": 30, "beistelltische": 24, "esstische": 30, "stuehle": 30,
    "sideboards": 28, "lowboards": 20, "konsolen": 14, "vitrinen": 12, "regale": 20, "kommoden": 14,
    "betten": 26, "nachttische": 18, "schreibtische": 14, "buerostuehle": 12, "hocker-poufs": 14,
    "teppiche": 30, "stehleuchten": 24, "pendelleuchten": 24, "tischleuchten": 24, "wandleuchten": 16,
    "deckenleuchten": 16, "spiegel": 20, "bilder": 24, "vasen": 14, "vorhaenge": 12,
    "gartensofas-lounge-sofas": 10, "gartentische": 10, "gartenstuehle": 10, "gartensessel-lounge-sessel": 8,
}
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

res = []
for cat, k in CATS.items():
    try:
        s = get(f"https://www.westwing.de/{cat}/")
    except Exception as e:
        print("cat err", cat, e, flush=True)
        continue
    links = []
    for l in re.findall(r'href="(/[a-z0-9-]+\.html)"', s):
        if l not in links and re.search(r"\d{5,}\.html$", l):
            links.append(l)
    for l in links[:k]:
        try:
            p = product("https://www.westwing.de" + l)
            p["category"] = cat
            res.append(p)
        except Exception as e:
            res.append({"url": l, "category": cat, "err": str(e)})
        time.sleep(0.3)
    json.dump(res, open(sys.argv[1], "w"), ensure_ascii=False, indent=0)
    print(cat, len(links), len(res), flush=True)
print("done", len(res))
