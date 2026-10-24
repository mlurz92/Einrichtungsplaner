"""Liest das komplette DELIFE-Sortiment (delife.de, Shopware 6) mit allen Ausführungen.

Quelle: Produkt-Sitemap (jede Ausführung hat eine eigene Artikelseite /a-<Artikelnr.>).
Je Artikelseite: JSON-LD (Name, Artikelnr., Preis, Verfügbarkeit, Maße, Farbe, Kategorie, Bilder, Brotkrumen),
Eltern-ID der Produktfamilie (Variantenwechsel-URL), Ausführungs-Wähler (Gruppen wie Farbe, Größe, Gestellfarbe mit
gewählter Option, Farbwert bzw. Musterbild und Verfügbarkeit) und „Alle Produktdetails im Überblick“
(Produktmaße, Produktmaterial, Produktfarbe, Oberfläche, Weitere Details).
Aufruf: python3 -I scrape_delife.py <out.json>   (THREADS=16, LIMIT=n zum Testen)"""
import sys, os, re, json, html, gzip, time, urllib.request
import concurrent.futures as cf

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36", "Accept-Encoding": "gzip"}
BASE = "https://www.delife.de"


def get(u, tries=4):
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
                b = r.read()
                if r.headers.get("Content-Encoding") == "gzip" or b[:2] == b"\x1f\x8b":
                    b = gzip.decompress(b)
                return b.decode("utf-8", "replace")
        except urllib.error.HTTPError as e:
            if e.code in (404, 410):
                return None
            time.sleep(2 ** k)
        except Exception:
            time.sleep(2 ** k)
    return None


def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<!--.*?-->|<[^>]+>", " ", s or ""))).strip()


def sitemap():
    idx = get(f"{BASE}/sitemap.xml")
    urls = []
    for sm in re.findall(r"<loc>([^<]+\.xml(?:\.gz)?)</loc>", idx):
        urls += re.findall(r"<loc>([^<]+)</loc>", get(sm) or "")
    return [u for u in dict.fromkeys(urls) if re.search(r"/a-[0-9][\w-]*/?$", u)]


def configurator(s):
    """Gruppen des Ausführungs-Wählers: [{name, value, options:[{id, title, hex, img, available}]}]."""
    i = s.find('class="product-detail-configurator-container"')
    if i < 0:
        return None, []
    j = s.find('class="product-detail-configurator-modal', i)
    blk = s[i:j if j > 0 else i + 400000]
    parent = (re.search(r"detail\\/([0-9a-f]{32})\\/switch", blk) or re.search(r"/detail/([0-9a-f]{32})/switch", blk) or [None, None])[1]
    groups = []
    for g in re.split(r'<fieldset class="product-detail-configurator-group', blk)[1:]:
        head = re.search(r'class="accordion-button[^"]*"[^>]*>(.*?)<div class="product-detail-configurator-group-value">(.*?)</div>', g, re.S)
        if not head:
            head = re.search(r'product-detail-configurator-group-title[^>]*>(.*?)</', g, re.S)
            name, value = text(head.group(1)) if head else "", ""
        else:
            name, value = text(head.group(1)).rstrip(" /"), text(head.group(2))
        opts = []
        for m in re.finditer(r'<input\s+type="radio"\s+name="([0-9a-f]+)"\s+value="([0-9a-f]+)"\s+class="([^"]*)"([^>]*)>\s*<label\s+class="([^"]*)"\s+title="([^"]*)"(.*?)</label>', g, re.S):
            body = m.group(7)
            hexm = re.search(r"background-color:\s*(#[0-9a-fA-F]{3,6})", body)
            img = re.search(r'data-custom-src="([^"]+)"', body) or re.search(r'<img[^>]+src="([^"]+)"', body)
            opts.append({"id": m.group(2), "title": html.unescape(m.group(6)), "hex": hexm.group(1).lower() if hexm else None,
                         "img": img.group(1).split("?")[0] if img else None, "available": "is-combinable" in m.group(3),
                         "checked": "checked" in m.group(4)})
        if not value:
            value = next((o["title"] for o in opts if o["checked"]), "")
        groups.append({"name": name, "value": value, "options": opts})
    return parent, groups


