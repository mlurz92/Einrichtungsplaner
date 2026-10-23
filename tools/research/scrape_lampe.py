"""Hochwertige Innenleuchten von lampe.de sammeln.

Quelle: Produkt-Sitemap (media/sitemap/*.xml) → Produktseiten mit schema.org-JSON-LD
(Name, SKU, Marke, Preis, Bild) und Attributtabelle (Abmessungen, Farben, Materialien, Leuchtmittel).
Auswahl: Designmarken bzw. hochwertige Hersteller, nur Innenleuchten der Typen Tisch-, Steh-,
Pendel-, Decken- und Wandleuchte.
Ausgabe: data/lampe_products.json
"""
import concurrent.futures as cf
import html
import json
import pathlib
import re
import sys
import time
import urllib.request

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
SITEMAP = "https://www.lampe.de/sitemap.xml"
# Marke (URL-Präfix) → max. Anzahl Produktseiten
BRANDS = {
    "artemide": 120, "louis-poulsen": 20, "tecnolumen": 60, "serien-lighting": 130, "escale": 70, "knapstein": 10,
    "bopp": 90, "helestra": 15, "grossmann": 90, "faro": 40, "design-for-the-people": 200, "by-rydens": 170,
    "schoener-wohnen": 160, "hollaender": 160, "selene": 15, "cmd": 60, "fabas": 90, "ideal-lux": 110,
}
TYPES = ("tischleuchte", "tischlampe", "stehleuchte", "stehlampe", "deckenfluter", "pendelleuchte", "haengeleuchte",
         "deckenleuchte", "wandleuchte", "leseleuchte", "kronleuchter", "deckenlampe", "wandlampe")
EXCLUDE = ("aussen", "garten", "poller", "sockel", "wege", "solar", "leuchtmittel", "ersatz", "zubehoer", "baldachin",
           "kabel", "schiene", "netzteil", "fernbedienung", "einbau", "spot-", "strahler", "led-streifen", "bad-", "spiegel")


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "de-DE"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                return ""
            time.sleep(2 ** i)
        except Exception:
            time.sleep(2 ** i)
    return ""


def product_urls():
    idx = get(SITEMAP)
    urls = []
    for sm in re.findall(r"<loc>([^<]+)</loc>", idx):
        urls += re.findall(r"<loc>([^<]+)</loc>", get(sm))
    out = {}
    for u in urls:
        slug = u.rsplit("/", 1)[-1]
        if u.count("/") != 3 or not slug.endswith(".html"):
            continue
        brand = next((b for b in BRANDS if slug.startswith(b + "-")), None)
        if not brand or not any(t in slug for t in TYPES) or any(x in slug for x in EXCLUDE):
            continue
        out.setdefault(brand, []).append(u)
    sel = []
    for b, us in out.items():
        sel += sorted(us)[: BRANDS[b]]
    return sel


def parse(url, s):
    m = re.search(r'<script[^>]*ld\+json[^>]*>\s*(\{.*?"@type":\s*"Product".*?)</script>', s, re.S)
    if not m:
        return None
    try:
        ld = json.loads(m.group(1))
    except Exception:
        return None
    text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "|", s))
    attrs = {}
    for k, v in re.findall(r"\| ([A-ZÄÖÜ][\wäöüß /().-]{1,40}): \| \| ([^|]{1,90}?) \|", text):
        k, v = html.unescape(k.strip()), html.unescape(v.strip())
        if k not in attrs and v:
            attrs[k] = v
    img = ld.get("image") or {}
    return {
        "url": url, "name": ld.get("name"), "sku": ld.get("sku"), "brand": (ld.get("brand") or {}).get("name"),
        "price": (ld.get("offers") or {}).get("price"), "image": img.get("contentUrl") if isinstance(img, dict) else img,
        "attrs": attrs,
    }


def main():
    urls = product_urls()
    print(len(urls), "Produktseiten", file=sys.stderr)
    res = []
    with cf.ThreadPoolExecutor(6) as ex:
        for i, (u, s) in enumerate(zip(urls, ex.map(get, urls))):
            p = parse(u, s) if s else None
            if p:
                res.append(p)
            if i % 100 == 0:
                print(i, len(res), file=sys.stderr)
    out = pathlib.Path(__file__).parent / "data" / "lampe_products.json"
    out.write_text(json.dumps(res, ensure_ascii=False, indent=0))
    print(len(res), "Leuchten →", out, file=sys.stderr)


if __name__ == "__main__":
    main()
