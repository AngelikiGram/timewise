# Development status

Last updated: 2026-11-18. **TIMEWISE 2.0 Phase 1 (correct the existing interface) is done. Phase 2 is partly done:** the database, API, Europeana connector, review screen and a worldwide Wikidata import (all 197 countries, unreviewed) work. Phases 3–6 aren't started. This isn't production-ready.

## Checks on 2026-11-10

The world coverage map and per-country atlas frames from the previous session are in place and tested. Finishing them turned up these problems, now fixed:

- **The production build failed.** `/explore/[region]` fetched its country list from the site's own URL, which doesn't exist during a build. It now reads the export file, like `/atlas/[region]`.
- **The evidence inspector filed reference-work claims under "Missing"** and hid them by default. Most claims in the collection are reference-work claims, so checked, sourced claims were presented as having no evidence. Each status is now counted under its own name, and the default view hides only inferred and missing claims. Four status colours that don't exist in the theme had rendered as invisible dots.
- **The explore layout was broken.** The timeline had been moved into the narrow left column, and the evidence panel was cut off halfway down. The semantic timeline is back in the bottom bar (spec 8B). On desktop the evidence panel, Place DNA and inspector now share the right column.
- **Phone users couldn't leave the Place DNA tab** once a place was selected. It now opens once, when the place is chosen.
- **The timeline's accessibility role had been changed** from `slider` to `presentation`, so screen readers ignored a focusable control. Restored.
- **The coverage map waited for every map tile** before drawing countries, which made its hover tests fail on a slow connection.
- **Database connections ran out.** Supabase's session pooler allows 15 clients, and a long-running API server used them all. The API pool is now 2 plus 1 overflow, and idle connections are recycled.

Changes that need a decision:
- **`TimeMicroscope`, the second timeline, is no longer shown.** It duplicated the semantic timeline. Its View (single, split, swipe, then-and-now) and Evidence switches still work through the URL (`mode=`, `compare=`, `evidence=`), but have no on-screen control until they get a home, perhaps in the Layers panel.
- **16 one-off debug specs** (`debug-*`, `visual-check`) were moved from `tests/e2e/` to `tests/debug/`, outside the suite. They weren't tests: they printed page HTML and one wrote screenshots into the project root. Five such PNGs are still in the root.
- **The two `user-flow` tests are skipped on phones,** since they check that several panels are visible at once.

Results: typecheck passes. 20 web unit tests, 54 Python tests and 31 of 31 citations pass. Browser tests: 66 pass and 9 are skipped, by design (each only applies to one screen size). The journey test "next moves map, time…" failed once during the full run, then passed 6 out of 6 times alone with three runs in parallel, so it's flaky under load. Screenshots were checked for explore (desktop and phone), the world map (desktop and phone) and the per-country atlas. On the world map Alaska still looks slightly different from the contiguous US, though it's one shape in the same colour band; the cause wasn't found.

Status terms follow the spec: Implemented and tested, Partially implemented, Planned, Blocked.

## Audit of the existing application

| Question | Finding |
| --- | --- |
| Why did timeline dots sit at different heights? | Purely to avoid overlap. `assignLanes` pushed a dot up when it would touch its neighbour. Height meant nothing and had no legend. **Replaced.** |
| How are events loaded? | From `data/curated/austria/collection.json`, bundled into the web app and validated at load. There's no backend, API or database. |
| Which source providers are connected? | **None.** Sources were read once by hand and linked. The only live external services are the basemap and image hotlinks. |
| Do source links reach original evidence? | **No.** All 18 are reference works: 15 Wikipedia pages and 3 Wien Geschichte Wiki entries. They don't link to primary records. |
| Why were events only points? | The schema allowed only one `placeId` per event, so nothing else could be represented. |
| What can be retained? | Visual identity, shared store, search, claim and citation model, citation checker, responsive tabs, test setup. All retained. |

Also absent: AI integrations, ingestion scripts, extraction, deployment setup.

## Data audit

From `node scripts/audit-data.mjs`:

| Measure | Value |
| --- | --- |
| Records | 19 (16 events, 3 processes) |
| Claims / places / geometries | 27 / 12 / 9 |
| Source pages / independent publishers | 18 / 2 |
| Primary or scholarly sources | 0 |
| Time span of records | 1844–1921 |
| Present-day countries | AT 7, HU 2, CZ 1, BA 1, FR 1 |
| With a usable location | 18 of 19 (95%) |
| With a line or area shape | 10 of 19 (53%) |
| With a located, paraphrased passage | 19 of 19 (100%) |
| With a verbatim original passage stored | 0 of 19 (0%) |
| With more than one publisher | 1 of 19 (5%) |
| With media | 6 of 19 (32%) |
| Reviewed by a historian | 0 of 27 claims (0%) |

**This remains a small demonstration dataset.** No events were added to make it look richer; the 3 new records are processes the existing sources already state.

## Phase 1: completed work

### Implemented and tested

| Feature | Notes |
| --- | --- |
| Semantic timeline tracks | One labelled row per theme, using each record's first theme. Height now means theme only |
| Date-type encoding | Exact point, range bar, year-only band, process bar with faded ends where approximate, all in a legend |
| Timeline navigation | Scroll to zoom, drag to pan, drag the rail to scrub, zoom buttons, reset |
| Timeline keyboard | ←/→ between records, Shift+←/→ pans, +/− zoom, Home/End |
| Grouping | Crowded marks merge into a count; clicking zooms in and separates them |
| Density strip | Labelled as records in this collection, not how eventful a period was |
| Find and filter | Find highlights matches; track labels toggle themes |
| Non-visual navigation | Screen-reader list of every record in date order |
| Selected year vs record | Bronze line for the date, oxblood ring for the record |
| Geometry model | `TemporalGeometry`: LineString, MultiLineString, Polygon, MultiPolygon, with provenance on every feature |
| Time-aware map | Shapes appear only inside their validity interval. Gaps stay empty and the map says so |
| Events without a location | Stay in the story and timeline with no invented marker, and show the reason |
| Layers | Toggles, boundary opacity, line-style legend |
| Geography details | Each shape shows its derivation class, accuracy, source, licence, CRS and validity |
| Single-publisher warning | Counts publishers, so language editions of one encyclopedia don't look like corroboration |
| Shape-aware camera | Frames the route or area, not just a point |
| Citation checker | Now also checks the place names behind the railway routes' dates |

### Geometry shown, and how far to trust it

| Shape | Class | Limit |
| --- | --- | --- |
| Austria-Hungary, 1880 / 1900 / 1914 snapshots | Community-digitized | Coarse outlines. Each is carried forward to the next snapshot, which is my display decision and not a sourced fact |
| Republic of Austria, 1920 snapshot | Community-digitized | Coarse outline |
| Burgenland | Modern reference | Today's boundary, not the 1921 one |
| Ringstrasse | Modern reference | Today's streets, shown from 1865. Not a survey of the 1865 road |
| Graz, Semmering and Brenner rail links | Modern reference | Today's running track from OpenStreetMap (ODbL), 97, 41 and 132 km. Follows the 1844–1867 lines in most places, but later realignments aren't separated out |

No boundary is drawn for 1844–1879 or from November 1918 to the end of 1919, because the data has none.

### Partially implemented

| Feature | What's missing |
| --- | --- |
| Panel resize | Panels collapse, but don't drag to resize |
| Mobile legend | The timeline legend is hidden on phones to save height |
| Map clustering | Records sharing a place step through on repeated clicks; zoom-dependent clustering isn't built |
| Event detail | Has people, related records and evidence. No scholarly interpretations or source disagreements yet, beyond claims labelled as such |
| Vienna demo | Shows the Ringstrasse as a line, but there's no fortification geometry, so no real before-and-after |
| Brenner demo | A labelled route along today's track, with its evidence |
| Political demo | Dated outlines appear and disappear, but no animated territorial comparison |
| Keyboard access on map | Map shapes and markers need a mouse or touch; the same records are reachable from the story and timeline |

### Not done from your brief, by phase

- **Phase 2:** source connectors, ingestion, governance, admin quality dashboard (only the audit script exists). PostGIS and FastAPI are done. pgvector isn't enabled yet.
- **Phase 3:** OCR, entity and event extraction, full temporal reasoning, review interface. Only the rule-based spatial extraction below exists.
- **Phase 4:** Journeys, historical raster maps, split and swipe comparison, IIIF viewer, Hindsight mode, coverage map, nearby discovery.
- **Phase 5:** Model evaluation and training. No model exists.
- **Phase 6:** German interface, learning interactions, deployment.

## Tests performed

| Check | Result |
| --- | --- |
| Type check | Pass |
| Unit tests | 16 of 16 pass, including no boundary in data gaps and no railway before its opening |
| Production build | Pass |
| Playwright, desktop and mobile | 25 pass, 3 skipped (each only applies to one screen size) |
| Python pipeline, API, connector and review tests | 54 of 54 pass against the hosted database, including an exact match between curated and exported data |
| Citation check against live pages | 31 of 31 found |
| Visual inspection | Screenshots of Brenner, Ringstrasse, 1914 politics and mobile map |

### Bugs found by looking at the rendered app

- Geometry labels never appeared, because MapLibre doesn't allow per-feature label placement.
- The Ringstrasse had gaps, as the lookup returned one segment per street.
- A same-named street elsewhere in Vienna was pulled into the Ringstrasse and threw off the framing.
- The map stayed blank until all tiles had loaded on slow connections.
- The simplification script collapsed closed polygon rings.

## Remaining problems

1. **Source quality is still the main weakness.** No primary or scholarly sources, and one record in 19 has a second publisher. Success criterion 3, inspecting multiple original sources, isn't met.
2. **The boundary data has a licensing problem.** historical-basemaps is GPL-3.0. Whether that's compatible with a commercial product needs a human or legal decision, and better scholarly data should be sought.
3. **The Burgenland transfer isn't really shown.** The 1920 outline and a modern boundary don't demonstrate the change.
4. **The selection pulse repaints the map constantly**, which costs some CPU and battery, and means the map never reports `idle`.
5. **Earlier items still open:** OpenFreeMap's commercial terms, Wien Geschichte Wiki's licence, hotlinked images, and uneven coverage with no Innsbruck or Graz depth.
6. **Connectors need a Europeana key,** if that's the first source. There's no git repository yet either.
8. **`spatial_ref_sys` stays readable through Supabase's API.** It's a PostGIS reference table with no user data, and row-level security can't be set on it from this role. Only the app's own tables were closed.
7. **Accessibility:** no automated audit or screen-reader test.