def details(s):
    """„Alle Produktdetails im Überblick“ → {Abschnitt: [Zeilen]}."""
    i = s.find("Alle Produktdetails im Überblick")
    if i < 0:
        m = re.search(r"<h3[^>]*>(?:\s|<br\s*/?>)*Produktma(?:ß|ss)e", s)
        if not m:
            return {}
        i = m.start()
    j = s.find('class="tab-pane', i)
    blk = s[i:j if j > 0 else i + 20000]
    out = {}
    parts = re.split(r"<h3[^>]*>(.*?)</h3>", blk, flags=re.S)
    for head, body in zip(parts[1::2], parts[2::2]):
        lines = [text(li) for li in re.findall(r"<li[^>]*>(.*?)</li>", body, re.S)]
        if not lines:
            lines = [text(x) for x in re.split(r"<br\s*/?>|</p>", body)]
        out[text(head).rstrip(":")] = [x for x in lines if x]
    return out


def product(u):
    s = get(u)
    if not s:
        return None
    ld = None
    crumbs = []
    for m in re.finditer(r'<script type="application/ld\+json">(.*?)</script>', s, re.S):
        try:
            d = json.loads(m.group(1))
        except Exception:
            continue
        for x in d if isinstance(d, list) else [d]:
            if x.get("@type") == "Product":
                ld = x
            elif x.get("@type") == "BreadcrumbList":
                crumbs = [e.get("name") for e in x.get("itemListElement", [])]
    if not ld:
        return None
    parent, groups = configurator(s)
    off = ld.get("offers") or {}
    if isinstance(off, list):
        off = off[0] if off else {}
    q = lambda k: (ld.get(k) or {}).get("value") if isinstance(ld.get(k), dict) else None
    list_price = None
    lp = re.search(r'class="list-price-price">\s*([\d.]+,\d+)', s)
    if lp:
        list_price = float(lp.group(1).replace(".", "").replace(",", "."))
    imgs = ld.get("image") or []
    if isinstance(imgs, str):
        imgs = [imgs]
    return {
        "sku": str(ld.get("sku")), "url": ld.get("url") or u, "name": html.unescape(ld.get("name") or ""), "parent": parent,
        "brand": (ld.get("brand") or {}).get("name"), "color": ld.get("color"), "category": ld.get("category"), "crumbs": crumbs,
        "price": off.get("price"), "listPrice": list_price, "availability": (off.get("availability") or "").rsplit("/", 1)[-1],
        "w": q("width"), "d": q("depth"), "h": q("height"), "weight": q("weight"),
        "images": [x.split("?")[0] for x in imgs[:4]], "groups": groups, "details": details(s),
    }


def main(out):
    urls = sitemap()
    if os.environ.get("LIMIT"):
        urls = urls[: int(os.environ["LIMIT"])]
    print("Artikelseiten:", len(urls), flush=True)
    rows, t0 = [], time.time()
    with cf.ThreadPoolExecutor(int(os.environ.get("THREADS", "16"))) as ex:
        for n, r in enumerate(ex.map(product, urls), 1):
            if r:
                rows.append(r)
            if n % 250 == 0:
                print(n, len(rows), f"{time.time() - t0:.0f}s", flush=True)
    data = compact(rows)
    json.dump(data, open(out, "w"), ensure_ascii=False, separators=(",", ":"))
    print("gespeichert", len(data["rows"]), "Ausführungen,", len(data["families"]), "Familien", flush=True)


def compact(rows):
    """Optionen des Ausführungs-Wählers je Familie einmal speichern (Vereinigung aller Seiten), je Ausführung nur die Auswahl."""
    fams = {}
    for r in rows:
        key = r["parent"] or r["sku"]
        r["family"] = key
        f = fams.setdefault(key, {})
        sel = {}
        for g in r.pop("groups"):
            sel[g["name"]] = g["value"]
            opts = f.setdefault(g["name"], {})
            for o in g["options"]:
                q = opts.setdefault(o["title"], {k: o[k] for k in ("hex", "img") if o.get(k)})
                if o["available"] or o["checked"]:
                    q["seen"] = True
        r["sel"] = sel
        r.pop("parent", None)
        # Werbetexte und Versandmaße entfallen; Maß-, Material- und Farbangaben bleiben
        r["details"] = {k: [x for x in v if len(x) <= 160] for k, v in r["details"].items() if k not in ("Versandverpackung",)}
    rows.sort(key=lambda r: (r["family"], r["sku"]))
    return {"source": "delife.de (Sitemap, Artikelseiten), Stand " + time.strftime("%d.%m.%Y"), "families": fams, "rows": rows}


if __name__ == "__main__":
    main(sys.argv[1])
