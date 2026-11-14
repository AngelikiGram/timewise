"""Writes a region config for every present-day sovereign state, built only from Wikidata.

    .venv\\Scripts\\python ingestion/generate_region_configs.py [--keep austria]

Nothing here is typed in by hand except the ALIASES below, and each of those is checked against
its Wikidata label before it's written. Predecessor states come from Wikidata's own "replaces" /
"replaced by" links, one step only (two steps pulled in neighbours, e.g. Austria into Germany), so the list is what Wikidata says, not a judgement
about which states belong to which country. Hand-checked configs named with --keep are left alone.
"""
from __future__ import annotations

import argparse
import json
import re
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data/source-configs/regions"
UA = {"User-Agent": "TimewiseDev/0.1 (history atlas; region config generator)"}

# Where Wikidata files most events under a different item from the one carrying the ISO code.
# Format: ISO code -> {QID: expected English label}. Checked against Wikidata before use.
ALIASES = {
    "NL": {"Q55": "Netherlands"},
    "DK": {"Q35": "Denmark", "Q756617": "Kingdom of Denmark"},
}
MAX_DEPTH = 1


def sparql(query: str) -> list[dict]:
    """The query service has been limiting to one request a minute, so every call waits first."""
    url = "https://query.wikidata.org/sparql?" + urllib.parse.urlencode({"query": query})
    for attempt in range(6):
        time.sleep(65)
        try:
            req = urllib.request.Request(url, headers={**UA, "Accept": "application/sparql-results+json"})
            with urllib.request.urlopen(req, timeout=120) as r:
                return json.load(r)["results"]["bindings"]
        except urllib.error.HTTPError as e:
            if e.code != 429 and e.code < 500:
                raise
            print(f"  HTTP {e.code}, retrying", flush=True)
        except TimeoutError:
            print("  timeout, retrying", flush=True)
    raise RuntimeError("Wikidata query kept failing")


def labels(qids: list[str]) -> dict[str, str]:
    found = {}
    for i in range(0, len(qids), 50):
        url = "https://www.wikidata.org/w/api.php?" + urllib.parse.urlencode(
            {"action": "wbgetentities", "format": "json", "props": "labels", "languages": "en", "ids": "|".join(qids[i:i + 50])})
        for qid, e in json.load(urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60))["entities"].items():
            found[qid] = e.get("labels", {}).get("en", {}).get("value")
        time.sleep(1)
    return found


def qid(b: dict, key: str) -> str:
    return b[key]["value"].rsplit("/", 1)[-1]


def slug(name: str) -> str:
    ascii_name = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "_", ascii_name.lower()).strip("_")


# Names chosen to match the existing config ids, so earlier imports keep their region_id.
SLUG_OVERRIDES = {"Q29999": "netherlands", "Q148": "china", "Q35": "denmark"}


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--keep", nargs="*", default=["austria"], help="config ids not to overwrite")
    args = parser.parse_args()

    print("sovereign states...", flush=True)
    states = sparql("""SELECT ?c ?iso ?en ?native WHERE {
      ?c wdt:P31 wd:Q3624078 ; wdt:P297 ?iso .
      FILTER NOT EXISTS { ?c wdt:P576 ?dissolved }
      OPTIONAL { ?c rdfs:label ?en FILTER(LANG(?en) = "en") }
    }""")
    countries: dict[str, dict] = {}
    for b in states:
        countries.setdefault(qid(b, "c"), {"iso": b["iso"]["value"], "en": b.get("en", {}).get("value")})
    missing = {iso for iso in ALIASES} - {c["iso"] for c in countries.values()}
    for iso in missing:  # e.g. Denmark: the ISO code sits on an item not typed as a sovereign state
        first = next(iter(ALIASES[iso]))
        countries[first] = {"iso": iso, "en": ALIASES[iso][first]}
    print(f"  {len(countries)} states", flush=True)

    alias_qids = [q for group in ALIASES.values() for q in group]
    real = labels(alias_qids)
    for group in ALIASES.values():
        for q, expected in group.items():
            if real.get(q) != expected:
                raise SystemExit(f"Alias {q} is labelled {real.get(q)!r} on Wikidata, expected {expected!r}. Fix ALIASES.")

    print("predecessor links...", flush=True)
    edges = sparql("""SELECT DISTINCT ?old ?new ?oldEn WHERE {
      { ?old wdt:P1366 ?new } UNION { ?new wdt:P1365 ?old }
      ?old wdt:P31/wdt:P279* wd:Q3024240 .
      OPTIONAL { ?old rdfs:label ?oldEn FILTER(LANG(?oldEn) = "en") }
    }""")
    replaced_by: dict[str, set[str]] = {}
    names: dict[str, str] = {}
    for b in edges:
        old, new = qid(b, "old"), qid(b, "new")
        if old == new:
            continue
        replaced_by.setdefault(new, set()).add(old)
        if "oldEn" in b:
            names[old] = b["oldEn"]["value"]
    print(f"  {len(edges)} links", flush=True)

    written, kept = 0, []
    for cq, c in sorted(countries.items(), key=lambda kv: kv[1]["en"] or kv[0]):
        if not c["en"]:
            print(f"  skipping {cq}: no English label", flush=True)
            continue
        region_id = SLUG_OVERRIDES.get(cq, slug(c["en"]))
        if region_id in args.keep:
            kept.append(region_id)
            continue
        own = {cq: c["en"], **ALIASES.get(c["iso"], {})}
        found: dict[str, int] = {}
        frontier = set(own)
        for depth in range(1, MAX_DEPTH + 1):
            frontier = {p for q in frontier for p in replaced_by.get(q, ()) if p not in own and p not in found and p in names}
            for p in frontier:
                found[p] = depth
        config = {
            "id": region_id,
            "label": {"en": c["en"]},
            "iso": c["iso"],
            "wikidata_country": cq,
            "wikidata_states": {**own, **{p: names[p] for p in sorted(found, key=lambda p: (found[p], names[p]))}},
            "landmarks": [],
            "generated": {
                "by": "ingestion/generate_region_configs.py",
                "on": time.strftime("%Y-%m-%d"),
                "method": f"Sovereign state (Q3624078) with ISO code {c['iso']}, plus historical countries linked to it by "
                          f"P1365/P1366 up to {MAX_DEPTH} steps. Not reviewed.",
            },
            "note": "Built automatically from Wikidata. Predecessor states are the ones Wikidata links to this country, "
                    "so events can lie outside today's borders, and earlier periods may be missing where Wikidata has no link.",
        }
        (OUT / f"{region_id}.json").write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", "utf8")
        written += 1
    print(f"wrote {written} configs, kept {kept}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
