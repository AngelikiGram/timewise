"""Build the small connected collection behind the four ways to explore: a few lives, a few "things",
and the records that tie them to places and years.

Everything comes from Wikidata at build time, and every fact keeps the statement it came from, so the site
never shows a claim without a source. People and topics are found by name and then checked (a human born in
the expected years; the item with that exact label and the most sitelinks); the chosen QID and Wikidata's
own description are written out as evidence of the match. Nothing is written by hand.

Uses the Wikidata API (entity lookups and statement search), not the query service, so it keeps working
when the query service is rate-limited.

Writes data/generated/explore.json. Run from the repository root: python scripts/explore_collection.py
"""
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path("data/generated/explore.json")
WD = "https://www.wikidata.org/w/api.php"
COMMONS = "https://commons.wikimedia.org/w/api.php"
UA = {"User-Agent": "TimewiseExploreCollection/0.2 (educational history project)"}

# Name, and the years the person's birth must fall in: only a check that the right person was found.
PEOPLE = [
    ("Otto Wagner", 1835, 1845), ("Adolf Loos", 1865, 1875), ("Josef Hoffmann", 1865, 1875),
    ("Joseph Maria Olbrich", 1862, 1872), ("Koloman Moser", 1863, 1873), ("Gustav Klimt", 1857, 1867),
    ("Egon Schiele", 1885, 1895), ("Sigmund Freud", 1851, 1861), ("Alfred Adler", 1865, 1875),
    ("Gustav Mahler", 1855, 1865), ("Alma Mahler", 1874, 1884), ("Arnold Schoenberg", 1869, 1879),
    ("Karl Lueger", 1839, 1849), ("Bertha von Suttner", 1838, 1848), ("Arthur Schnitzler", 1857, 1867),
    ("Lise Meitner", 1873, 1883),
]
# kind "style": items whose architectural style (P149) is it, or a style that is a kind of it (P279).
# kind "class": items that are an instance (P31) of it, or of a kind of it.
# kind "field": people whose field of work (P101) is it; placed where they worked (P937), else were born.
TOPICS = [
    {"id": "art-nouveau", "search": "Art Nouveau", "kind": "style"},
    {"id": "cafe", "search": "café", "kind": "class"},
    {"id": "psychoanalysis", "search": "psychoanalysis", "kind": "field"},
]
RELS = {"P26": "spouse of", "P1066": "student of", "P802": "teacher of", "P737": "influenced by", "P3342": "significant person for", "P451": "partner of", "P3373": "sibling of"}


CACHE = Path("data/generated/.explore-cache.json")
_disk = json.loads(CACHE.read_text("utf-8")) if CACHE.exists() else {}


