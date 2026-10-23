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
 # Erweiterung (Designserien, Massivholz, Polster)
 "ÄPPLARYD", "HYLTARP", "SMEDSTORP", "LILLEHEM", "BACKSÄLEN", "MORABO", "FÄRLÖV", "NORSBORG", "GRÖNLID", "PÄRUP",
 "EKENÄSET", "FAGERBACKEN", "LINNEBÄCK", "POÄNG", "VEDBO", "STOCKHOLM Sessel", "STOCKHOLM Tisch", "MÖRBYLÅNGA",
 "VOXLÖV", "TOMMARYD", "KRAGSTA", "BORGEBY", "LISTERBY Beistelltisch", "STOLJAN", "LIDÅS", "TOSSBERG Stuhl",
 "FJÄLLBO", "VIHALS", "LOMMARP", "SKRUVBY", "STUDSVIK", "VEBERÖD", "EKET", "IVAR", "HEMNES Sideboard", "IDANÄS Sideboard",
 "BJÖRKSNÄS Sideboard", "STOCKHOLM Vitrine", "KLEPPSTAD", "SONGESAND", "NEIDEN", "BJÖRKSNÄS Bett", "STOCKHOLM Bett",
 "MÅLSKYTT", "TOKABO Tischleuchte", "BRUNSTA", "STRANDMON Ohrensessel", "SKOTTORP", "PILBLAD Stehleuchte", "VINDKAST Leuchte",
 "STOCKHOLM 2025 Leuchte", "STOCKHOLM 2025 Teppich", "STOCKHOLM 2025 Sofa", "STOCKHOLM 2025 Tisch", "STOCKHOLM 2025 Sessel",
 "PS 2026", "BRÄNNBOLL", "TONSTAD Sideboard", "TONSTAD Bett", "HAUGA Kommode", "IDANÄS Kommode", "HEMNES Kommode",
 "SANDSBERG Tisch", "EKEDALEN Ausziehtisch", "INGATORP Ausziehtisch", "SKOGSTA Tisch", "MÖCKELBY Tisch",
 "ODGER Stuhl", "KARLPETTER Stuhl", "BERGMUND Stuhl", "KRYLBO Stuhl", "LISABO Couchtisch", "VITTSJÖ Regal",
]

def search(q, size=72):
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
            # Ausführung (z. B. „Gunnared beige“, „Eichenfurnier“) steht in den Bild-Alttexten „NAME Typ, …/Ausführung“
            "alts": [i.get("altText") for i in p.get("allProductImage") or [] if (i.get("altText") or "").startswith(p.get("name") or "~")][:2],
            "variants": [{
                "itemNo": v.get("itemNo"), "url": v.get("pipUrl"), "image": v.get("mainImageUrl"), "alt": v.get("imageAlt"),
                "type": v.get("typeName"), "measure": v.get("itemMeasureReferenceText"), "price": (v.get("salesPrice") or {}).get("numeral"),
                "colors": [(c.get("name"), c.get("hex")) for c in v.get("colors") or []],
            } for v in ((p.get("gprDescription") or {}).get("variants") or [])],
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
