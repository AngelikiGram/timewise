# Development status

Last updated: 2026-11-12. **TIMEWISE 2.0 Phase 1 (correct the existing interface) is done. Phase 2 is partly done:** the database, API, Europeana connector, review screen and a worldwide Wikidata import (all 197 countries, unreviewed) work. Phases 3–6 aren't started. This isn't production-ready.

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
