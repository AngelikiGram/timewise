"""Build stories with a logical flow from documented links between TIMEWISE records.

Input: the region files (records) and data/generated/links.json (statements from scripts/link_harvest.py).
Output: apps/web/public/data/stories/index.json and one file per story.

Three kinds of story, each making a claim that its own steps support:
- chain: "How did A lead to Z?" Each step is joined to the one before by a Wikidata statement of cause,
  effect or succession (has effect, has cause, followed by, follows, replaced by, replaces), and the dates
  run forward. The story's claim is the chain itself; every link cites its statement.
- episodes: "How did X unfold?" The records Wikidata lists as parts (or significant events) of a larger
  event, in date order. Each step cites its "part of" statement.
- place: "What happened in X, era by era?" The best-documented records whose home country is X within one
  era, in date order. The claim is only that: these are the most-documented records TIMEWISE holds for that
  country and era. Each step links to its own Wikidata record.
Nothing is written: titles, dates, places and descriptions are Wikidata's. Run from the repository root:
python scripts/story_catalog.py
"""
import json
import shutil
from collections import defaultdict
from pathlib import Path

DATA = Path("apps/web/public/data")
OUT = DATA / "stories"
LINKS = Path("data/generated/links.json")
MIN_CHAIN, MAX_CHAIN = 3, 12
MIN_PARTS, MAX_PARTS = 3, 14
MIN_PLACE, MAX_PLACE = 5, 10
KEEP = ("id", "title", "description", "category", "start", "end", "precision", "lng", "lat", "links", "home", "url", "loc")

# How a statement reads as a step forward in time, from the earlier record to the later one.
FORWARD = {"P1542": ("led to", "cause"), "P156": ("was followed by", "succession"), "P1366": ("was replaced by", "succession")}
BACKWARD = {"P828": ("led to", "cause"), "P1478": ("led directly to", "cause"), "P155": ("was followed by", "succession"), "P1365": ("was replaced by", "succession")}
PART = {"P361": "part of", "P793": "significant event of"}
ERAS = [("antiquity", -3500, 499), ("middle-ages", 500, 1499), ("early-modern", 1500, 1799), ("long-19th", 1800, 1913), ("world-wars", 1914, 1945), ("since-1945", 1946, 2026)]


def year(iso):
    return -int(iso[1:5]) if iso.startswith("-") else int(iso[:4])


def era_of(y):
    return next((e for e, lo, hi in ERAS if lo <= y <= hi), "since-1945")


# Records: one per QID, the version with a home country and coordinates first.
records = {}
for f in (DATA / "regions").glob("*.json"):
    if f.name.endswith(".boundary.json"):
        continue
    for e in json.loads(f.read_text("utf-8")).get("events", []):
        if not e.get("title", {}).get("en") or not e["id"].startswith("Q"):
            continue
        old = records.get(e["id"])
        score = (e.get("lng") is not None) * 2 + bool(e.get("home")) + (not e.get("multi"))
        if not old or score > old[0]:
            records[e["id"]] = (score, {k: e[k] for k in KEEP if k in e})
records = {k: v[1] for k, v in records.items()}
usable = {k for k, r in records.items() if r.get("lng") is not None and r.get("precision") in ("day", "month", "year", "decade")}
labels = {r["id"]: r["label"]["en"] for r in json.loads((DATA / "regions.json").read_text("utf-8"))["regions"]}

links = json.loads(LINKS.read_text("utf-8"))
flow = defaultdict(dict)  # earlier -> later -> (relation, kind, prop, refs, statement_on)
parts = defaultdict(dict)  # whole -> part -> (relation, prop, refs, statement_on)
for l in links:
    a, b, p, refs = l["from"], l["to"], l["prop"], l["refs"]
    if a not in usable or b not in usable:
        continue
    if p in FORWARD:
        early, late, (rel, kind) = a, b, FORWARD[p]
    elif p in BACKWARD:
        early, late, (rel, kind) = b, a, BACKWARD[p]
    elif p in PART:
        whole, part = (b, a) if p == "P361" else (a, b)
        parts[whole][part] = ("part of", p, refs, a)
        continue
    else:
        continue
    # A step must not go back in time.
    if year(records[early]["start"]) > year(records[late]["start"]):
        continue
    prev = flow[early].get(late)
    if not prev or (prev[1] == "succession" and kind == "cause"):
        flow[early][late] = (rel, kind, p, refs, a)


