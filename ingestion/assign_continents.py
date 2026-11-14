"""Adds a "continent" to each country config, from Wikidata's "continent" (P30), via QLever.

    .venv/Scripts/python ingestion/assign_continents.py

A country Wikidata places on more than one continent gets the one in TRANSCONTINENTAL, which follows
the UN geoscheme (M49). That is a convention for grouping, not a historical claim.
"""
from __future__ import annotations

import json
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CONFIGS = ROOT / "data/source-configs/regions"
ENDPOINT = "https://qlever.dev/api/wikidata"
CONTINENTS = {"Q46": "europe", "Q48": "asia", "Q15": "africa", "Q49": "north_america", "Q18": "south_america", "Q538": "oceania", "Q3960": "oceania", "Q55643": "oceania"}
# UN M49 region for countries Wikidata lists on several continents.
TRANSCONTINENTAL = {
    "russia": "europe", "turkey": "asia", "egypt": "africa", "kazakhstan": "asia", "azerbaijan": "asia", "georgia": "asia",
    "armenia": "asia", "cyprus": "asia", "indonesia": "asia", "panama": "north_america", "timor_leste": "asia",
    "papua_new_guinea": "oceania", "spain": "europe", "france": "europe", "portugal": "europe", "italy": "europe",
    "greece": "europe", "united_states": "north_america", "chile": "south_america", "denmark": "europe", "norway": "europe",
    "netherlands": "europe", "united_kingdom": "europe", "yemen": "asia", "colombia": "south_america", "ecuador": "south_america",
    "trinidad_and_tobago": "north_america", "maldives": "asia", "mauritius": "africa", "seychelles": "africa", "cape_verde": "africa",
    "malta": "europe", "iceland": "europe", "fiji": "oceania", "kiribati": "oceania", "venezuela": "south_america",
}


def main() -> int:
    configs = {p.stem: json.loads(p.read_text("utf8")) for p in CONFIGS.glob("*.json")}
    configs = {k: v for k, v in configs.items() if v.get("wikidata_country")}
    values = " ".join(f'(wd:{c["wikidata_country"]} "{rid}")' for rid, c in configs.items())
    query = f"""PREFIX wd: <http://www.wikidata.org/entity/>
PREFIX wdt: <http://www.wikidata.org/prop/direct/>
SELECT ?region ?continent WHERE {{ VALUES (?c ?region) {{ {values} }} ?c wdt:P30 ?continent }}"""
    req = urllib.request.Request(ENDPOINT, data=urllib.parse.urlencode({"query": query}).encode(),
                                 headers={"Accept": "application/sparql-results+json", "User-Agent": "TimewiseDev/0.1"})
    with urllib.request.urlopen(req, timeout=120) as r:
        rows = json.load(r)["results"]["bindings"]
    found: dict[str, set[str]] = {}
    for row in rows:
        qid = row["continent"]["value"].rsplit("/", 1)[-1]
        if qid in CONTINENTS:
            found.setdefault(row["region"]["value"], set()).add(CONTINENTS[qid])
    missing, several = [], []
    for rid, config in configs.items():
        options = found.get(rid, set())
        if rid in TRANSCONTINENTAL:
            choice = TRANSCONTINENTAL[rid]
        elif len(options) == 1:
            choice = next(iter(options))
        else:
            (several if options else missing).append(f"{rid}: {sorted(options)}")
            continue
        config["continent"] = choice
        (CONFIGS / f"{rid}.json").write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", "utf8")
    counts: dict[str, int] = {}
    for c in configs.values():
        if "continent" in c:
            counts[c["continent"]] = counts.get(c["continent"], 0) + 1
    print("per continent:", counts)
    if missing or several:
        print("needs a decision:", *missing, *several, sep="\n  ")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
