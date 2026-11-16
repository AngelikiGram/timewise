"""Collect the documented links between TIMEWISE's imported records from Wikidata.

For every record in apps/web/public/data/regions/*.json, asks the Wikidata Query Service which statements
of cause, effect, succession and composition connect it to other records. Only statements whose both ends
are TIMEWISE records are kept, so every story built from them has a date and a place for each step.

Writes data/generated/links.json: [{"from", "to", "prop", "refs"}], where "refs" counts the references
Wikidata gives for the statement. Run from the repository root: python scripts/link_harvest.py
"""
import json
import time
import urllib.parse
import urllib.request
from pathlib import Path

DATA = Path("apps/web/public/data/regions")
OUT = Path("data/generated/links.json")
ENDPOINT = "https://query.wikidata.org/sparql"
HEADERS = {"User-Agent": "TimewiseLinkHarvest/0.1 (educational history project)", "Accept": "application/sparql-results+json"}
# has cause, has immediate cause, has effect, follows, followed by, replaces, replaced by, part of, significant event
PROPS = ["P828", "P1478", "P1542", "P155", "P156", "P1365", "P1366", "P361", "P793"]
BATCH = 400

ids = set()
for f in DATA.glob("*.json"):
    if f.name.endswith(".boundary.json"):
        continue
    for e in json.loads(f.read_text("utf-8")).get("events", []):
        if e["id"].startswith("Q"):
            ids.add(e["id"])
ids = sorted(ids, key=lambda q: int(q[1:]))
print(len(ids), "records")

edges = {}
for i in range(0, len(ids), BATCH):
    chunk = ids[i:i + BATCH]
    query = f"""SELECT ?a ?p ?b (COUNT(DISTINCT ?ref) AS ?refs) WHERE {{
  VALUES ?a {{ {' '.join('wd:' + q for q in chunk)} }}
  VALUES ?p {{ {' '.join('p:' + p for p in PROPS)} }}
  ?a ?p ?st . ?st wikibase:rank ?rank . FILTER(?rank != wikibase:DeprecatedRank)
  ?prop wikibase:claim ?p ; wikibase:statementProperty ?ps .
  ?st ?ps ?b .
  OPTIONAL {{ ?st prov:wasDerivedFrom ?ref }}
}} GROUP BY ?a ?p ?b"""
    for attempt in range(4):
        try:
            req = urllib.request.Request(ENDPOINT, data=urllib.parse.urlencode({"query": query}).encode(), headers=HEADERS)
            with urllib.request.urlopen(req, timeout=90) as r:
                rows = json.load(r)["results"]["bindings"]
            break
        except Exception as err:  # rate limits and timeouts: wait and retry
            print("retry", i, err)
            time.sleep(10 * (attempt + 1))
    else:
        print("gave up on batch", i)
        continue
    for row in rows:
        a = row["a"]["value"].rsplit("/", 1)[1]
        b = row["b"]["value"].rsplit("/", 1)[1]
        p = row["p"]["value"].rsplit("/", 1)[1]
        if b.startswith("Q") and a != b:
            edges[(a, b, p)] = int(row["refs"]["value"])
    print(f"{min(i + BATCH, len(ids))}/{len(ids)} records, {len(edges)} statements")
    time.sleep(1)

idset = set(ids)
kept = [{"from": a, "to": b, "prop": p, "refs": r} for (a, b, p), r in edges.items() if b in idset]
OUT.write_text(json.dumps(kept, indent=0), "utf-8")
print(len(kept), "links between TIMEWISE records written to", OUT)
