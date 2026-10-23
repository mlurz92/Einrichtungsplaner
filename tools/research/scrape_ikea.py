"""IKEA-Produktsuche (öffentliche Such-API von ikea.com/de) für ausgewählte Serien/Kategorien.
Aufruf: python3 -I scrape_ikea.py <out.json>"""
import sys, json, time, urllib.request, urllib.parse

Q = [
 # Premium-/Designserien Sofas & Sessel
 "STOCKHOLM 2025", "SÖDERHAMN", "VALNÄS", "LILLESÄTER", "JÄTTEBO", "LANDSKRONA", "VIMLE", "KIVIK", "EKERÖ", "STRANDMON",
 "KOARP", "LINANÄS", "GULLVALLA", "ESSEBODA", "PERSBOL", "TOLKNING", "SKOGSKORN", "KLIPPAN", "UPPLAND", "FINNALA",
 # Tische, Stühle
 "LISABO", "EKEDALEN", "MÖCKELBY", "SKOGSTA", "INGATORP", "DOCKSTA", "STRANDTORP", "VEDBO", "KRYLBO", "BERGMUND",
 "LISABO Stuhl", "ODGER", "KARLPETTER", "ÄLVSTA", "SANDSBERG", "PINNTORP", "TOSSBERG", "SKANSNÄS",
 # Couch-/Beistelltische
 "STOCKHOLM Couchtisch", "LISTERBY", "VITTSJÖ", "ARKELSTORP", "HEMNES Couchtisch", "GLADOM", "BJÖRKSNÄS", "SKOGSTA Couchtisch",
 # Stauraum
 "BESTÅ", "TONSTAD", "STOCKHOLM Sideboard", "IDANÄS", "HAUGA", "HEMNES", "BJÖRKSNÄS", "BAGGEBO", "KALLAX", "BILLY",
 "HAVSTA", "FABRIKÖR", "MALSJÖ", "OXBERG", "BERGSBO", "PAX", "PAX Kleiderschrank", "BOAXEL", "BISSA",
 # Schlafen
 "SLATTUM", "TUFJORD", "GLADSTAD", "IDANÄS Bett", "HAUGA Bett", "HEMNES Bett", "MALM Bett", "BRIMNES", "NORDLI",
 "VADHEIM", "SÄBÖVIK", "DUNVIK", "ÅKREHAMN", "TONSTAD Nachttisch", "STOCKHOLM Nachttisch",
 # Arbeiten
 "MITTZON", "IDÅSEN", "TROTTEN", "HATTEFJÄLL", "MILLBERGET", "LÅNGFJÄLL", "ALEX", "MICKE",
 # Leuchten
 "PS 2014", "VINDKAST", "KNIXHULT", "SOLKLINT", "BLÅSVERK", "PILBLAD", "TOKABO", "NYMÅNE", "SIMRISHAMN", "VARMBLIXT",
 "HEKTAR", "ÅRSTID", "LAUTERS", "RINGSTA", "TÄRNABY", "KUNGSHULT", "GÅSGRUND", "FADO", "PILSKOTT", "STOCKHOLM Leuchte",
 "SKURUP", "MOLNART", "DEJSA", "VIKARBYN",
 # Teppiche, Textil, Deko, Spiegel
 "STOCKHOLM Teppich", "VINDUM", "LOHALS", "ÅDUM", "LANGSTED", "SÖLLINGE", "BRÖNDEN", "ALVINE", "TIBAST", "SILVERLÖNN",
 "HANNALENA", "SANELA", "DYTÅG", "FJÄDRAR", "VIDGA", "LINDBYN", "STOCKHOLM Spiegel", "IKORNNES", "NISSEDAL",
 "FEJKA", "VILJESTARK", "BJÖRKSTA", "PJÄTTERYD", "KNOPPÄNG",
 # Outdoor
 "SEGERÖN", "ÄPPLARÖ", "NÄMMARÖ", "FALHOLMEN", "HÅMÖ", "SOLLERÖN",
]

def search(q, size=40):
    u = "https://sik.search.blue.cdtapps.com/de/de/search-result-page?" + urllib.parse.urlencode({"q": q, "size": size, "types": "PRODUCT"})
    with urllib.request.urlopen(urllib.request.Request(u, headers={"User-Agent": "Mozilla/5.0"}), timeout=60) as r:
        d = json.loads(r.read())
    out = []
    for it in d["searchResultPage"]["products"]["main"]["items"]:
        p = it.get("product") or {}
        if not p:
            continue
        sp = p.get("salesPrice") or {}
        out.append({
            "itemNo": p.get("itemNo"), "name": p.get("name"), "type": p.get("typeName"),
            "measure": p.get("itemMeasureReferenceText"), "price": sp.get("numeral"),
            "url": p.get("pipUrl"), "image": p.get("mainImageUrl"),
            "colors": [(c.get("name"), c.get("hex")) for c in p.get("colors") or []],
            "filterClass": p.get("filterClass"), "query": q,
            "variantDesc": (p.get("gprDescription") or {}).get("variants"),
        })
    return out

res, seen = [], set()
for q in Q:
    try:
        for p in search(q):
            if p["itemNo"] not in seen:
                seen.add(p["itemNo"]); res.append(p)
    except Exception as e:
        print("err", q, e, flush=True)
    time.sleep(0.25)
json.dump(res, open(sys.argv[1], "w"), ensure_ascii=False, indent=0)
print("done", len(res))
