"""Liest Esstische mit Stein-, Keramik-, Dekton-, Marmor- oder Schieferplatte aus dem Online-Shop von Möbel Letz
(online-moebel-kaufen.de; Markenhersteller wie Venjakob, Musterring, KOINOR, connubia by calligaris, Akante, bert plantagie).

Kategorie Esstische → alle Markenlisten → Produktkarten (Name, Link). Artikelseite: Preis, Maße (Breite/Höhe/Tiefe),
Ausführungstext (Tischplatte, Gestell/Beine), Größen-/Farboptionen und Produktbilder.
Aufruf: python3 -I scrape_letz.py <out.json>"""
import sys, re, json, html, urllib.request
import concurrent.futures as cf

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"}
BASE = "https://online-moebel-kaufen.de/shop/"
STONE = re.compile(r"keramik|stein|marmor|granit|quarz|dekton|travertin|schiefer", re.I)


def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def lines(s):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", "", s, flags=re.S)
    t = html.unescape(re.sub(r"<[^>]+>", "\n", t))
    return [x.strip() for x in t.split("\n") if x.strip()]


def listing():
    s = get(BASE + "Esszimmer/Esstische:::37_209.html")
    brands = sorted(set(l for l in re.findall(r'href="([^"]+)"', s) if ":::37_209_" in l))
    out = {}

    def one(u):
        res = {}
        for page in range(1, 8):
            try:
                s = get(u if page == 1 else u.replace(".html", f".html?page={page}"))
            except Exception:
                break
            new = 0
            for m in re.finditer(r'href="(https://online-moebel-kaufen.de/shop/Esszimmer/Esstische/[^"]+::(\d+)\.html)" class="card_anker.*?alt="([^"]+)"', s, re.S):
                if m.group(2) not in res:
                    res[m.group(2)] = {"id": m.group(2), "url": m.group(1), "name": html.unescape(m.group(3)).strip()}
                    new += 1
            if not new:
                break
        return res

    with cf.ThreadPoolExecutor(8) as ex:
        for r in ex.map(one, brands):
            out.update(r)
    return out


def detail(p):
    try:
        s = get(p["url"])
    except Exception as e:
        return dict(p, err=str(e))
    d = dict(p)
    L = lines(s)
    # Shoppreis der abgebildeten Ausführung (itemprop price; „unser Preis“ kommt auch in Querverweisen vor)
    m = re.search(r'itemprop="price"[^>]*content="([\d.]+)"', s)
    d["price"] = float(m.group(1)) if m else None
    k = [j for j, x in enumerate(L) if x == "Produktbeschreibung"]
    d["text"] = L[k[-1]:k[-1] + 120] if k else []
    dims = {}
    for i, x in enumerate(L):
        if x in ("Breite", "Höhe", "Tiefe", "Länge", "Durchmesser") and i + 1 < len(L) and re.match(r"^[\d.,\-–/ ]+$", L[i + 1]):
            dims.setdefault(x, L[i + 1])
    d["dims"] = dims
    d["spec"] = [x for x in L if re.match(r"^(Tischplatte|Gestell|Beine|Fuß|Füße|Säule|Kufen|Auszugsplatten|Klappverlängerung|Wangen|Rahmen|Zarge|Platte)\b.*:", x)]
    d["bht"] = [x for x in L if "BHT ca." in x or "BHT ca" in x][:3]
    d["options"] = [html.unescape(o).strip() for o in re.findall(r'value="\d+" >([^<]+)', s)]
    d["images"] = sorted(set(re.findall(r"/shop/images/product_images/info_images/" + p["id"] + r"_\d+\.jpg", s)))
    d["images"] = ["https://online-moebel-kaufen.de" + x for x in d["images"]]
    d["title"] = (re.search(r"<title>(.*?)</title>", s, re.S) or [None, ""])[1].strip()
    return d


# Tische ohne Materialangabe im Namen (connubia Master in Keramik Arenaria)
EXTRA = ["Esszimmer/Esstische/calligaris/Master-von-connubia-by-calligaris-Esstisch-ca-200-x-100-cm::106174.html"]
# Zu den Tischen passende Stühle derselben Hersteller (Mobitec Aura/Cosy)
CHAIRS = ["Esszimmer/Stuehle/Mobitec/Aura-von-Mobitec-Polsterstuhl-im-modernen-Design::58285.html",
          "Esszimmer/Stuehle/Mobitec/Aura-von-Mobitec-Stuhl-in-Grau-mit-Armlehnen::58353.html",
          "Esszimmer/Stuehle/Mobitec/Cosy-von-Mobitec-Stuhl-mit-Armlehnen-in-Steel::47851.html"]


def main():
    out = sys.argv[1] if len(sys.argv) > 1 else "letz_products.json"
    items = [p for p in listing().values() if STONE.search(p["name"] + p["url"])]
    items += [{"id": c.split("::")[1].split(".")[0], "url": BASE + c, "name": c.split("/")[-1].split("::")[0].replace("-", " ")} for c in EXTRA]
    items += [{"id": c.split("::")[1].split(".")[0], "url": BASE + c, "name": c.split("/")[-1].split("::")[0].replace("-", " "), "kind": "chair"} for c in CHAIRS]
    print(len(items), "Stein-/Keramiktische", flush=True)
    with cf.ThreadPoolExecutor(8) as ex:
        res = list(ex.map(detail, items))
    json.dump(res, open(out, "w"), ensure_ascii=False, indent=1)
    print("geschrieben", out, len(res))


if __name__ == "__main__":
    main()