def step(rec, via=None):
    r = dict(records[rec])
    if via:
        r["via"] = via
    return r


def chapters(steps):
    out = []
    for i in range(0, len(steps), 3):
        part = steps[i:i + 3]
        a, b = year(part[0]["start"]), year(part[-1]["start"])
        fmt = lambda y: f"{-y} BC" if y < 0 else str(y)
        out.append({"label": fmt(a) if a == b else f"{fmt(a)}–{fmt(b)}", "records": part})
    return out


stories = []

# Chains: the longest forward path from each starting record, preferring causal links and better-documented records.
best = {}


def longest(node, seen=()):
    if node in best:
        return best[node]
    options = []
    for nxt, edge in flow[node].items():
        if nxt in seen:
            continue
        path = longest(nxt, seen + (node,))
        options.append(([(node, None)] + [(path[0][0], edge)] + path[1:], edge[1] == "cause"))
    if not options:
        best[node] = [(node, None)]
    else:
        best[node] = max(options, key=lambda o: (len(o[0]), sum(1 for _, e in o[0] if e and e[1] == "cause"), records[o[0][-1][0]].get("links", 0)))[0]
    return best[node]


import sys
sys.setrecursionlimit(10000)
roots = {n for n in flow if not any(n in flow[m] for m in flow)}
# Roots first, then chains that begin part-way through a larger web, as long as they mostly tell something new.
starts = list(roots) + [n for n in flow if n not in roots]
used_sets = []
for s in sorted(starts, key=lambda n: -records[n].get("links", 0)):
    path = longest(s)[:MAX_CHAIN]
    if len(path) < MIN_CHAIN:
        continue
    ids = {n for n, _ in path}
    if any(len(ids & u) / len(ids) > 0.6 for u in used_sets):
        continue
    causes = sum(1 for _, e in path if e and e[1] == "cause")
    cats = [records[n]["category"] for n, _ in path]
    # A chain of yearly repeats (elections, sports seasons) shows succession but argues nothing: skip those.
    titles = [records[n]["title"]["en"] for n, _ in path]
    stem = lambda t: "".join(c for c in t if not c.isdigit()).strip().lower()
    if not causes and len({stem(t) for t in titles}) <= 2:
        continue
    used_sets.append(ids)
    first, last = records[path[0][0]], records[path[-1][0]]
    steps = [step(path[0][0])] + [step(n, {"from": path[i][0], "fromTitle": records[path[i][0]]["title"]["en"], "relation": e[0], "kind": e[1], "prop": e[2], "refs": e[3], "on": e[4]}) for i, (n, e) in enumerate(path[1:])]
    question = f"How did {first['title']['en']} lead to {last['title']['en']}?" if causes * 2 >= len(path) - 1 else f"What came between {first['title']['en']} and {last['title']['en']}?"
    stories.append({
        "id": f"chain-{first['id']}", "kind": "chain", "title": question, "question": question,
        "claim": f"{len(path) - 1} documented links lead from {first['title']['en']} ({year(first['start'])}) to {last['title']['en']} ({year(last['start'])}): {causes} of cause and effect, {len(path) - 1 - causes} of succession.",
        "why": "Each record is joined to the one before it by a Wikidata statement (has effect, has cause, followed by, follows, replaced by, replaces), and the dates run forward. The longest such chain from the first record was taken, preferring cause and effect.",
        "count": len(steps), "from": year(first["start"]), "to": year(last["start"]), "era": era_of(year(first["start"])),
        "places": sorted({labels.get(r.get("home"), "") for r in steps if r.get("home")} - {""})[:4], "chapters": chapters(steps),
    })

