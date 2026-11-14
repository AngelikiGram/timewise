# Architecture

## Phase 1 (built)

```
data/curated/austria/collection.json   region package: places, events, claims, sources
        │ validated at load by
packages/historical-schemas            zod schemas + referential integrity checks
        │ read by
apps/web/src/lib/collection.ts         lookups and display rules
        │
apps/web/src/lib/store.ts              shared state: selected event, date, themes, playback
        ├── Narrative   (Workspace.tsx)
        ├── AtlasMap    (MapLibre)
        ├── Timeline    (d3-scale + SVG)
        └── EvidencePanel
```

All four panels read one Zustand store. Selecting an event anywhere sets both the selection and the date, and scrubbing the date selects the latest event at or before it. The URL holds the selection, so views can be shared.

## Decisions that later phases rely on

- **Claims are separate from events.** An event's display text is not its evidence; a claim cites sources through a `locator` phrase that can be machine-checked.
- **Support status has a `reference` value** beyond the spec's list. Most current evidence is a reference work, and calling that "documented" would overstate it.
- **Dates carry precision.** `formatWhen` never displays more precision than the record holds.
- **Places use Wikidata IDs and multiple names.** Nothing downstream names a country, so new regions are added as data.
- **Geometry carries its own honesty.** Every `TemporalGeometry` has a derivation class (original, reconstructed, community-digitized, approximate, schematic, inferred, modern reference), validity interval, accuracy and licence. Line style follows the class, so a schematic link can't look like a surveyed route.
- **Time filters shapes.** A shape shows when the date is inside its validity, or when the selected record links to it. Otherwise nothing is drawn, and the map says the data is missing.
- **Timeline row = theme, mark = kind of date.** `temporalForm` picks the mark. Vertical position never encodes importance, and no significance score exists.
- **Location is optional.** A record with no meaningful single place gives a reason instead of a marker.

## Planned (not built)

`apps/api` (FastAPI), `apps/worker`, PostgreSQL/PostGIS/pgvector, ingestion connectors, the RAG pipeline, accounts and payments. See spec sections 5, 7, 10 and 11. Those directories don't exist yet because empty scaffolding would suggest progress that hasn't happened.
