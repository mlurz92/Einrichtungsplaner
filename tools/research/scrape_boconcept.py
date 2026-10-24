"""Liest die BoConcept-Esstische (Standardkonfiguration je Produktseite): Name, Preis, Bild (JSON-LD),
Datenblatt (Größe, Tischplatte, Bein, Form) und die Maßfelder der eingebetteten Produktdaten.
Aufruf: python3 -I scrape_boconcept.py <out.json>"""
import sys, re, json, html, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36"}
BASE = "https://www.boconcept.com"


def get(u):
    with urllib.request.urlopen(urllib.request.Request(u, headers=UA), timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def product(path):
    s = get(BASE + path)
    out = {"url": BASE + path}
    m = re.search(r'<script type="application/ld\+json">(\{"@context":"https://schema.org","@type":"Product".*?)</script>', s)
    if m:
        d = json.loads(m.group(1))
        out.update(name=d.get("name"), description=d.get("description"), image=d.get("image"), sku=d.get("sku"),
                   price=float((d.get("offers") or {}).get("price") or 0) or None)
    attrs = {}
    for a in re.finditer(r'AttributesSidebar-module__\w+__key">([^<]+)</p></dt><dd><ul>((?:<li><p[^>]*>[^<]*</p></li>)+)', s):
        attrs[html.unescape(a.group(1))] = [html.unescape(x) for x in re.findall(r">([^<]+)</p>", a.group(2))]
    out["attrs"] = attrs
    dims = {}
    for k in ("length", "width", "height", "depth", "diameter", "lengthExtendable", "heightToTabletop"):
        v = re.findall(r'\\"' + k + r'\\":\\"([^\\"]*\d[^\\"]*cm)\\"', s)
        if v:
            dims[k] = v[0]
    out["dims"] = dims
    return out


def main():
    s = get(BASE + "/de-de/shop/tische/esstische/")
    paths = sorted(set(re.findall(r'href="(/de-de/p/[^"]+)"', s)))
    res = [product(p) for p in paths]
    json.dump(res, open(sys.argv[1], "w"), ensure_ascii=False, indent=0)
    print("done", len(res))


if __name__ == "__main__":
    main()
