"""Ergänzt fehlende IKEA-Maße über die Produktseite (JSON "measurements").
Aufruf: python3 -I enrich_ikea.py <ikea_products.json> <out_dims.json>"""
import sys, json, re, time, urllib.request
sys.path.insert(0, sys.argv[3]) if len(sys.argv) > 3 else None
from build_catalog import ikea_cat  # noqa: E402

prods = json.load(open(sys.argv[1]))
out = {}
try:
    out = json.load(open(sys.argv[2]))
except Exception:
    pass
todo = []
for p in prods:
    cat = ikea_cat(p.get("type"))
    if not cat or cat in ("plant", "decor", "textile", "art", "curtain", "rug"):
        continue
    n = re.findall(r"\d+", p.get("measure") or "")
    if len(n) >= 3 and "Ø" not in (p.get("measure") or ""):
        continue
    if p["itemNo"] in out:
        continue
    todo.append(p)
print("todo", len(todo), flush=True)
for i, p in enumerate(todo):
    try:
        req = urllib.request.Request(p["url"], headers={"User-Agent": "Mozilla/5.0"})
        s = urllib.request.urlopen(req, timeout=60).read().decode("utf-8", "replace")
        m = re.search(r'"measurements":(\[\{"measure".*?\}\])', s)
        if m:
            out[p["itemNo"]] = {d["name"]: d["measure"] for d in json.loads(m.group(1))}
        else:
            out[p["itemNo"]] = {}
    except Exception as e:
        out[p["itemNo"]] = {"err": str(e)}
    if i % 20 == 0:
        json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False)
        print(i, flush=True)
    time.sleep(0.25)
json.dump(out, open(sys.argv[2], "w"), ensure_ascii=False)
print("done", len(out))