# Episodes: a larger event told through its documented parts.
for whole, ps in parts.items():
    members = [p for p in ps if p != whole]
    if len(members) < MIN_PARTS:
        continue
    w = records[whole]
    # A list of regional copies of one thing (a pandemic county by county) shows no development: skip it.
    head = " ".join(w["title"]["en"].lower().split()[:2])
    copies = sum(1 for p in members if records[p]["title"]["en"].lower().startswith(head))
    if "pandemic" in w["title"]["en"].lower() or "epidemic" in w["title"]["en"].lower() or copies * 2 >= len(members):
        continue
    # The parts must cover some time, or there's no order to follow.
    if len({records[p]["start"][:4] for p in members}) < 3:
        continue
    members = sorted(members, key=lambda p: -records[p].get("links", 0))[:MAX_PARTS]
    members.sort(key=lambda p: records[p]["start"])
    steps = [step(whole)] + [step(p, {"from": whole, "fromTitle": w["title"]["en"], "relation": ps[p][0], "kind": "part", "prop": ps[p][1], "refs": ps[p][2], "on": ps[p][3]}) for p in members]
    question = f"What shaped {w['title']['en']}?" if w.get("category") == "state" else f"How did {w['title']['en']} unfold?"
    stories.append({
        "id": f"episodes-{whole}", "kind": "episodes", "title": question, "question": question,
        "claim": f"Wikidata lists {len(ps)} parts or significant events of {w['title']['en']} among TIMEWISE's records; these {len(members)} are the best documented, in date order.",
        "why": f"Each record after the first is linked to {w['title']['en']} by a Wikidata statement (part of, or significant event), and they are told in date order.",
        "count": len(steps), "from": year(steps[1]["start"]), "to": year(steps[-1]["start"]), "era": era_of(year(w["start"])),
        "places": sorted({labels.get(r.get("home"), "") for r in steps if r.get("home")} - {""})[:4], "chapters": chapters(steps),
    })

# Places: a country's best-documented records within one era, in date order.
ERA_LABEL = {"antiquity": "in antiquity", "middle-ages": "in the Middle Ages", "early-modern": "from 1500 to 1800", "long-19th": "from 1800 to 1914", "world-wars": "from 1914 to 1945", "since-1945": "since 1945"}
by_place = defaultdict(list)
for k in usable:
    r = records[k]
    if r.get("home") in labels:
        by_place[(r["home"], era_of(year(r["start"])))].append(k)
for (home, era), ks in sorted(by_place.items()):
    if len(ks) < MIN_PLACE:
        continue
    top = sorted(ks, key=lambda k: -records[k].get("links", 0))[:MAX_PLACE]
    stem = lambda t: "".join(c for c in t if not c.isdigit()).strip().lower()
    if len({stem(records[k]["title"]["en"]) for k in top}) < len(top) * 0.6:
        continue
    top.sort(key=lambda k: records[k]["start"])
    steps = [step(k) for k in top]
    name = labels[home]
    question = f"What happened in {name} {ERA_LABEL[era]}?"
    stories.append({
        "id": f"place-{home}-{era}", "kind": "place", "title": question, "question": question,
        "claim": f"The {len(steps)} best-documented records TIMEWISE holds for {name} {ERA_LABEL[era]}, out of {len(ks)}, in date order.",
        "why": f"Records whose home country is {name}, dated {ERA_LABEL[era]}, ranked by how many Wikipedia language editions describe them. They are not joined by statements: this is a tour of what is best documented, not an argument that one led to the next.",
        "count": len(steps), "from": year(steps[0]["start"]), "to": year(steps[-1]["start"]), "era": era,
        "places": [name], "chapters": chapters(steps),
    })

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
stories.sort(key=lambda s: (s["from"], s["id"]))
for s in stories:
    (OUT / f"{s['id']}.json").write_text(json.dumps(s, ensure_ascii=False, separators=(",", ":")), "utf-8")
index = [{k: s[k] for k in ("id", "title", "kind", "count", "from", "to", "era", "places")} for s in stories]
(OUT / "index.json").write_text(json.dumps({"stories": index, "labels": labels}, ensure_ascii=False, separators=(",", ":")), "utf-8")
print(len(stories), "stories:", sum(s["kind"] == "chain" for s in stories), "chains,", sum(s["kind"] == "episodes" for s in stories), "episodes,", sum(s["kind"] == "place" for s in stories), "places")