## Automated geographic reconstruction

**Status: partially implemented. It's a working core, not the fully automated system requested.** Run it with `.venv\Scripts\python ingestion/geo/run.py`; code is in `ingestion/geo/`.

### Latest run on live pages (18 source pages)

| Stage | Result |
| --- | --- |
| Spatial relations extracted | 64, of which 34 were dropped as not about a route |
| Route pairs | 24 |
| Names not resolved to a settlement | 15 |
| Sent to human review | 7 |
| Matched a curated rail link | 2 (found independently of the curated data) |
| **Published to the map** | **0** |

Zero is the correct outcome for now: each of the 7 has an ambiguous place name, no opening date in the sentence, or both. The map updates automatically when a feature does pass.

### Requirement by requirement

| # | Requirement | Status |
| --- | --- | --- |
| 1 | Extract entities and relations from archival text | Partial: rules for connections, distance and bearing, stated coordinates, in English and German. Run on reference works; **no archival text has been processed** |
| 2 | Resolve place names | Partial: Wikidata candidates with a regional filter. Finds some historical names. Jurisdiction changes aren't modelled |
| 3 | Retrieve time-specific geospatial data | Not automated: outlines are a one-off import. Railways, roads and waterways aren't retrieved |
| 4 | Text to formal constraints | Partial: distance and bearing become an error disc |
| 5 | Build geometry | Partial: points, lines and discs with Shapely. **No PostGIS or GeoPandas, no polygons or networks** |
| 6 | Reconcile across documents | Partial: merges sightings of one route and flags conflicting opening years. Maps aren't reconciled |
| 7 | Constraint-based inference | Function built and unit-tested, **not yet used in the live run**, which found no usable offset constraints |
| 8 | Alternative candidates | Partial: alternative place matches are listed. Alternative geometries aren't drawn |
| 9 | Validation | Partial: geometry validity, length against stated length, date, inside the reference outline for that date |
| 10 | Automatic map update | Implemented: validated features flow to the map, behind an evaluation gate. Not yet exercised with a real feature. Timeline isn't updated |
| - | New documents trigger the pipeline | **Not implemented:** manual run, because no ingestion or queue exists |
| - | Human review | Partial: a queue file with reasons, `data/generated/austria/reconstruction.json`. **No review screen** |
| - | Territorial change from text | **Not implemented:** the pipeline doesn't attempt borders from text, so it invents none |

### Evaluation

The gold set is 15 sentences and 4 locations that I wrote myself, and the rules were fixed against it. **These numbers show the rules behave as designed. They don't predict accuracy on archival text**, and the publish gate rests on them, so it's weak protection until real annotated text replaces them.

| Metric | Result |
| --- | --- |
| Spatial relation extraction | Precision 1.0, recall 1.0 (9 relations) |
| Temporal correctness | 5 of 5 years |
| Location accuracy from distance and bearing | 27.4 km mean error, 4 of 4 within stated uncertainty |
| Topology consistency | 9 of 9 curated shapes valid (it found one invalid shape, now repaired) |
| Boundary overlap | **Not measured:** no polygons are reconstructed |

### Limits worth knowing

- **The goal needs inputs that don't exist yet:** archive connectors, annotated historical text, trusted historical geodata, and probably an LLM. German Fraktur OCR isn't handled at all.
- **Full automation of historical borders from text is an open research problem.** Expect review to remain central for territorial geometry.
- Wikidata's rate limiting makes a cold run take several minutes. Results are cached.

## Full-history atlas

**Implemented and tested at `/atlas/austria`, with machine-imported, unreviewed data.** Timeline by century, category and location filters, search, clustered map, and a country picker driven by whichever regions have data. **Austria is the only region so far.** Adding another needs a config in `data/source-configs/regions/`, a boundary file and an import run, and that path hasn't been tested with a second country.

- 822 imported events from Wikidata (CC0) plus the 16 hand-checked events, from about the year 70 to today. Each imported one is labelled "Imported, not reviewed" and links to its Wikidata record. They're stored apart from checked data, in `imported_events`.
- 486 more are hidden by the recorded rules in `ingestion/connectors/wikidata_more.py` (future dates, local elections, minor museums), not deleted.
- About 540 more Europeana records, covering Roman times to 1955, were imported and stay hidden until reviewed.

Limits:
- **Still not the full history.** Only 31 events predate 1100, and BCE events are excluded. 477 of the 822 imported events lie inside present-day Austria. Coverage is uneven, and depends on how Wikidata is tagged.
- **Quality is unmeasured.** No sample has been checked for accuracy. Some entries are mistagged, some dates are questionable, and some "foundings" are really dates of a building. A few events also appear twice, once checked and once imported.
- Many events lie outside present-day Austria, because they're tied to Habsburg states. A filter separates them.
- Daily life, society and the economy are almost absent, since the import is limited to wars, politics and institutions.
- 22 landmark names were chosen by Claude, not a historian: a selection, and a source of bias.

## Worldwide import

**Implemented and run for all 197 present-day sovereign states, with unreviewed data.** The run on 2026-11-11 stored 67,867 events and hid 74,682 more by the filler rules, with no failed queries. 52,725 events (78%) have a map position: 34,708 the event's own coordinates, 16,398 its linked site, 1,619 the town or district it was in (labelled approximate). Everything is in the hosted Supabase database.

- **Why QLever and not query.wikidata.org:** in November 2026 WDQS answered every request with `Retry-After: 1000`, so one country took about five hours. `ingestion/connectors/wikidata_batch.py` sends the same queries to QLever (`https://qlever.dev/api/wikidata`, University of Freiburg; same CC0 Wikidata, from a dump that can be days behind). One query covers one category for 25 countries, so the whole world takes about 5 minutes. Finished (category, chunk) pairs are recorded in `data/generated/batch-import-progress.json`, so a rerun repeats only what failed; `--fresh` reruns everything. `ingestion/run_all_regions.py` is superseded.
- **Bugs found and fixed in the run:** a long query needed POST (HTTP 414); the old QLever host redirected POST (HTTP 308); "unknown value" dates arrive from QLever as IRIs and reached the date column; and QLever writes coordinates as upper-case `POINT(…)`, which the parser rejected, so the first full run had no map positions at all. Each has a test in `tests/py/test_wikidata_parse.py`.
- **Country configs:** 196 were generated from Wikidata by `ingestion/generate_region_configs.py`. Each one is the sovereign state plus the historical countries Wikidata links to it with one step of "replaces" / "replaced by". Austria keeps its hand-checked config. Every alias ID is checked against its Wikidata label before it's written.
- **Earlier configs were wrong.** In the 9 hand-written configs for Belgium, France, Germany, Italy, the Netherlands, Poland, Spain, the UK and the US, every historical-state ID pointed at an unrelated item (e.g. "Confederate States of America" was a footballer). They have been replaced. The US's 6,253 events came from them and are being re-imported.
- **Boundaries:** Natural Earth 1:50m present-day outlines (public domain) mark each event inside or outside today's country. They aren't historical borders.
- **Running it:** `.venv/Scripts/python ingestion/connectors/wikidata_batch.py`, then `PYTHONPATH=apps/api .venv/Scripts/python -m timewise_api.export --imported` and `npm run build`. Run the import as a detached process logging to `data/generated/logs/batch-import.log`; one run inside the session stopped silently when the session reset.
- **Explore picker:** lists only countries that have imported events, with a search box. The export now writes both region lists.
- **Dev server on the LAN:** `allowedDevOrigins` permits 192.168.0.160. Without it, the page hung on "Loading regions…" when opened from that address.

Test run, Luxembourg: 114 events, 86 kept and 28 hidden by the filler rules. Problems it showed, all from Wikidata's tagging:
- "Gaul" is filed under several present-day countries, so late-Roman and Visigothic wars located there appear for Luxembourg.
- The Ecuadorian–Peruvian War of 1857–1860 is tagged with Luxembourg as a country, which is wrong.
- Predecessor states with no Wikidata link are missing, e.g. the Holy Roman Empire for Germany. Shared predecessors such as the Soviet Union appear in each successor.

Not done: no accuracy sample for any country. Events are attached by Wikidata's country tags, so mistagged and shared-predecessor events still appear (see the Luxembourg notes).

### Country atlas map (2026-11-11)

**Implemented and tested** in `HistoryAtlas.tsx`, checked on screenshots of Germany at three zoom levels:
- Events are coloured by category, sized by how many Wikipedia languages cover them (the legend says this means better documented, not more important), and hollow when outside today's border. Zoomed out, a soft density glow replaces the old clusters.
- Titles appear in three tiers as you zoom in, best-documented first, without overlapping. Hovering a dot shows its date and title.
- The century chart is stacked by category. The list can follow the map ("Only what's on the map") and sort by date or by documentation. Rows show the description and say when a position is approximate or missing.
- A selected event shows when, where (with how the position was derived), coverage, and two context lists: around the same time, and at or near the same place.
- The dark basemap's land and water were nearly the same colour; they now contrast.
- `/explore/<country>` used the curated Austria workspace, which drew Austria's railways for every country and couldn't place imported events at all. It now redirects to `/atlas/<country>`, and the picker links there. `ImportedEventsWorkspace.tsx` is removed.

### Railway tracks (2026-11-11)