def get(url, params):
    key = url + "?" + urllib.parse.urlencode(sorted(params.items()))
    if key in _disk:
        return _disk[key]
    for attempt in range(10):
        try:
            req = urllib.request.Request(url + "?" + urllib.parse.urlencode({"format": "json", "maxlag": 5, **params}), headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                d = json.load(r)
            if "error" in d and d["error"].get("code") == "maxlag":
                raise RuntimeError("maxlag")
            time.sleep(0.3)
            _disk[key] = d
            if len(_disk) % 20 == 0:
                CACHE.write_text(json.dumps(_disk), "utf-8")
            return d
        except Exception as e:
            print("  retry", attempt + 1, e)
            time.sleep(min(90, 5 * 2 ** attempt))
    raise RuntimeError("Wikidata API failed")


_cache = {}


def entities(ids):
    """Fetch entities 50 at a time; cached."""
    need = [i for i in dict.fromkeys(ids) if i and i not in _cache]
    for k in range(0, len(need), 50):
        d = get(WD, {"action": "wbgetentities", "ids": "|".join(need[k:k + 50]), "props": "labels|descriptions|claims|sitelinks", "languages": "en"})
        _cache.update(d.get("entities", {}))
    return {i: _cache[i] for i in ids if i in _cache and "missing" not in _cache[i]}


def search_statement(expr, limit=1500):
    """Item ids matching a statement search such as haswbstatement:P84=Q84287."""
    out, offset = [], 0
    while offset is not None and len(out) < limit:
        d = get(WD, {"action": "query", "list": "search", "srsearch": expr, "srnamespace": 0, "srlimit": 500, "sroffset": offset, "srprop": ""})
        out += [x["title"] for x in d["query"]["search"]]
        offset = d.get("continue", {}).get("sroffset")
    return out[:limit]


label = lambda e: (e.get("labels", {}).get("en") or {}).get("value")
desc = lambda e: (e.get("descriptions", {}).get("en") or {}).get("value")
links = lambda e: len(e.get("sitelinks", {}))


def claims(e, p):
    """Best-ranked values of a property: preferred if any, else normal."""
    cs = [c for c in e.get("claims", {}).get(p, []) if c.get("rank") != "deprecated" and c["mainsnak"].get("datavalue")]
    pref = [c for c in cs if c.get("rank") == "preferred"]
    return [c["mainsnak"]["datavalue"]["value"] for c in (pref or cs)]


def item(v):
    return v.get("id") if isinstance(v, dict) else None


def year_of(e, *props):
    for p in props:
        for v in claims(e, p):
            t = v.get("time") if isinstance(v, dict) else None
            if t:
                y = int(t[1:5]) * (-1 if t[0] == "-" else 1)
                return y, t[1:11] if v.get("precision", 9) >= 11 else ""
    return None, ""


def point(e):
    for v in claims(e, "P625"):
        if isinstance(v, dict) and "longitude" in v:
            return [round(v["longitude"], 4), round(v["latitude"], 4)]
    return None


def statement(q, p):
    return f"https://www.wikidata.org/wiki/{q}#{p}"


def image_file(e):
    for v in claims(e, "P18"):
        return v
    return None


def find(name, check):
    d = get(WD, {"action": "wbsearchentities", "search": name, "language": "en", "type": "item", "limit": 15})
    ids = [x["id"] for x in d.get("search", [])]
    found = [e for e in entities(ids).values() if (label(e) or "").lower() == name.lower() and check(e)]
    return max(found, key=links) if found else None


# --- People -------------------------------------------------------------------------------------------
people = []
for name, lo, hi in PEOPLE:
    e = find(name, lambda e, lo=lo, hi=hi: "Q5" in [item(v) for v in claims(e, "P31")] and lo <= (year_of(e, "P569")[0] or 0) <= hi)
    if not e:
        print("NOT FOUND:", name)
        continue
    q = e["id"]
    by, bd = year_of(e, "P569")
    dy, dd = year_of(e, "P570")
    bp = next((item(v) for v in claims(e, "P19")), None)
    dp = next((item(v) for v in claims(e, "P20")), None)
    people.append({
        "id": q, "label": name, "description": desc(e), "evidence": f"The human labelled \"{name}\" born {lo}-{hi} with the most sitelinks",
        "born": {"year": by, "date": bd, "placeId": bp, "place": None, "point": None, "source": statement(q, "P569")},
        "died": {"year": dy, "date": dd, "placeId": dp, "place": None, "point": None, "source": statement(q, "P570")} if dy else None,
        "_e": e,
    })
    print("person", name, q, "-", desc(e))
ids = {p["id"] for p in people}

# Labels and coordinates of the places, occupations and movements they point to.
refs = set()
for p in people:
    e = p["_e"]
    refs |= {p["born"]["placeId"], (p["died"] or {}).get("placeId")}
    for prop in ["P106", "P135", "P463", "P101"]:
        refs |= {item(v) for v in claims(e, prop)}
refd = entities([r for r in refs if r])
for p in people:
    e = p.pop("_e")
    for key in ["born", "died"]:
        if p[key] and p[key]["placeId"] in refd:
            pe = refd[p[key]["placeId"]]
            p[key]["place"], p[key]["point"] = label(pe), point(pe)
    for prop, key in [("P106", "occupations"), ("P135", "movements"), ("P463", "memberOf"), ("P101", "fields")]:
        p[key] = [{"id": item(v), "label": label(refd[item(v)]), "source": statement(p["id"], prop)} for v in claims(e, prop) if item(v) in refd and label(refd[item(v)])]
    f = image_file(e)
    if f:
        p["imageFile"] = f
    p["_rels"] = [(prop, item(v)) for prop in RELS for v in claims(e, prop) if item(v) in ids]

links_out = []
for p in people:
    for prop, other in p.pop("_rels"):
        links_out.append({"from": p["id"], "to": other, "label": RELS[prop], "source": statement(p["id"], prop)})
print(len(links_out), "links between people")

# --- Works: buildings they designed (P84), works they created (P170), and their notable works (P800) -----
works = {}
for p in people:
    q = p["id"]
    found = [(w, "P84", "architect") for w in search_statement(f"haswbstatement:P84={q}", 300)]
    found += [(w, "P170", "creator") for w in search_statement(f"haswbstatement:P170={q}", 300)]
    found += [(item(v), "P800", "notable work") for v in claims(_cache[q], "P800")]
    ents = entities([w for w, _, _ in found])
    for w, prop, role in found:
        e = ents.get(w)
        if not e or links(e) < 3 or not label(e):
            continue
        x = works.setdefault(w, {"id": w, "label": label(e), "year": year_of(e, "P571", "P577", "P580")[0], "point": point(e), "placeId": next((item(v) for v in claims(e, "P131")), None), "links": links(e), "people": [], "imageFile": image_file(e)})
        if not any(y["id"] == q for y in x["people"]):
            x["people"].append({"id": q, "role": role, "source": statement(w if prop != "P800" else q, prop)})
keep = set()
for p in people:
    mine = sorted([w for w in works.values() if any(y["id"] == p["id"] for y in w["people"])], key=lambda w: -w["links"])
    keep |= {w["id"] for w in mine[:14]}
works = [w for w in works.values() if w["id"] in keep]
places = entities([w["placeId"] for w in works if w["placeId"]])
for w in works:
    pid = w.pop("placeId", None)
    w["place"] = label(places[pid]) if pid in places else None
print(len(works), "works")

# --- Topics -------------------------------------------------------------------------------------------
topics = []
for t in TOPICS:
    e = find(t["search"], lambda e: True)
    q = e["id"]
    if t["kind"] == "style":
        kinds = [q] + search_statement(f"haswbstatement:P279={q}", 60)
        found = [i for k in kinds for i in search_statement(f"haswbstatement:P149={k}", 1200)]
        prop = "P149"
    elif t["kind"] == "class":
        kinds = [q] + search_statement(f"haswbstatement:P279={q}", 60)
        found = [i for k in kinds for i in search_statement(f"haswbstatement:P31={k}", 1200)]
        prop = "P31"
    else:
        found = search_statement(f"haswbstatement:P101={q} haswbstatement:P31=Q5", 1500)
        prop = "P101"
    found = list(dict.fromkeys(found))[:1800]
    ents = entities(found)
    rows = []
    where_ids = set()
    for x in ents.values():
        if not label(x):
            continue
        if t["kind"] == "field":
            y, _ = year_of(x, "P569")
            loc = next((item(v) for v in claims(x, "P937")), None) or next((item(v) for v in claims(x, "P19")), None)
            rows.append((x, y, None, loc))
        else:
            y, _ = year_of(x, "P571", "P580", "P1619")
            rows.append((x, y, point(x), next((item(v) for v in claims(x, "P131")), None)))
        if rows[-1][3]:
            where_ids.add(rows[-1][3])
    where = entities(list(where_ids))
    items = []
    for x, y, pt, loc in rows:
        if y is None or y > 2026:
            continue
        pt = pt or (point(where[loc]) if loc in where else None)
        if not pt:
            continue
        it = {"id": x["id"], "label": label(x), "year": y, "point": pt, "place": label(where[loc]) if loc in where else None, "source": statement(x["id"], prop), "links": links(x)}
        arch = [item(v) for v in claims(x, "P84") if item(v) in ids]
        if x["id"] in ids:
            arch.append(x["id"])
        if arch:
            it["people"] = arch
        items.append(it)
    # A building begun before its style existed was remodelled in it later: its start year would mislead.
    start = year_of(e, "P571", "P580")[0] if t["kind"] == "style" else None
    if start is not None:
        before = len(items)
        items = [i for i in items if i["year"] >= start]
        print("  dropped", before - len(items), "begun before", start)
    items = sorted(sorted(items, key=lambda i: -i["links"])[:700], key=lambda i: i["year"])
    for i in items:
        i.pop("links")
    topics.append({"id": t["id"], "qid": q, "label": t["search"][0].upper() + t["search"][1:], "description": desc(e), "kind": t["kind"], "evidence": f"The item labelled \"{t['search']}\" with the most sitelinks", "styleStart": start, "items": items, "yearSource": "P569" if t["kind"] == "field" else "P571"})
    print("topic", t["id"], q, desc(e), len(items), "items")

# --- Image credits from Commons ----------------------------------------------------------------------
files = sorted({x["imageFile"] for x in people + works if x.get("imageFile")})
credits = {}
for k in range(0, len(files), 40):
    d = get(COMMONS, {"action": "query", "prop": "imageinfo", "iiprop": "extmetadata|url", "iiurlwidth": 480, "titles": "|".join("File:" + f for f in files[k:k + 40])})
    for pg in d["query"]["pages"].values():
        info = (pg.get("imageinfo") or [{}])[0]
        meta = info.get("extmetadata", {})
        strip = lambda s: re.sub("<[^>]+>", "", s or "").strip()
        if info.get("thumburl"):
            credits[pg["title"][5:]] = {"url": info["thumburl"], "page": info.get("descriptionurl"), "artist": strip(meta.get("Artist", {}).get("value"))[:80], "license": strip(meta.get("LicenseShortName", {}).get("value"))}
for x in people + works:
    f = x.pop("imageFile", None)
    c = credits.get(f.replace("_", " ")) if f else None
    if c and c["license"]:
        x["image"] = c

CACHE.write_text(json.dumps(_disk), "utf-8")
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps({"built": time.strftime("%Y-%m-%d"), "source": "Wikidata and Wikimedia Commons", "people": people, "links": links_out, "works": works, "topics": topics}, ensure_ascii=False, indent=0), "utf-8")
print("wrote", OUT, OUT.stat().st_size // 1024, "KB")
