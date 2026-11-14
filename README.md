# TIMEWISE

Explore history through evidence. The product specification is [TIMEWISE_SPEC.md](TIMEWISE_SPEC.md), and current progress is in [DEVELOPMENT_STATUS.md](DEVELOPMENT_STATUS.md).

## Run it

Requires Node 24 or later. No accounts or secrets are needed in Phase 1.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:3000.

## Check it

| Command | What it does |
| --- | --- |
| `npm run typecheck` | Type-checks the web app |
| `npm test` | Unit tests: data integrity, search, shared state |
| `npm run build` | Production build, required before `test:e2e` |
| `npx playwright install chromium` | One-time browser install for `test:e2e` |
| `npm run test:e2e` | Browser tests, desktop and mobile |
| `npm run verify:sources` | Checks every citation against its live source page |

## Geographic reconstruction pipeline

Requires Python 3.12. Run these from a shell at the repo root:

```bash
python -m venv .venv
```

```bash
.venv/Scripts/python -m pip install shapely pytest
```

```bash
.venv/Scripts/python -m pytest tests/py
```

```bash
.venv/Scripts/python ingestion/geo/run.py
```

## Layout

- `ingestion/geo`: rule-based spatial extraction, geometry, validation, evaluation
- `data/generated/<region>/`: pipeline output and its review queue

- `apps/web`: Next.js site and explore workspace
- `packages/historical-schemas`: the data model and integrity checks
- `data/curated/<region>/`: reusable region packages
- `scripts/`, `tests/`: citation verification, unit and browser tests