**Implemented and tested.** The three curated railway sections were straight lines between their endpoints. `scripts/fetch_rail_tracks.py` now downloads the running-line rail ways (no sidings) in a corridor around each section from the OpenStreetMap Overpass API, and takes the shortest connected path between the endpoints. It writes `data/curated/austria/rail-tracks.json`, which `scripts/apply-rail-tracks.mjs` (also called by `build-geometries.mjs`) puts into `geometries.json` as `modern_reference`, licensed ODbL with OpenStreetMap credited, and with every OSM way ID recorded. The opening-date citations are unchanged, and `verify:sources` passes (31/31).
- Checked: the paths are 97 km (Mürzzuschlag–Graz, real about 95), 41 km (Semmering, real about 42) and 132 km (Innsbruck–Bolzano, real about 125). Each passes within about 650 m of the historic stations tested (Semmering, Breitenstein, Payerbach, Bruck, Kapfenberg, Frohnleiten, Steinach, Brennero, Fortezza, Bressanone). Screenshots show the Semmering line winding through the mountains.
- Limits: this is today's track. Neither base tunnel is open, so it is mostly the original line, but later realignments are not separated out. The machine-extracted routes from the reconstruction pipeline are still schematic straight lines.
- Place DNA printed "Accuracy: {sentence}m"; the stray "m" is gone.

Tests: atlas and coverage specs pass on the new build (22). The admin and archival-material specs only pass on port 3000, because the API's CORS allows that origin alone; the Greenland hover test is flaky under full-suite load.

## History overviews and the educational redesign, milestone 1 (2026-11-12)

**More data, implemented and run.** The worldwide import now also covers epidemics and pandemics, constitutions, and historical states (founding to end, placed at their capital; Wikidata items that are directly a city, town or municipality are excluded, which removed e.g. Milan and Verona). BC dates are kept: Wikidata's astronomical years are converted (−0489 is 490 BC), stored as Postgres BC dates and sent to the site as "-0490-09-07". 74,650 events are kept across 197 countries; the earliest record is 3500 BC. Tests in `tests/py/test_wikidata_parse.py` and `tests/unit/dates.test.ts`.

**Continents, implemented.** `ingestion/assign_continents.py` adds each country's continent from Wikidata (P30); countries Wikidata puts on two continents follow the UN M49 grouping, listed in the script. `timewise_api/overview.py` writes `data/generated/overview.json` and one merged map file and outline per continent (an event filed under several countries counts once). A continent map shows its 6,000 best-documented events and says so.

