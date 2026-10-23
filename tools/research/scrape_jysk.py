"""Liest JYSK-Produktseiten (Server-Rendering) aus und speichert Name, Preis, Maße, Farbe, Material.
Aufruf: python3 -I scrape_jysk.py <urls.txt> <out.json>"""
import sys, re, json, html, time, urllib.request

CATS = ["wohnzimmer/sofas", "wohnzimmer/modulare-sofas", "wohnzimmer/sessel", "wohnzimmer/couchtische-beistelltische",
        "wohnzimmer/tv-mobel", "wohnzimmer/poufs", "wohnzimmer/schlafsofas", "esszimmer/esstische", "esszimmer/esszimmerstuhle",
        "esszimmer/sideboards", "esszimmer/vitrinen", "esszimmer/konsolentische", "esszimmer/barstuhle-und-bartische",
        "schlafzimmer/nachttische", "schlafzimmer/betten", "buro/burostuhle", "wohnaccessoires/beleuchtung",
        "garten/gartenmobel", "garderobe/flurmobel", "wohnaccessoires/deko", "schlafzimmer/kommoden", "buro/schreibtische",
        "wohnzimmer/regale", "wohnaccessoires/spiegel", "wohnaccessoires/teppiche", "wohnaccessoires/gardinen"]

def get(u):
    req = urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")

def parse(u, s):
    out = {"url": u}
    m = re.search(r'"name":"([^"]+)"\}\]\}', s)
    for lm in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        t = lm.group(1)
        try:
            d = json.loads(t)
        except Exception:
            continue
        if isinstance(d, dict) and d.get("@type") == "BreadcrumbList":
            out["name"] = d["itemListElement"][-1]["name"]
        if isinstance(d, dict) and d.get("@type") in ("ProductGroup", "Product"):
            vs = d.get("hasVariant") or [d]
            for v in vs:
                off = v.get("offers") or {}
                if isinstance(off, list):
                    off = off[0] if off else {}
                if v.get("url", "").rstrip("/").endswith(u.rstrip("/").split("/")[-1]) or len(vs) == 1:
                    out["price"] = off.get("price")
                    out["sku"] = v.get("sku")
            out.setdefault("price", None)
    sm = re.search(r'productSpecs&quot;:(\{.*?\}\}),&quot;showRecycling', s) or re.search(r'"productSpecs":(\{.*?\}\}),"showRecycling', s)
    txt = html.unescape(sm.group(1)) if sm else None
    if txt:
        try:
            spec = json.loads(txt)["specs"]["general"]
            out["specs"] = {}
            for k, v in spec:
                out["specs"].setdefault(k, v)
        except Exception as e:
            out["specErr"] = str(e)
    if out.get("price") is None:
        pm = re.search(r'&quot;price&quot;:&quot;?([\d.]+)', s) or re.search(r'"price":"?([\d.]+)', s)
        if pm:
            out["price"] = pm.group(1)
    return out

urls = [l.strip() for l in open(sys.argv[1]) if l.strip()]
sel = [u for u in urls if any(f"jysk.de/{c}/" in u for c in CATS)]
res = []
for i, u in enumerate(sel):
    try:
        res.append(parse(u, get(u)))
    except Exception as e:
        res.append({"url": u, "err": str(e)})
    if i % 25 == 0:
        json.dump(res, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
        print(i, len(sel), flush=True)
    time.sleep(0.3)
json.dump(res, open(sys.argv[2], "w"), ensure_ascii=False, indent=0)
print("done", len(res))
