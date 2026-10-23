"""Tylko-Produkte (Feed) über moebel.ladendirekt.de sammeln.

tylko.com selbst liegt hinter einer Cloudflare-Abfrage; der offizielle Produkt-Feed
von Tylko wird jedoch vom Preisportal ladendirekt mit Maßen (B/H/T), Preis, Farbe,
Bild (media.tylko.com) und Beschreibung als schema.org-JSON-LD ausgeliefert.
Ausgabe: data/tylko_products.json
"""
import json, re, sys, time, urllib.request, pathlib

BASE = "https://moebel.ladendirekt.de/"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36"
CATS = [
    "wohnzimmer/regale/buecherregale", "wohnzimmer/regale/einzelregale", "wohnzimmer/regale/haengeregale",
    "wohnzimmer/regale/raumteiler", "wohnzimmer/regale/regalsysteme", "wohnzimmer/regale/regalwuerfel",
    "wohnzimmer/schraenke/haengeschraenke", "wohnzimmer/schraenke/highboards", "wohnzimmer/schraenke/kommoden",
    "wohnzimmer/schraenke/lowboards", "wohnzimmer/schraenke/sideboards", "wohnzimmer/schraenke/weitere-schraenke",
    "wohnzimmer/schraenke/wohnwaende", "wohnzimmer/tv-hifi-moebel/tv-lowboards", "wohnzimmer/tv-hifi-moebel/tv-schraenke",
    "wohnzimmer/tv-hifi-moebel/tv-racks", "wohnzimmer/tv-hifi-moebel/cd-dvd-regale", "wohnzimmer/tv-hifi-moebel/hifi-racks",
    "wohnzimmer/vitrinen/standvitrinen", "wohnzimmer/tische/konsolentische", "wohnzimmer/tische/couchtische",
    "wohnzimmer/sofas/2-und-3-sitzer-sofas", "wohnzimmer/sofas/bigsofas", "wohnzimmer/sofas/ecksofas-eckcouches",
    "wohnzimmer/sofas/recamieren", "wohnzimmer/sofas/wohnlandschaften", "wohnzimmer/sessel/loungesessel",
    "wohnzimmer/hocker-und-poufs/polsterhocker", "wohnzimmer/hocker-und-poufs/poufs",
    "schlafzimmer/kleiderschraenke/drehtuerenschraenke", "schlafzimmer/kleiderschraenke/ordnungssysteme",
    "schlafzimmer/kleiderschraenke/schwebetuerenschraenke", "schlafzimmer/kommoden/nachttischkommoden",
    "schlafzimmer/kommoden/waeschekommode", "buero/tische/schreibtische", "buero/regale/regalsysteme",
    "buero/regale/standregale", "buero/schraenke/aktenschraenke", "buero/schraenke/container",
    "kinderzimmer/jugendzimmer/schraenke", "kinderzimmer/tische/schreibtische",
]


# Der Feed enthält je Kategorie bis zu ~2.000 Konfigurationen (84 je Seite); für den Katalog genügt
# eine repräsentative Auswahl, die build_catalog.py weiter nach Typ/Farbe/Größe ausdünnt.
MAX_PAGES = 6


def get(url):
    for i in range(4):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "de-DE"})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.status, r.read().decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return 404, ""
            time.sleep(2 ** i)
        except Exception:
            time.sleep(2 ** i)
    return 0, ""


def products(html):
    out = []
    for m in re.finditer(r'<script[^>]*application/ld\+json[^>]*>(.*?)</script>', html, re.S):
        try:
            d = json.loads(m.group(1))
        except Exception:
            continue
        me = d.get("mainEntity") if isinstance(d, dict) else None
        if not me:
            continue
        for el in me.get("itemListElement", []):
            it = el.get("item", {})
            if (it.get("brand") or {}).get("name", "").lower() == "tylko":
                out.append(it)
    return out


def main():
    res = {}
    for c in CATS:
        page = 1
        while True:
            url = f"{BASE}{c}/tylko/" + (f"?page_no={page}" if page > 1 else "")
            st, html = get(url)
            ps = products(html) if st == 200 else []
            new = [p for p in ps if p["productID"] not in res]
            for p in ps:
                res.setdefault(p["productID"], {
                    "productID": p["productID"], "name": p.get("name", "").strip(), "description": p.get("description"), "sku": p.get("sku"),
                    "keywords": p.get("keywords"), "url": p.get("url"), "image": p.get("image"), "color": p.get("color"),
                    "offers": {"price": (p.get("offers") or {}).get("price")}, "_cat": c,
                })
            print(c, page, st, len(ps), len(new), file=sys.stderr)
            if not new or page >= MAX_PAGES:
                break
            page += 1
            time.sleep(0.5)
    out = pathlib.Path(__file__).parent / "data" / "tylko_products.json"
    out.write_text(json.dumps(list(res.values()), ensure_ascii=False, separators=(",", ":")))
    print(len(res), "Produkte →", out, file=sys.stderr)


if __name__ == "__main__":
    main()
