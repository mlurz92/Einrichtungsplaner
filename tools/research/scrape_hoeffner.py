"""Liest Höffner-Esstische (Listenseiten + Artikelseiten) und wählt längliche Tische mit Marmor-, Travertin-,
Keramik- oder Steinplatte bzw. Marmoroptik aus.

Listenseite je Artikel: Name, Maßzeile, Preis (Kundenkartenpreis und regulärer Preis), Highlights.
Artikelseite: Maße (Breite/Tiefe/Höhe bzw. Länge), Merkmale (Material, Farbe, Form), Bild, Lieferzeit.
Aufruf: python3 -I scrape_hoeffner.py <out.json>"""
import sys, re, json, html, urllib.request
import concurrent.futures as cf

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36", "Accept-Encoding": "identity"}
BASE = "https://www.hoeffner.de"
LISTS = ["esstische", "esstische-rechteckig", "esstisch-ausziehbar"]
STONE = re.compile(r"marmor|travertin|keramik|sinterstein|naturstein|\bstein|quarz|granit", re.I)


def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def text(s):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<!--.*?-->|<[^>]+>", " ", s))).strip()


def price_of(block, testid):
    m = re.search(rf'data-testid="{testid}">(.*?)</span></span>', block, re.S)
    if not m:
        return None
    t = text(m.group(1)).replace(" ", "").replace("€", "").replace(".", "").replace(",", ".")
    try:
        return float(t)
    except ValueError:
        return None


def listing(slug):
    out = {}
    for page in range(1, 60):
        try:
            s = get(f"{BASE}/{slug}" + (f"/{page}" if page > 1 else ""))
        except Exception as e:
            print("list err", slug, page, e, flush=True)
            break
        cards = re.findall(r'<article data-testid="p-id-(\d+)".*?</article>', s, re.S)
        blocks = re.findall(r'(<article data-testid="p-id-\d+".*?</article>)', s, re.S)
        new = 0
        for aid, b in zip(cards, blocks):
            if aid in out:
                continue
            name = text((re.search(r'data-testid="article-name"[^>]*>(.*?)</h3>', b, re.S) or [None, ""])[1])
            dims = text((re.search(r'<h3 .*?</h3><p [^>]*>(.*?)</p>', b, re.S) or [None, ""])[1])
            hl = [text(x) for x in re.findall(r'<li class="[^"]*">(.*?)</li>', b, re.S)]
            out[aid] = {"id": aid, "url": f"{BASE}/artikel/{aid}", "name": name, "dimsLine": dims, "highlights": hl,
                        "price": price_of(b, "disp") or price_of(b, "orgp"), "listPrice": price_of(b, "orgp"), "list": slug}
            new += 1
        print(slug, page, len(cards), new, flush=True)
        if not cards or not new:
            break
    return out


def detail(p):
    try:
        s = get(p["url"])
    except Exception as e:
        return dict(p, err=str(e))
    d = dict(p)
    m = re.search(r'<meta property="og:image" content="([^"]+)"', s)
    d["image"] = m.group(1) if m else None
    m = re.search(r'<meta property="og:title" content="([^"]+)"', s)
    d["title"] = html.unescape(m.group(1)) if m else None
    m = re.search(r'itemprop="price" content="([\d.]+)"|"price" content="([\d.]+)"', s)
    if m:
        d["price"] = float(m.group(1) or m.group(2))
    # Datenblatt (eingebettetes JSON): {"label": "...", "values": ["..."]} je Zeile der Abschnitte Maße, Merkmale, Material & Farbe
    specs = {}
    for m in re.finditer(r'\\"label\\":\\"([^"\\]+)\\",\\"values\\":\[((?:\\"[^"\\]*\\",?)+)\]', s):
        specs.setdefault(html.unescape(m.group(1)), ", ".join(re.findall(r'\\"([^"\\]*)\\"', m.group(2))))
    d["specs"] = specs
    m = re.search(r'<meta name="description" content="([^"]+)"', s)
    d["description"] = html.unescape(m.group(1)) if m else None
    return d


def main():
    items = {}
    for slug in LISTS:
        for k, v in listing(slug).items():
            items.setdefault(k, v)
    def length(p):
        m = re.search(r"BHL [\d,]+\|[\d,]+\|([\d,]+)", p["dimsLine"])
        return float(m.group(1).replace(",", ".")) if m else 0
    longs = [p for p in items.values() if length(p) >= 150 or STONE.search(" ".join([p["name"]] + p["highlights"]))]
    with cf.ThreadPoolExecutor(6) as ex:
        det = list(ex.map(detail, longs))
    res = [p for p in det if STONE.search(" ".join([p["name"], p.get("description") or ""] + p["highlights"] + [v for k, v in p.get("specs", {}).items() if "Material" in k or "Farbe" in k]))]
    print("Esstische", len(items), "lang/Stein", len(longs), "mit Stein/Marmor/Keramik", len(res), flush=True)
    json.dump(res, open(sys.argv[1], "w"), ensure_ascii=False, indent=0)
    print("done", len(res))


if __name__ == "__main__":
    main()
