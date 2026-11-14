# Data sources

The per-record list is in `data/curated/austria/collection.json`. All sources were retrieved on 2026-11-02.

| Provider | Used for | Type | Connector |
| --- | --- | --- | --- |
| Wien Geschichte Wiki | Vienna 1848, Ringstrasse | Reference work (City of Vienna) | None: manually curated |
| Wikipedia (en, de) | All other events | Reference work | None: manually curated |
| Wikidata | Place IDs and coordinates | Linked data, not treated as evidence | None: looked up once |
| Wikimedia Commons | Six images | Media | None: hotlinked |
| OpenFreeMap / OpenStreetMap | Present-day basemap | Reference map | Live style URL |
| historical-basemaps (A. Ourednik) | Dated political outlines | Community-digitized, GPL-3.0 | None: one-off import, `scripts/fetch-geometries.mjs` |
| OpenStreetMap via Nominatim | Burgenland, Ringstrasse shapes | Present-day reference | None: one-off import, `scripts/build-geometries.mjs` |
| Wikidata Query Service | Imported events for every country, and the country configs themselves | Linked data, CC0, discovery only | `ingestion/connectors/wikidata_events.py`, `wikidata_more.py`; configs from `ingestion/generate_region_configs.py` |
| Natural Earth 1:50m admin-0 countries, v5.1.2 | Present-day outline per country, used only to mark imported events inside or outside today's borders | Public domain | None: one-off import, `ingestion/build_country_boundaries.py` |

## Country configs

`data/source-configs/regions/*.json` holds one config per present-day sovereign state (197). Austria's is hand-checked. The other 196 were generated on 2026-11-09 from Wikidata: the sovereign state (Q3624078) with its ISO code, plus historical countries Wikidata links to it with one step of "replaces" / "replaced by" (P1365/P1366). Nobody has reviewed them. Known gaps: states with no such link are missing, e.g. the Holy Roman Empire for Germany. Shared predecessors such as the Soviet Union appear in several countries.

The 9 earlier hand-written configs (Belgium, France, Germany, Italy, Netherlands, Poland, Spain, United Kingdom, United States) were replaced. Apart from the modern country, every historical-state ID in them pointed at an unrelated Wikidata item (e.g. "Kingdom of France" was Q8742, Moritzburg).

## Known limits

- **Mostly one reference work.** 15 of 18 sources are Wikipedia pages. That is weak for a product built on evidence; primary records arrive with Phase 3.
- **Not accessible to the checking script.** Britannica and UNESCO returned HTTP 403 to automated requests, so neither is cited. Nothing was cited from a page that couldn't be read.
- **Named in the spec but not connected or evaluated yet:** Austrian National Library, Europeana, Library of Congress, Smithsonian, The Met, World Historical Gazetteer, Pleiades, data.gv.at, basemap.at, OpenAlex, Crossref.