**Implemented and tested:**
- `/history` and `/history/<continent>`: key numbers, an events-per-century chart (count or mix of types, hover or tab for details), categories, the countries with most records, era-by-era best-documented events, and a rise-and-fall chart of 30 states. Each chart says what it measures and what it doesn't.
- `/atlas/<continent>`, with continents in the atlas picker; each atlas links to its overview.
- A new event view in the atlas, in layers: at a glance (category, title, date, place, Wikidata description), a Commons image with author and licence, a two-sentence Wikipedia summary that expands (CC BY-SA, attributed), key facts from Wikidata, "How this connects" (Wikidata's preceding/following, cause/effect and part-of statements, each labelled as such), nearby-in-time and nearby-in-place lists labelled as proximity only, and the evidence folded into "Explore the evidence". Loaded live in the browser; a failure says so.
- Shareable event links (`/atlas/<id>?event=Q…`), with back and forward, and the map jumping to the event without animation.
- Recently opened events on the home page ("Continue where you left off"), stored in this browser only, and said so.
- New home page: a featured story with its archival image and credit, the story's eight chapter questions as cards (images where the chapter has one), and continent cards with small century charts.
- Readability: the smallest text is now 13px and body text 17px; 9–11px text is gone; the dark theme is a little lighter with stronger contrast. On phones the atlas scrolls as a page, filters sit in one swipeable row, and the header fits.

**From the pasted redesign brief, not done yet (planned):** learning activities (order events, find the place, spot the change, match the evidence, predict then reveal, inspect an image); the before-and-after comparison slider for Vienna's walls (needs a georeferenced historical plan with known rights); the "same journey, different year" travel module (needs documented timetables); person cards; bookmarks and story progress; a reworked timeline with hover previews; story chapters with reading time and a per-chapter main visual; a single evidence drawer shared with the curated Austria pages. The curated `/explore` workspace still has its earlier layout.

**Limits:** everything imported is unreviewed. "Best documented" means most Wikipedia languages, which favours famous and European topics. Continents and countries are present-day groupings. Wikipedia summaries and Wikidata connections are shown as their editors wrote them.

Tests: 25 unit, 61 Python, 67 of 69 browser tests on the new build; the two world-map hover tests pass alone and are the known flake under full-suite load. Admin and archival specs need the API's port 3000 origin and weren't run.

## Moving between the four ways in, and maps you can use (2026-11-18)

**Implemented and tested:**
- **Interest buttons:**
  - In lists, they are just the name: ＋ to add, ✓ once added.
  - On a person's or thing's own page: "Save to interests" or "In your interests ✓".
- **Tabs that follow you:**
  - Each mode tab opens on what you're looking at when it can: from Otto Wagner, "Explore a year" opens his busiest year and "Follow a thing" opens Art Nouveau. The target is shown on the tab.
  - Otherwise a tab opens where you last were in that mode, and only then on a starting point.
- **A way back:**
  - "Back to …" and a short trail of the last pages visited in this tab of the browser.
  - Changing the year adds a history step, so the browser's Back returns to the previous year.
- **One map for every "Where":** a life, a thing and a year all use the same interactive map.
  - **Zoom, full screen and a scale.**
  - **A choice of base map:** muted, detailed or dark, all from OpenFreeMap. The points are framed again after switching.
  - **Layers to switch,** with their counts: birth and death or works on a life; works, plus each thing, on a year. On a thing, colour shows the year, with a legend.
  - **Grouping:** crowded points are grouped with a count, and a click zooms in until they split.
  - **Hover** shows the name and one line about it.
  - **Click** opens a card with its image and credit, and links on to the year, the people named on it, and the Wikidata statement.
  - **From the lists:** choosing an item in a list ("on the map", or a building's name) flies the map there and opens its card.
  - **Without WebGL** it falls back to the static outline map.

**Tests:**
- Typecheck clean; 69 unit tests pass.
- New browser tests:
  - Tabs carry context.
  - "Back to …" and the browser's Back work.
  - List buttons show only the name.
  - The map has layers, a base map choice, and a card on click.
- Full browser run: 166 passed and 5 failed. Three passed when rerun alone. The two admin tests depend on the local database.
- Screenshots checked: clustering with a hover label, a list item opening its card on the map, the dark base map, and the trail with tab targets.

## Four ways in: follow a thing, explore a year, follow a life, follow your interests (2026-11-17)

A small connected collection, built for all four modes at once: Vienna around 1900, a few places, 16 people and three "things", with shared records, images and sources.

**Implemented and tested:**
- **The collection** comes from Wikidata, built by `scripts/explore_collection.py` into `data/generated/explore.json`. Nothing is written by hand: every fact carries the Wikidata statement it came from.
  - **People:** each is found by exact name and checked against a birth-year range; the chosen QID and Wikidata's description are kept as evidence. 16 people, 10 relationships between them (teacher, student, spouse), and 82 works (buildings they designed, works they created, notable works), 74 of them with a credited Commons image.
  - **Things:**
    - Art Nouveau: 700 buildings, from 1890, the style's own start date; buildings begun earlier and remodelled later are left out.
    - Cafés: 370, from 1564.
    - Psychoanalysis: 368 people, placed where they worked.
  - It uses the Wikidata API rather than the query service, which was rate-limited during this work, and caches responses.
- **Where would you like to begin?** (Explore › Where to begin): four cards with credited images.
- **Follow a thing:**
  - Decade bars you click to narrow the list.
  - A map, and the places it appears most.
  - Each item links to its statement, and its year opens that year.
- **Explore a year:**
  - The best-documented records of each continent for that year.
  - Who in the collection was alive and how old they were, works dated that year, and how many of each "thing".
  - Earlier and later years. It says plainly that the records tell of events more than of everyday life.
- **Follow a life:**
  - Birth and death with sources, occupations and movements, and a timeline whose marks open that year.
  - A map, works with images and credits, and the people around them (documented relationships, and others named on the same work).
- **Your interests:** add things, people or years, on their pages or here. Suggestions then combine a thing, a life and a year, with lessons to go with them.
- **Moving between them:** every page ends in "Where to next" links into the other modes, so you can go from a year, to a life, to a style, to saved interests without choosing a mode again.

**Partially implemented:**
- **Only one well-covered period.** Explore a year works for any year from the world index, but the people and things are centred on Vienna around 1900.
- **No illustrations or annotations.** Images are Commons photographs and paintings with their credits.

**Tests:**
- Typecheck clean; 69 unit tests pass, including that every fact in the collection has a statement URL, that Freud and Klimt resolve to Q9215 and Q34661, and that the modes link to each other.
- Browser tests: the year → life → thing → interests journey, and the decade filter.
- Full browser run: 151 passed. The Austria journey tests and "a story remembers where you stopped" failed because the local test server had stopped serving correctly; they pass with a fresh server (2026-11-18).
- Screenshots checked: the home page with the begin cards, a life, a thing, a year, and interests.

## Simpler navigation, alternating lessons, and an atlas with a learning purpose (2026-11-17)

From an outside review of the site: too many sections, too many journeys at once, reading separated from practice, and an atlas that only collected records.

**Implemented and tested:**
- **Four main sections:** Learn, Explore, Review and My Atlas. Explore holds World Map, Stories and Connections as tabs; My Atlas holds Atlas, Saved and Profile. Old addresses still land in the right section.
- **Three recommended journeys** on Learn instead of the whole catalogue: one you started, the hand-checked journey, and ones matching the interests you choose right there. All journeys stay one click away under "Browse all".
- **Lessons alternate reading and practice:** each record is followed by one question about it, with feedback, before the next record. Questions about several records, such as putting them in order, come at the end.
- **Era colours:** one colour per era on lesson timelines and the lesson recap, always shown with the era's name.
- **Home map fallback:** if the map can't start (no WebGL, or its style never arrives within 15 seconds), the period's records are drawn as dots by longitude and latitude, still clickable, with a note saying why.
- **Moving progress between devices:** Profile now loads a progress file as well as downloading one, after a confirmation.
- **"Meanwhile, elsewhere…" after a lesson:** two events from other continents in the same years. For each, the reader decides "coincidence" or "documented connection", and the answer comes from the Wikidata statements on both records, linked when one exists. A missing statement is described as just that, not as proof of no link.
- **Restore a hidden link (My Atlas):** one of your stored, sourced links is hidden, and you restore it by its relation or by the missing entity. The answer is explained with its source, and the result goes to Review like any other answer.
- **My Atlas graph:**
  - Only sourced links and documented Wikidata statements are drawn; "same lesson" is no longer a link. Lesson-mates are listed separately in the side panel as "not a historical link".
  - People are placed above the focus, places below, earlier events left and later events right.
  - Nodes glide to their new places when the focus changes (no motion with reduced-motion settings).
  - Nodes are labelled cards with a type shape and icon; links have arrows and relation labels.

**Partially implemented:**
- **Teaching meaning before dates:** the lesson flow now alternates, but opening questions such as "why was crossing the Alps so difficult?" and annotated images need written, sourced content that doesn't exist yet. None was invented.
- **Detective cases:** one case exists (the Ringstrasse opening); expanding it into a series needs new sourced exhibits for each case.

**Planned:**
- Optional account sync. There is no backend for accounts; export and import are the honest substitute for now.
- Five carefully reviewed journeys. Only one journey is checked by hand. Reviewing more needs a person to compare each claim with its source; nothing was marked reviewed.

**Tests:**
- Typecheck clean; 64 unit tests pass, including lesson order, recommendations, eras and restore-a-link.
- Full browser run: 160 passed and 3 failed. Two home-map tests passed when rerun alone. The admin "linking puts a record on the site" test fails on the local database's state; it doesn't touch this work.
- Screenshots checked:
  - Learn recommendations
  - a question straight after the first record
  - the lesson-end quiz, answered
  - a restore question in My Atlas
  - the Explore tabs
  - the atlas graph before, during and after a focus change

## What makes TIMEWISE different: the lesson workspace (2026-11-17)

From a comparison with other history-learning products, and a mockup of a lesson screen. The identity: **learn one topic in short steps, then build a personal, source-backed map of how its people, places and events connect.** The loop: explore a connection, learn a short explanation, practise recalling it, and see it come back in a later lesson.

**Implemented and tested:**
- **Lesson workspace** (wide screens): a breadcrumb (path › lesson · lesson n of N) and step dots on top.
  - **Main column:** one idea per step. The text comes first, then the lesson's map with the current record's place highlighted, then the lesson's timeline with the current year marked. Choosing a year on the timeline goes to that record's step.
  - **Right column:**
    - **Connections:** the current record and up to four sourced links, each labelled, plus its sources.
    - **What joins My Atlas:** "seen in this lesson" while reading; what was added once the lesson is finished.
    - **Path progress.**
    - **Review prompt,** with the number due.
  - Phones stack the right column under the step.
- **Answers explained visually:** after each answer, the map and timeline show where and when the event was, among the lesson's other records, and the Connections panel shows its links. Before answering, the panel stays hidden so it can't give the answer away. A question with its own map doesn't repeat the lesson map.
- **Navigation follows the loop:** Learn, My atlas, Review (with a due count) and Profile come first; then, smaller, Discover, Explore, World Map, Stories and Saved.
- **Home:** "Learn history in short steps, and see how it connects", with the three steps: learn a short step, connect it in your atlas, practise it until it sticks.
- **Sources page:** "What TIMEWISE is for", with the four features: one idea per step, names you can open, your own atlas, and practice that explains. No competitor is named in the app.

**Tests:**
- Typecheck clean; 60 unit tests pass.
- Full browser run: 154 passed and 4 failed. The two non-API failures passed when rerun alone; the two archival-material tests need the local API.
- Screenshots checked: a reading step, an answered geography question, and the home header.

## Paths for every country, profiles, and My History Atlas (2026-11-17)

From two briefs: "Duolingo for history", for every country; and "My History Atlas", a personal network that grows with lessons.

**Learning paths: implemented and tested.**
- **Every country with enough records has a staged path:** 167 of 197 countries, 512 stages, by era (Antiquity, Middle Ages, 1500–1800, 1800–1914, 1914–1945, since 1945).
  - A stage needs four qualifying records located inside the country.
  - `scripts/journey_catalog.py` lists them.
  - The other 30 countries show "not enough records yet" on the learning map.
- **Austria: Empire to Republic**, the checked path, with period milestones.
- **New questions:**
  - "Where on the timeline does this belong?": choose the gap between dated records.
  - **People**, for the checked path: the people the collection names.
  - **People**, for other paths: humans recorded by a Wikidata statement (participant, founder, creator…), checked as human through the Query Service.
- **Recap:** key events in order, plus "Revisit later", which can add any question to Review.
- **Review is spaced.** A wrong answer is due now; each right answer moves it 1, 3, then 7 days out, then retires it. Review accuracy is tracked apart from everything else.
- **Learn page:** a daily goal (none to 3 lessons), the current and best streak with encouraging wording, eight badges for things actually done, and a review reminder.

**Profile** (`/profile`): implemented and tested.
- Private by default. "Shareable" makes a link that carries a summary (lessons, paths, accuracy, badges, countries). Nothing is uploaded.
- Continue where you stopped, current paths with Resume, quiz accuracy by skill, interests that suggest paths, completed lessons and paths, and badges.
- **Learning map:** a world map coloured by path progress.
- Saved items by type, the review queue, and download or delete of all progress.
- There are no accounts: the page says so, and shows no login or sync controls.

**Event cards and evidence:** implemented and tested.
- Four tabs: Why it matters, What came before, What changed, and Records from the time.
- **Records from the time** searches Europeana live (public API key) by the event's name and years. For Austrian events it looks in the Austrian National Library's holdings first.
  - Each item shows its holder, year and rights.
  - The tab says these are evidence about the event, not the event, and that matches are by name and date.
  - It also links to ANNO newspapers from the event's day (1700–1950, day precision), and offers searches on Europeana and the Library of Congress.
  - ANNO and the Library of Congress turn away scripts, so they are links only.

**Country views:** implemented and tested.
- "In Austria", "Involving Austria" and "Worldwide, same years" are explicit choices. The four detailed scopes are folded under "Fine-tune".
- A Map / Timeline / Stories switch:
  - Timeline: every listed event by century.
  - Stories: the country's path and the stories that involve it.

**My History Atlas** (`/my-atlas`): stages 1–3 implemented and tested.
- **Identity:**
  - `lib/entities.ts` gives one canonical id per entity: a Wikidata QID where known, otherwise `tw:<id>`.
  - `data/curated/austria/identities.json` resolves 14 of the 16 names in the checked collection by hand, each with the evidence (the item's description and dates against the event the name appears in), plus four checked events matched to their Wikidata items.
  - Franz Ferdinand and Theodor von Latour stay unlinked, with the reason.
  - No name is ever linked by matching alone.
- **Edges:** every edge has from, to, a precise label ("took place in", "led to", "participated in", "is named in the record of"…), a source, and a date when known. Sharing a lesson is never stored as an edge; it is lesson membership, drawn dashed as "same lesson (not a historical link)".
- **Entity panel:** names in lesson cards (the record, its place, resolved people) open a panel inside the lesson. It shows:
  - type, dates and a sourced description
  - a licensed image or an icon
  - how the entity connects to this lesson
  - up to three sourced relationships
  - "You've met this before" with the earlier lesson
  - Explore connections, and Save to my atlas

  Escape or close returns to the same card.
- **Four separate states:**
  - **Encountered:** the card was shown.
  - **Explored:** the panel was opened, or the entity was opened by its link in the atlas.
  - **Saved**
  - **Practised:** the lesson was finished.

  Finishing a lesson adds its central entities and sourced edges, and says, for example, "Your atlas grew: 4 new events, 3 new places, 1 new person, 6 sourced connections".
- **No duplicates:** an entity met again in another lesson extends the same node (unit-tested). The card shows "You've met … in an earlier lesson".
- **The atlas page:**
  - Left: search, type filters with a distinct shape per type, a path filter, "Explore next" (unexplored entities one sourced link from something explored, with the reason), and the whole atlas as a keyboard-accessible list.
  - Centre: the focus and up to six neighbours on fixed ring slots, with stable positions as "Show more" reveals up to twelve. Labelled edges, with sourced edges first. Unexplored links can be previewed from Wikidata, drawn dotted. Back, Reset view, and "Back to the lesson" when arriving from one.
  - Right: details, image, sources, the four states, sourced relationships, and the lessons it appeared in.
  - Bottom: a year filter.
  - Phones: the entity, then its connections as cards.
- **"Connect what you learned"** after a lesson: one question built from the stored edges (event to place, person to event, which relationship, or dated events in order with distinct years). It prefers links to earlier lessons, gives its source after answering, and sends wrong answers to Review. Nothing discovered is ever removed.

**Limits:**
- People are linked only in the checked collection, and wherever a lesson's Wikidata statements name a human.
- The checked collection's people are recorded as "named in the record of" their event, because the collection doesn't say what role they played.
- Historical-map layers (OpenHistoricalMap) aren't added yet.
- There are no accounts or sync.

**Security upgrade (2026-11-17):** Next.js 16.4.4 → 16.4.6, fixing a published advisory. `next build` now runs on the first try. Typecheck, 60 unit tests and the build pass. The full browser run gave 153 passed and 5 failed; the three non-API failures passed when rerun alone, and the two archival-material tests need the local API. `npm audit` still reports a critical advisory in `maplibre-gl` ≤ 6.4.0 (an XSS sanitiser bypass in `DOM.sanitize`, used by popups' `setHTML`). TIMEWISE never calls `setHTML`; popups use DOM nodes. The fix requires MapLibre 6, a major upgrade that hasn't been done yet.

**Tests:**
- Typecheck clean; 60 unit tests pass (9 new in `tests/unit/atlas.test.ts`).
- Browser tests: `tests/e2e/atlas-learning.spec.ts` (8 tests) covers this completion criterion: open a name, see a sourced relationship, save it, refresh, find it in the atlas; and meet the same person in a second lesson, with no duplicate.
- Full run: 143 passed. Every failure was rerun with one worker and passed after updating tests to the new labels, except the two archival-material tests, which need the local API.
- Screenshots checked: the entity panel, the atlas page, a lesson summary and the profile.

## Stories with a documented flow, a time graph, and brushing (2026-11-16)

From feedback: stories need a logical flow that argues something; Explore needed a better visualization; the search scope seemed to do nothing; the home map zoomed out on its own; years were hard to read; ranges couldn't be changed.

**Implemented and tested:**
- **Documented links.** `scripts/link_harvest.py` asks the Wikidata Query Service which statements connect TIMEWISE's 60,486 records. It covers has cause, has immediate cause, has effect, follows, followed by, replaces, replaced by, part of and significant event, and records how many references each statement has. It found 31,882 links where both ends are TIMEWISE records (`data/generated/links.json`).
- **Stories with a flow.** `scripts/story_catalog.py` builds 459 stories from those links, replacing the place-and-era stories, which had no flow.
  - **142 chains:** "How did A lead to Z?", or "What came between A and Z?" when most links are succession. Each step is joined to the one before by a statement of cause, effect or succession, and the dates must run forward. Chains of yearly repeats (elections, seasons) are dropped.
  - **317 episodes:** "How did X unfold?" ("What shaped X?" for states). The parts or significant events of a larger event, in date order. Lists of regional copies (a pandemic county by county) and parts that all fall in one or two years are dropped.
  - Every story states its claim (for example, "5 documented links lead from … to …: 3 of cause and effect, 2 of succession"). Every step shows the statement that links it to the previous step or to the whole, with a link to it and its reference count.
  - The step strip is now evenly spaced with years, instead of stacking markers whose dates are close.
  - Places read "in today's …".
- **Labels.** The per-card "Generated, unreviewed" badge is gone: everything imported is unreviewed. Only "Checked by hand" is marked, and the Sources page explains the rest once.
- **Sources page** (`/about`): now "Sources at a glance". It shows four source cards, a key for reading links, and the details folded.
- **Explore time graph** (now the default view): the record in focus is a red line at its date. Linked records sit at their own dates in lanes by kind of link, drawn solid when documented and dashed for shared time.
  - An overview underneath can be brushed: drag a rectangle to zoom, drag it to move, use the edges to resize, and double-click or "All" to reset. "Around it" zooms to 30 years either side of the focus.
  - Undated links are listed apart.
  - Cards and Map stay as alternative views.
- **World Map timeline:** drag across the count bars to choose a span. The best-documented records under the bars are now a labelled "Top records" row of dots, spaced so none overlap, and the selected record is named.
- **Search:** the World Map has a "This map: the world" scope. Changing scope shows at once what it covers and puts the cursor back in the box.
- **Home workspace:**
  - Choosing a record pans to it if it's off screen, and keeps the zoom; the map is framed only when the period changes.
  - The selected record's year is shown under its marker.
  - The range can be narrowed by dragging on the timeline or typing years, and stepped with the arrows.

**Limits:**
- Story links are Wikidata's statements. Some have no reference, and the step says so. Wikidata models some successions oddly; for example, it lists Goguryeo as "replaced by" the Tang dynasty.
- Episodes depend on Wikidata's part-of statements, so well-documented wars have far more than other subjects.

**Tests:**
- Typecheck clean; 51 unit tests pass.
- Full run: 139 passed and 4 failed. The two non-API failures passed when rerun alone. The two archival-material tests still need the local API.
- New browser tests cover the documented story steps, the time graph and its brush, the bar brushing, the search-scope hint, and the typed year range on the home page.
- Screenshots checked: the home workspace, a chain story, the time graph before and after brushing, and the Sources page.

## Generated stories and layout clean-up (2026-11-16)

From feedback on the live site: too few records on the home map, a crowded timeline, a cramped story layout, and too few stories.

**Implemented and tested:**
- **Home map:** all of the period's 150 best-documented records are now drawn as dots, and the top 40 are named where there's room. Clicking any record moves the focus there; the focus and its links stay as labelled bubbles.
- **Home timeline:** one row of at most 12 icon markers, spaced so none overlap. Every record of the period is a faint tick on the axis.
- **Navigation:**
  - The rail now sits outside the header. The header's blur had made the "fixed" rail move with the header, and the logo was clipped on full-screen pages.
  - The rail carries its own logo.
  - A test checks the rail stays at the left edge.
- **Story player** (`/journeys/…`): the text panel is wider (up to 620px, 44% of the screen), the chapter title is no longer squeezed by the Evidence/Story toggle, and the chapter list is folded.
- **Generated stories:** 253 stories, 224 of countries and 29 of continents, each a place in an era.
  - **Rules:** `scripts/story_catalog.py` writes them to `public/data/stories/`. The twelve qualifying records written about in the most Wikipedia languages are taken, then put in date order, three per chapter. For continents, at most two records come from each country. A story needs at least six records.
  - **Reader** (`/stories/read?id=…`): a full-screen map with numbered records, a wide text panel, and a numbered timeline across the bottom.
  - **Each step:** the Commons image with its credit, Wikidata's description, the Wikipedia summary folded and attributed, and the source with the reason the record is included.
  - **The end:** a recap, a question putting four of the records in order, and next stories.
  - Progress is saved, and the arrow keys work.
  - The Stories page lists them all, filterable by era, by country or continent, and by name. They are labelled "Generated" and "not checked by hand".

**Limits:**
- Generated stories are sequences of well-documented records, not narratives. They say nothing about causes, and they favour famous topics.
- Records at the same place (often a capital) overlap on the story map. The timeline strip and Next still reach each one.

**Tests:**
- Typecheck clean; 51 unit tests pass.
- Full run: 132 passed and 7 failed. Rerun with one worker, all of those passed except:
  - the two archival-material tests, which need the local API
  - the coverage-hover flake
- Screenshots checked: home, Stories, the story reader and the story player on desktop, and the reader on a phone.

## Fixes and the map-first workspace (2026-11-16)

From the fifth pasted brief (six issues and a layout reference), and a follow-up asking for the calmer, map-first look of the reference mockup.

**1. Duplicate markers: fixed and tested.**
- **Causes:**
  - Each hand-checked Austria event also had an imported Wikidata record, with no shared identifier, so both were drawn.
  - Wikidata itself holds twin items: 79 pairs with the same title, date and point across the region files.
  - No file repeats an ID.
- **The fix** is `lib/dedupe.ts`. It merges:
  - twins: same title and date, within 1 km
  - a checked event with its import: same year, within 30 km, and a distinctive word in common

  It merged four checked events in Austria: Königgrätz, German-Austria, Saint-Germain and the Carinthian plebiscite, all with their correct Wikidata twins. The record kept on screen lists the merged ones under "Merged records", with links.
- **Distinct records at the same spot** are not merged. The map marks them "+N", and clicking them opens a "N records here" list. Clusters that can't separate by zooming open the same list.

**2. Country maps: fixed and tested.**
- A country map now shows only records located inside today's borders by default.
- Optional sections, each with a count and a one-line explanation:
  - Linked, but located elsewhere (167 for Austria, mostly through earlier states)
  - Spans several countries
  - No location
- The list says whether a location is an exact point, a named place or the centre of an area.
- The choice is kept in the URL (`scope=`).
- The note says today's borders are used to sort records, not to show historical borders.

**3. Search: fixed and tested.**
- **Scopes, named for what they cover:**
  - Indexed records: 10,250 events, plus countries and the checked collection
  - Checked only
  - This map: on country and continent maps, every record on that map
  - Wikidata (live)
- "Everything" is gone.
- **States:** a status line shows searching, the result count and source, no results (with buttons to try another scope), and errors with a retry.
- **Input:**
  - Enter opens the selected or first result.
  - Arrow keys move through results.
  - Results respond to touch: pointer-down keeps focus, so the list no longer closes before the tap lands.
- Results from "This map" keep the map's filters.

**4. Connections: redesigned and tested.**
- The radial graph is gone. In its place:
  - a focus card for the record
  - its links as icon-led cards grouped by kind (causes and effects, before and after, people, places, parts, ideas), four per group with "Show more"
  - shared-time and shared-country links in a separate dashed section, labelled as coincidences
- Choosing a card steps to that record. "Why" opens the reason and the source.
- Back, Reset and the path sit above the cards.
- No clipping at phone width (tested).

**5. Timeline bars: fixed and tested.**
- Every bar with records is a real button: click, touch, Enter and Space. It is labelled as a count of records in this dataset.
- A bar zooms in. At single years it lists that year's records.
- Empty periods are drawn as plain shapes, not buttons.
- Once the range is 120 years or less, marks under the bars stand for the best-documented records. Choosing one opens the record and moves the map.

**6. Journeys: implemented and tested.**
- 55 journeys and about 230 lessons:
  - the checked question path
  - region: 6
  - topic: 21 (war, politics, culture and states, by continent)
  - place: 24 countries
  - period: 3
- They are generated by fixed rules. `scripts/journey_catalog.py` writes `lib/journey-catalog.json`, which lists only lessons with enough qualifying records.
- Every generated lesson says how its records were chosen and is labelled "Generated, unreviewed".
- Each lesson intro shows its records on a small map and a timeline.
- Journeys can be browsed by question, topic, period, region and place on Stories and Learn, with difficulty, length and progress. They can be saved and shared.
- **No person journeys:** the data has no person index. Person links appear only in the connections explorer, from Wikidata statements.

**Layout and icons:**
- `components/icons.tsx` holds about 30 original line icons, drawn on a 24-unit grid from basic shapes, for record kinds, link kinds, categories and the interface.
- Navigation is a left icon rail on wide screens and a tab row on phones.
- **The home page** is now a map-first workspace, like the reference:
  - the record in focus, with its documented Wikidata links (solid) and same-time records (dashed) as labelled bubbles on a real map
  - a period selector
  - an icon timeline underneath that changes the focus
  - a short record panel: date, Commons image with credit, two facts, source chips, Connections and On the map buttons, a folded "Why this record?", and linked records
  - three cards below

  The long home sections were removed. Their content is on Learn, Stories, the World Map and About.
- The reference's painted illustrations were not reproduced. Images are real Commons files with credits, or an icon placeholder.

**Tests:**
- Typecheck clean; 51 unit tests pass (4 new in `tests/unit/dedupe.test.ts`).
- 14 new browser tests: `tests/e2e/fixes.spec.ts`, plus new tests in `connections.spec.ts`. Updated tests: search, connections, atlas and lessons.
- Full run: 131 passed and 5 failed. Rerun with one worker, the atlas failures passed. Still failing:
  - the two archival-material tests, which need the local API
  - the known coverage-hover flake
- Screenshots checked: desktop (1600 and 1280, light and dark), 1024, and phone.

**Limited by data or services:**
- Person, trade and influence journeys need a person index and documented links that the data doesn't have.
- The home workspace's documented links need Wikidata to be reachable. Without it, only same-time records are shown, and the panel says so.
- Stacked-record lists can't be tested automatically without driving the map canvas.

## Learning paths and lessons (2026-11-16)

Built from the fourth pasted brief ("Duolingo-like… but centered on exploring real history"). **Learn** (`/learn`) replaces the older Learning Hub page. `/challenges` stays and now sits under Learn in the navigation. Its older activity pages (`/learn/activities/…`, `/learn/graph`) are still reachable but no longer linked from the Learn page.

**Implemented and tested:**
- **The core loop:**
  1. pick a path
  2. a short lesson with an intro, one card per record, then 3–4 questions
  3. an explanation and its sources after every answer
  4. a summary: score, XP, skills, what was learned, what the lesson couldn't cover, and the next lesson
  5. links onward to the records' connections

  A lesson's step is saved as you go. The Learn page and the home page offer "Continue: …", and leaving a lesson keeps your place.
- **Paths** (`lib/lessons.ts`):
  - **By question (checked):** "How did Austria change between 1844 and 1921?" has six lessons, one per chapter of the checked investigation, with milestone markers at the period boundaries.
    - Every card is a curated event with its sourced claims, support status and source links.
    - Questions are assembled from that data, not written: put in order; where did it happen (with a map of the options); which source supports this statement; what does the evidence establish (including the disputed Sopron vote).
  - **By region:** each continent through five centuries, 1500s to 1900s.
  - **By period:** the 1800s and the 1900s, one lesson per continent.
  - Region and period lessons use imported Wikidata records and are labelled **Imported, not checked by hand**. Each picks four well-documented events of the century from four different countries, using Wikidata's own title, date, place and short description.
    - Questions: order them; where did it happen; which record matches this description.
    - A cause-and-consequence question appears only when a Wikidata statement documents a cause or effect. It links to the statement and gives its reference count.
    - Where fewer than four suitable records exist, the lesson says so instead of padding.
- **Skills:** chronology, geography, evidence, and cause and consequence. Each answer counts towards its skill, shown as correct out of attempted.
- **Review** (`/learn/review`): missed lesson questions are stored with the question itself and asked again, with the explanation. A right answer clears them. Missed challenge answers are listed with a link back to the challenge.
- **Return without pressure:** "This week" shows the days learned, with the note "Breaks never cost you progress". There is no streak to lose.
  - XP is earned once per lesson, like the challenges, so replays can't farm it.
  - Suggestions: the unfinished lesson; else the next lesson in the path last used; else the checked path.
- **Home:** the first actions are "Start learning" (or "Continue: …"), "Choose a path", "Follow a story" and "Explore connections", above search.
- **Accessibility and phones:**
  - Each question is a radio group with a separate Check button. Ordering uses arrow buttons.
  - Focus moves to each new step's heading, and feedback moves focus to Continue.
  - Pages have no horizontal scroll on phones.
- **States:** loading, a failed data file (with a retry), an unknown lesson, and "not enough records".

**Limits:**
- The checked material is small: 19 events and 27 claims, so six lessons.
- The checked collection records no causes or effects, so its lessons ask no cause-and-consequence questions, and each says so.
- Imported lessons favour famous topics and may contain Wikidata errors. Their descriptions are short and written by volunteers.
- Progress lives in one browser.

**Planned, not built:**
- More checked paths, which need sourced claims first.
- Comparing perspectives beyond the one disputed claim.
- Adaptive scheduling for review; for now everything missed comes back.
- Interest-based recommendations beyond "next in the path you used".
- Accounts and sync.

**Tests:**
- Typecheck clean.
- 47 unit tests pass, 6 new in `tests/unit/lessons.test.ts`. They check that lesson content comes only from curated events and claims, that every answer is among its options and has an explanation and a source, that ordering answers match the dates, that checked lessons ask no cause question, and that imported paths are labelled.
- New browser tests in `tests/e2e/lessons.spec.ts` cover the learn page, a full checked lesson, resuming, review, an imported lesson and phone layout. They pass, except that the first check on `/learn` timed out once in 8 repeats while the page's JavaScript was still loading from the local test server.
- Full browser run (2 workers): 112 passed and 6 failed. Four of the failures passed when rerun with one worker. The two archival-material tests need the local API and still fail.

## Connections explorer (2026-11-16)

Built from the third pasted brief ("an interactive history explorer… not a dump of facts"). It's a new section, **Explore** (`/connections`), built into the existing site; every other page still works.

**Implemented and tested:**
- **Search** covers anything in Wikidata (events, people, places, inventions, ideas), searched live. The header search has a new "All Wikidata" scope, and every imported event panel links to "Explore connections".
- **Network view.** The record sits in the middle with its links around it, grouped by kind: causes and effects, before and after, parts, people, places, ideas and works.
  - Each line is labelled with its relation ("led to", "participant", "discoverer or inventor"…).
  - **Documented** links come from Wikidata statements: about 40 properties on the record's own page, plus 7 kinds of statement on other pages that point to it (e.g. events a person took part in). Each keeps its property, a link to the statement, and the number of references Wikidata gives. "No reference" is said plainly.
  - **Contextual** links are dashed, amber and labelled "same period" or "same country". They come from the TIMEWISE world index, and each one says no relationship is documented.
  - **Checked** links: for a place in the hand-checked collection, its checked events, with sourced claims.
  - Selecting a record shows why the two are connected and offers "Explore from here". A double-click or Enter branches directly.
  - The same links are listed for keyboard and screen-reader use.
- **Timeline and Map views** use the same links.
  - Years, coordinates and countries come from the Wikidata Query Service.
  - The map shows today's borders and says so.
  - Records without a date or place are counted, not guessed.
- **Filters:** kind of link, contextual links on or off, a year range and a country.
- **Record panel:**
  - kind and type, date at Wikidata's precision, and place
  - the Commons image with its credit
  - the Wikipedia summary, attributed (CC BY-SA 4.0, "not checked by TIMEWISE")
  - context (part of, caused by), and significance, meaning only what Wikidata records as effects or successors ("TIMEWISE doesn't rank importance")
  - connection counts
  - "Sources and coverage", which shows the statement count, the share with references and the gaps (no date, no coordinates, no summary, no image), with a link to correct it on Wikidata
- **Paths:**
  - The trail of opened records is kept in the URL and can be shared, or saved to My Collection as a named collection.
  - "Next in sequence" follows Wikidata's own followed-by statements.
  - The start page lists the existing guided stories and the checked places.
- **Connection challenge:** "Which of these does Wikidata link as 'led to'?", answered and explained from the statements. It's practice only: no XP, because the data is crowd-edited and changes.
- **Fallbacks:** a loading state; an error with a retry when Wikidata can't be reached; and a note when dates can't be loaded.
- **Phones:** the filters scroll in one row and the graph shortens its labels. There's no horizontal page scroll.

**Limits:**
- Everything in the explorer except the checked links is imported and unreviewed. Wikidata is crowd-edited, and some statements are wrong or unreferenced.
- Links are capped at six per property and 30 drawn nodes (the rest are in the list).
- "Same period" and "same country" draw only from the 10,250-event index.
- The explorer needs a connection to Wikidata.

**Planned, not built:**
- **Comparing perspectives:** Wikidata doesn't hold perspectives, and the checked collection has only one disputed-claim case (the Sopron vote, in `/explore`). This needs sourced, attributed interpretations first.
- **Inferred links** beyond shared period and country.
- **Offline use:** this needs a snapshot of the linked records.

**Tests:**
- Typecheck clean; 41 unit tests pass (8 new, in `tests/unit/connections.test.ts`).
- 7 new browser tests (`tests/e2e/connections.spec.ts`) pass on desktop and phone against live Wikidata. One of them blocks Wikidata and checks the error state.
- Full browser run: 93 passed and 14 failed with two workers. Rerun with one worker, everything passed except:
  - the two archival-material tests, which need the API
  - the known coverage-hover flake
  - a mobile story-map check that failed 2 of 3 repeats, in code this change doesn't touch
- Admin specs weren't run.
- Screenshots checked: desktop dark and light, and phone dark.

## Redesign: discovery, stories, challenges and collections (2026-11-15)

Built from the second pasted redesign brief, in its order A to E. The site is static (GitHub Pages), so everything personal is kept in the reader's browser and says so.

**A. Data presentation and navigation: implemented and tested.**
- Country attribution fixed. The overview tagged each event with the alphabetically first country it was imported for (American Revolutionary War → Albania, Spanish Civil War → Andorra, Second World War → Afghanistan). `overview.attribute()` now gives every copy `nc` (countries it is filed under) and `home` (the one country whose outline contains it). From 5 countries an event is "Multiple regions (N countries)"; from 15 it isn't pinned to a point. The Spanish Civil War is now Spain; the world wars, the Cold War and COVID-19 read as multiple regions. 9,049 multi-country copies across 60,486 events.
- Dates that disagree: 21 records whose name gives another year than their date (e.g. "1988 Malian parliamentary election" dated 1998) carry `titleYear` and show a warning. Limited to dated categories; "228 Incident" and street addresses are excluded.
- Wording: constitutions read "… adopted"; 4,571 museum records that are really buildings, camps or objects lose "Founding of" and are labelled "Date it came into being". Universities, monasteries and museums keep "Founding of".
- `python -m timewise_api.overview` (from `apps/api`) reruns all of this from the exported files without the database; the database export runs it too. Tests: `tests/py/test_overview.py`.
- Navigation is Discover · World Map · Stories · Challenges · My Collection, with the current section underlined and old addresses mapped to their section (`/history`, `/explore` → World Map; `/journeys` → Stories; `/learn` → Challenges). Global search sits in the header on every page, with a visible scope (Everything, Checked, World records, Places). It covers the checked collection and a new 10,250-event world index (`public/data/index.json`, loaded on first use).
- Internal fields such as `manual-curation-v1` no longer appear in reader views. The review status is a compact badge (Imported, Source-checked, Expert-reviewed) whose explanation opens on click.
- "Report an issue" opens a pre-filled GitHub issue (public; needs a GitHub account).

**B. Home page and map explorer: implemented and tested.**
- Home page:
  - one headline and three actions (Follow a story, Explore the world, Play today's challenge)
  - search with its scope, and "Continue your journey" when progress exists
  - the detective case, today's challenge, and "Meanwhile, elsewhere…" by year
  - browsing by period, theme and region, and a compact trust section

  Methods, coverage and the planned questions moved to `/about`.
- `/atlas` is now the world map (the 6,000 best-documented events). The coverage map and country table moved to `/atlas/countries`.
  - Desktop: a collapsible filter sidebar, a dominant map, one event panel and a synchronized timeline. Focus mode hides everything but the map.
  - Phones: a full-width map, with filters and the list in a drawer and event details in an expandable bottom sheet.
- Map:
  - clusters at wide zooms
  - a letter in each point naming its category, so colour is never the only cue
  - the selected event marked on both the map and the timeline
  - "Fit results", a collapsible key, and a "Today's map, not historical borders" label
  - a loading state, and a fallback with a retry when the base map fails
- Timeline:
  - buckets by century, decade or year, depending on the span shown
  - date presets, a typed year range, and Wider and Reset controls
  - chart labels saying they count records, not importance
  - the range, themes, event and comparison kept in the URL
- The event panel runs in this order:
  1. title, date, place and image (the credit expands)
  2. what happened
  3. why it matters, using only Wikidata's own part-of, cause and effect statements
  4. connected events, then "Meanwhile, elsewhere"
  5. a private note
  6. one "Sources and evidence" section

  Exact, approximate, range and longer-process dates are labelled.

**C. Stories, challenges and progress: implemented and tested.**
- `/stories`: story cards showing place, period, minutes, difficulty, progress and the learning question. The authoring structure is in `apps/web/src/lib/stories.ts`.
- The story player:
  - saves the last step and offers to resume with a banner
  - opens with an intro and a chapter list
  - defaults to the shorter story view, with the evidence one tap away
  - lets each step be saved and annotated
  - ends with a timeline recap, a then-and-now slider (Austria-Hungary 1914 against Austria 1920, community-digitized and labelled coarse), a short challenge and the next story

  The duplicated "All claims in this chapter" block is gone.
- `/challenges`: 16 challenges in five formats (put in order, find it on the map, date the image, match the source, what does it establish), all built from the checked collection (`lib/challenges.ts`).
  - The order is shuffled, and challenge mode hides dates.
  - Practice mode gives hints and isn't scored.
  - Every answer is explained, with its source.
  - Arrow buttons replace dragging, and the map task has a list alternative.
  - XP is earned once per challenge and once per daily challenge, never in practice.
  - There's a daily challenge and a review list of past mistakes.
- The older story activities (`/learn`) no longer show dates before the answer is checked.

**D. Meanwhile, elsewhere and a detective case: implemented and tested.**
- For any event, the panel shows:
  - one well-documented event from each other continent, within a window that depends on the period (25 years in antiquity, down to 2 years after 1800)
  - how far apart the two are
  - a side-by-side timeline against a chosen continent, and a share link
  - a note that a shared date is a coincidence, not a connection

  The events are chosen automatically from imported records, not curated, and are never linked as causes.
- The detective case "The case of the missing opening day" (`/challenges/case/ringstrasse`) has:
  - three exhibits from checked claims: the 1857 decree, the 1865 opening with the 1858 stretch, and today's street drawn from OpenStreetMap
  - four explanations, including "it depends on what counts"
  - an evidence-based verdict on each explanation

**E. Collections and monetization foundations: implemented and tested.**
- `/collection` holds saved events, named collections shown as timelines, notes, story progress, places explored, topics to revisit, and XP. A collection can be shared as a link that carries its contents (nothing is uploaded), and all the data can be downloaded and loaded again.
- `/plans` shows the proposed Explorer (free) and Timewise Passport (€4.99/month or €39/year; story packs €5–9) plans, marked "Nothing is for sale". There is no payment code. "Tell us you're interested" opens a public GitHub issue. The prices are constants in the page.

**Planned, not built:**
- accounts and cross-device sync
- a working interest-registration backend (GitHub issues stand in for now)
- more stories and cases, each of which needs sourced claims first
- friend challenges
- everyday-life collections and cause-and-consequence diagrams, which have no sourced content yet
- curated "meanwhile" pairs
- a then-and-now slider for Vienna's walls, which needs a georeferenced historical plan with known rights

The curated `/explore` workspace keeps its earlier layout.

**Limits:** imported records are unreviewed, and "best documented" favours famous and European topics. Progress lives in one browser. Reporting an issue needs a GitHub account.

**Tests:**
- Typecheck clean; 33 unit tests and 65 Python tests pass.
- Browser tests ran on a static build without the API. In the last full run, 93 of 100 passed.
- Of the 7 failures, 4 passed after test fixes: the phone list moved into a drawer, and some pages loaded slowly under parallel runs.
- Still failing:
  - the two archival-material tests, which need the local API that a static build doesn't have
  - the world-map hover test, the known flake under load
- The admin specs weren't run.
- Screenshots were checked on desktop and phone, in light and dark. They caught a zero-height map (MapLibre sets its container to `position: relative`) and a 37px overflow on phones; both are fixed.

## Historical Journeys

**Implemented and tested: one journey, "How Austria Changed, 1848–1921", at `/journeys/austria-1848-1921`.** 8 chapters and 19 steps.

- Each chapter has a question, narrative, connection to earlier chapters, map view, events, images and summary. Next, Back, arrow keys, chapter bar and shareable links all work.
- Time moves smoothly between steps, and shapes appear or disappear as their dates pass. The camera frames around the story card.
- **Every paragraph must cite claims from its own chapter's events, and validation rejects anything else.** Each has "Inspect evidence". A unit test also blocks common causal words in the narrative, since sources here don't establish cause. That test is a simple word check, not a guarantee.
- Stored in the database and built from the export, like the rest of the content.
- Limits: the narrative is thin, because it can only say what the 27 claims support. There's a 32-year gap between 1882 and 1914, which the journey states openly. No interactive questions, no before-and-after view, no real territorial animation, and no fortification data for Vienna. English only.

## Learning Activities (Education Plan Phase 1)

**Implemented and tested: 8 evidence-grounded learning activity types integrated into the Austria journey.**

| Activity | Type | Grounded In | Status |
|----------|------|-------------|--------|
| Timeline Ordering | Drag-drop chronological sorting | 4 events from Chapter 1 | Implemented and tested |
| Source Matching | Claim-to-passage matching | 3 claims + 3 sources from Ch. 1 | Implemented and tested |
| Interpretation Rating | Support status classification | 4 claims from Ch. 2 | Implemented and tested |
| Map Placement | Click-to-place on AtlasMap | 3 events with geometries from Ch. 3 | Implemented and tested |
| Change Detection | Map layer comparison | 4 geometries across 2 timepoints (Ch. 3) | Implemented and tested |
| Evidence Gap Finding | Identify missing evidence per claim | 4 claims from Ch. 4 | Implemented and tested |
| Causal Reasoning | Build causal chains with confidence | 5 events from Ch. 5 | Implemented and tested |
| Perspective Taking | Contemporary vs retrospective (Hindsight Mode) | 4 events from Ch. 6 | Implemented and tested |

### Components Created
- `packages/historical-schemas/src/learning.ts` — Zod schemas for all 8 activity types, answers, progress, FSRS, skill trees, certificates, entitlements, educator classes
- `apps/web/src/lib/learning-activities.ts` — 8 activities for Austria journey grounded in specific claim/event IDs
- `apps/web/src/components/learning/ActivityRenderer.tsx` — Polymorphic renderer dispatching to activity components
- `apps/web/src/components/learning/TimelineOrdering.tsx` — Drag-drop chronological ordering
- `apps/web/src/components/learning/SourceMatching.tsx` — Claim-to-source passage matching
- `apps/web/src/components/learning/InterpretationRating.tsx` — Support status classification
- `apps/web/src/components/learning/MapPlacement.tsx` — Click-to-place events on map with haversine validation
- `apps/web/src/components/learning/ChangeDetection.tsx` — Map layer comparison (appeared/disappeared/modified)
- `apps/web/src/components/learning/EvidenceGapFinding.tsx` — Identify missing evidence types per claim
- `apps/web/src/components/learning/CausalReasoning.tsx` — Build causal chains with confidence levels
- `apps/web/src/components/learning/PerspectiveTaking.tsx` — Hindsight Mode contemporary vs retrospective comparison
- `apps/web/src/components/learning/LearningModeToggle.tsx` — JourneyPlayer integration with progress tracking, FSRS, localStorage persistence

### Integration
- `LearningModeToggle` added to `JourneyPlayer.tsx` — appears at end of each chapter, shows progress bar, XP rewards, activity navigation

### Architecture Compliance
- All activities use existing claim/event data only — no fabricated content
- Bilingual (EN/DE) throughout
- Each activity teaches a specific historical thinking skill per spec
- Answers validated against ground truth from `correctAnswer` in activity definition
- Progress persisted to localStorage with FSRS scheduling for spaced repetition

### Remaining for Phase 1 Completion
- API endpoints for progress submission (`apps/api/src/routes/learning.ts`)
- Database tables for `user_activity_progress`, `certificates`, `entitlements`, `educator_classes`
- Skill tree visualization component
- Certificate generation (PDF + verification)
- Premium journey entitlement checking
- Educator dashboard for class management
- Unit tests for activity answer validation logic

## Journey Mode Redesign (2026-11-13)

**Addressed user feedback: "Journey mode has too much text and in the end not so much information to be used."**

### Changes Made to `JourneyPlayer.tsx`

| Change | Before | After |
|--------|--------|-------|
| **Default view mode** | Narrative-only (long prose segments) | **Compact mode** (evidence-driven, claim-first) |
| **View mode toggle** | None | Compact / Narrative buttons in chapter header |
| **Information density** | Low — prose paragraphs with hidden evidence | High — claims shown upfront, event details inline |
| **Evidence access** | Click "Inspect evidence" per segment | Claims visible by default; all chapter claims expandable |
| **Navigation** | Segment-by-segment prose | Beat-by-beat with claim summary per step |

### Compact Mode (New Default)
- Shows **key claims for the current event** immediately — no prose wall
- Event details (date, place, title, summary, media) in a compact card
- **Expandable "All claims in this chapter"** section for context
- Chapter summary at end of chapter (unchanged)
- Learning activities still accessible via `LearningModeToggle`

### Narrative Mode (Preserved)
- Original prose segments with "Inspect evidence" disclosure
- Unchanged for users who prefer the reading experience
- Accessible via the view mode toggle

### ClaimCard Compact Variant
- Added `compact` prop to `ClaimCard` in `EvidencePanel.tsx`
- Compact: support badge + statement inline, sources as minimal links with passage preview
- Full: original detailed view with full passages, source metadata table

### Testing
- Typecheck: Pass
- Production build: Pass (414 static pages generated)
- Journey route `/journeys/austria-1848-1921` prerendered successfully

## Archive ingestion

**Europeana connector: implemented and tested against the live API. 106 real records imported.**

- Built: connector interface, search, cursor pagination, rate limiting, retries, rights classification, deduplication by provider ID, run logging, tables `archive_records` and `ingestion_runs`, API routes `/archive-records` and `/ingestion-runs`. Run it with `.venv\Scripts\python ingestion/connectors/run_import.py 25`.
- First import: 66 images and 40 texts. 63 records are marked reusable, 43 link-only. Every record has a rights statement, institution, link and preview; only 34 of 106 have a structured year and 44 a creator.
- Rights default to link-only. Only CC0, Public Domain Mark, CC BY and CC BY-SA count as reusable. These are the providers' own statements, not checked by us.
- **Search relevance is noisy.** A willow specimen came back for "Brennerbahn". Nothing checks relevance yet, which is why records stay at `imported`, don't appear on the site, and aren't evidence for any claim until a person links them.
- Promising leads, unreviewed: 1886 Semmeringbahn photographs (Swedish National Museum of Science and Technology) and 1848 pamphlets (Vienna City Library).
- Not built: full-record and IIIF retrieval, incremental sync beyond re-running.

### Record review

**Implemented and tested, end to end in a browser, using a test record** (31 Playwright tests pass, 5 skipped). The failing test was a real bug, now fixed: a slow older list reply could overwrite a newer one.

Triage on 2026-11-02: Claude rejected 16 clearly off-topic records, logged with reasons and reversible from the Rejected tab. The other 90 stay unreviewed. Claude shortlisted 5, the owner approved them, and they're now live as "illustrates", with their images checked by eye against the catalogue details. **This is the project's first primary material on the site**, and it meets the Phase 2 goal of a real record, linked through review, appearing as evidence and tracing to database rows. No historian has checked them, and no claim's support status changed, and the other 85 unreviewed records stay hidden.

- `/admin`: list, filter, reject, reopen and link records. A link needs a claim, a relation (primary evidence, illustrates or context) and a written reason. Every decision goes in `record_review_log`.
- Linked records appear at once under "Archival material" in the event panel. That panel needs the API running (`npm run api`), and stays quiet if it isn't.
- A link never changes a claim's support status. Images show only when the stated rights allow reuse; otherwise it's a link.
- **Login is one shared admin key, suitable only while the API runs on your own machine.** Replace it with Supabase Auth before hosting. There's no limit yet on repeated key guesses.
- Partial: the data-quality dashboard exists only as `/admin/quality` in the API, with no screen.

## Next implementation milestone

**TIMEWISE 2.0 Phase 2, first task: a database and one real archive connector.**

Database: hosted PostGIS on Supabase, connected.

1. Done: migrations, idempotent seed, read-only API, row-level security.
2. Done: the site is built from a database export (`npm run sync:db`). Curated JSON files are still the editing source; the seed copies them in.
3. Not done: the site doesn't call the API at runtime, and the API isn't hosted. Live calls become necessary once imported records change between builds.
4. Done: connector interface and the Europeana connector.
5. Done: the review screen.
6. Done: the first 5 real records are linked and live.
7. Done: the first Historical Journey.
8. Done: first full-history import and atlas for Austria.
9. **Next:** check a random sample of imported events to measure real accuracy, then add a second country to prove the path works. Society, economy and daily life need sources beyond this import.

## Four ways in: live lookups, the life scrubber, more stories, explorer profile (2026-11-20)

**Implemented, type-checked; not yet run through build, unit or browser tests on Windows.** The live Wikidata queries were tried against the real query service (Mozart, Einstein, lighthouses, Gothic architecture, Impressionism, the French Revolution, World War II).

- **The life, in time** (`LifeTime.tsx`): scrub a life year by year, play it, or set the frame (one year, 5 years, a decade, the whole life). Each stop shows age, dated moments (works, studies, jobs, offices, awards, marriages, homes, children's births, each from a qualified Wikidata statement), people around them who were alive, and well-documented world events from the index. The map shows the life up to the end of the frame.
- **Any person** (`/explore/life?q=<QID>`): looked up live on Wikidata in the browser (`lib/live.ts`). Search covers the 16 prebuilt lives, 114 featured names (`lib/featured.ts`, matched by name and birth years as the build script does, and the page says what was matched), and all humans on Wikidata. "Surprise me" picks a featured life; "Wildcard" a random human with a portrait. Prebuilt lives also get live dated moments.
- **Any thing** (`/explore/thing?q=<QID>` or `?find=<words>`): style (P149), kind (P31/P279*), genre, movement with coordinates and a date; or people in a field, occupation or movement, at their birthplace. Very broad kinds can hit the query service's time limit, and the page says so.
- **Stories**: `scripts/story_catalog.py` now makes 1,100 stories (was 459): chains may start mid-web, episodes need three parts, and a new "place" kind tours a country's best-documented records per era, labelled as a tour, not an argument. Plus `/stories/live?q=<QID>`: any event told on the spot from its causes, parts and effects, each step citing its statement, with Wikipedia's summary under CC BY-SA. Story search and two surprise buttons on `/stories`.
- **Profile, playful**: `lib/explorer.ts` keeps lives, things, years, stories, surprises and lookups in this browser; XP, seven levels and 16 badges in three tiers, a toast when one is earned. Shown on a "Your profile & badges" tab under Your interests, on `/profile`, and as a level chip in the mode bar. Interests saved from live pages keep their names; suggestions include "Because you explored".
- Planned: precompute featured lives into `explore.json` (needs the build script run with network access), cache live lookups.

## Timeline game, places, causes network, story memory, fact or myth (2026-11-20)

**Implemented and type-checked in isolation; not yet run through the Windows build, unit or browser tests.** The new Wikidata queries were tried live (Vienna, Athens, Mozart, Einstein, Shakespeare, the French Revolution, World War II); slow query shapes were rewritten.

- **Build your own timeline** (`/challenges/timeline`): endless rounds from the world index, by era, region and difficulty (5 far-apart famous events up to 8 within ~60 years). Drag or use arrows; the reveal shows the true timeline and a map (coordinates fetched live). Perfect rounds build a streak; swapped pairs become review questions.
- **Explain this place** (`/explore/place`): any place on Wikidata. Summary (Wikipedia, CC BY-SA), founding, population chart (P1082), a per-century bar of records with a list for each century: landmarks as built (P131 + P571, sub-divisions left out), events located there (P276, sports results left out), people born there (P19). Map of landmarks, and a "Visiting?" guide ranked by documentation, said so.
- **Why did this happen?** (`/explore/why`): causes left, consequences right, as an SVG network grown by clicking (has cause, has effect, immediate cause, follows, followed by). Each arrow names its statement; the page says absent arrows are gaps in the record. Linked from live stories.
- **Story memory** (`lib/memory.ts`, on `/learn/review`): finished stories, live stories read to the end, lives scrubbed to the end and timeline mistakes become questions (which came first, which year, how old), asked at 1, 3, 7, 16, 35, 90 days.
- **Fact or myth?** (`/challenges/fact-or-myth`): birth and death dates and places of well-known people, judged as supported (referenced, unqualified), uncertain (circa, disputed…) or marked wrong (deprecated, with the editors' reason). Dates are shown as the statement writes them, in their own calendar. Verdicts are Wikidata's recording, not TIMEWISE's judgement, and the page says so.
- Explorer XP and six new badges for these; links from Where to begin, the Explore tabs (Places, Why?) and Challenges.
- Not built: Ask History (free questions answered in prose) — it needs a language model and the no-simulated-AI rule applies.

## Speed, loading and more open data (2026-11-20)

**Implemented and type-checked in isolation; not yet run through the Windows build or browser tests.** The new sources were tried live from a browser.

- **One cache for every live request** (`lib/cache.ts`): the same question is asked once per visit and kept a week in the browser's Cache Storage, so going back to a person, thing, place or story is instant. Leaving a page no longer cancels its request, so the next page gets the answer. Search results start loading on hover.
- **Things answer in seconds**: a quick first query (direct members, a few hundred) shows the map and decades at once; the full query (every subclass) replaces it when ready. If the full one times out, the quick answer stays and the page says it is partial.
- **No more blank placeholders**: live pages show what is being looked up, step by step with a clock, and the Wikipedia summary and picture to read meanwhile (`Working.tsx`).
- **Beyond Wikidata** (`lib/opendata.ts`, `MoreSources.tsx`, loaded only when scrolled into view): Europeana (archives, libraries, museums; pictures shown only under open licences, others linked, rights named), Wikimedia Commons photos taken near a place, Open Library books. Our World in Data population estimates on Explore a year and in the life scrubber. Europeana uses its public demo key unless `NEXT_PUBLIC_EUROPEANA_KEY` is set; get a free key before publishing widely.
- Tried and not used: the Met's search API (retired), Art Institute of Chicago and Library of Congress (they block requests from other sites), Overpass (often overloaded).
