"""Knowledge model: sources, places, events, claims, evidence and temporal geometry.

Dates keep their precision next to them, so a year-only date's January 1st is never read as
exact. Geometry must be valid WGS84, enforced by the database rather than by convention.
"""
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None

UPGRADE = """
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE regions (
  id text PRIMARY KEY,
  label jsonb NOT NULL,
  coverage text NOT NULL CHECK (coverage IN ('curated_reviewed','source_backed','limited','insufficient')),
  coverage_note text NOT NULL,
  themes jsonb NOT NULL,
  periods jsonb NOT NULL,
  investigations jsonb NOT NULL,
  seeded_at timestamptz NOT NULL DEFAULT now(),
  seed_sha256 text NOT NULL
);

CREATE TABLE sources (
  id text PRIMARY KEY,
  region_id text NOT NULL REFERENCES regions(id),
  provider text NOT NULL,
  source_id text NOT NULL,
  url text NOT NULL,
  title text NOT NULL,
  creator text NOT NULL,
  language text NOT NULL,
  record_type text NOT NULL CHECK (record_type IN ('primary','reference_work','scholarship','institutional')),
  rights text NOT NULL,
  reproduction text NOT NULL CHECK (reproduction IN ('permitted_with_attribution','link_and_paraphrase_only')),
  attribution text NOT NULL,
  retrieved_at date NOT NULL
);

CREATE TABLE places (
  id text PRIMARY KEY,
  region_id text NOT NULL REFERENCES regions(id),
  wikidata text NOT NULL,
  label jsonb NOT NULL,
  names jsonb NOT NULL,
  modern_country char(2) NOT NULL,
  region text NOT NULL,
  geom geometry(Point, 4326) NOT NULL
);
CREATE INDEX places_geom_idx ON places USING gist (geom);

CREATE TABLE events (
  id text PRIMARY KEY,
  region_id text NOT NULL REFERENCES regions(id),
  kind text NOT NULL CHECK (kind IN ('event','process')),
  title jsonb NOT NULL,
  summary jsonb NOT NULL,
  date_start date NOT NULL,
  date_end date,
  date_precision text NOT NULL CHECK (date_precision IN ('day','month','year')),
  date_note text,
  place_id text REFERENCES places(id),
  no_place_reason text,
  place_note text,
  themes text[] NOT NULL,
  chapter_id text NOT NULL,
  people text[] NOT NULL DEFAULT '{}',
  media jsonb,
  CHECK (date_end IS NULL OR date_end >= date_start),
  CHECK (place_id IS NOT NULL OR no_place_reason IS NOT NULL)
);
CREATE INDEX events_date_idx ON events (date_start);
CREATE INDEX events_place_idx ON events (place_id);

CREATE TABLE claims (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id),
  statement jsonb NOT NULL,
  support text NOT NULL CHECK (support IN ('documented','corroborated','reference','interpretation','disputed','inferred','missing')),
  review text NOT NULL CHECK (review IN ('unreviewed','source_checked','expert_reviewed')),
  extraction text NOT NULL
);
CREATE INDEX claims_event_idx ON claims (event_id);

CREATE TABLE evidence_links (
  claim_id text NOT NULL REFERENCES claims(id) ON DELETE CASCADE,
  source_id text NOT NULL REFERENCES sources(id),
  locator text NOT NULL,
  passage text NOT NULL,
  position int NOT NULL,
  PRIMARY KEY (claim_id, source_id)
);

CREATE TABLE temporal_geometries (
  id text PRIMARY KEY,
  region_id text NOT NULL REFERENCES regions(id),
  name text NOT NULL,
  layer text NOT NULL CHECK (layer IN ('boundaries','routes','urban')),
  derivation text NOT NULL CHECK (derivation IN ('digitized_original','expert_reconstructed','community_digitized','approximate','schematic','inferred','modern_reference')),
  source_name text NOT NULL,
  source_url text,
  source_id text REFERENCES sources(id),
  locator text,
  license text NOT NULL,
  accuracy text NOT NULL,
  review text NOT NULL CHECK (review IN ('unreviewed','source_checked','expert_reviewed')),
  retrieved_at date NOT NULL,
  note text NOT NULL,
  valid_from date NOT NULL,
  valid_to date NOT NULL,
  snapshot_year int,
  endpoints text[],
  osm_id text,
  geom geometry(Geometry, 4326) NOT NULL CHECK (ST_IsValid(geom)),
  CHECK (valid_to >= valid_from)
);
CREATE INDEX temporal_geometries_geom_idx ON temporal_geometries USING gist (geom);
CREATE INDEX temporal_geometries_valid_idx ON temporal_geometries (valid_from, valid_to);

CREATE TABLE geometry_events (
  geometry_id text NOT NULL REFERENCES temporal_geometries(id) ON DELETE CASCADE,
  event_id text NOT NULL REFERENCES events(id),
  PRIMARY KEY (geometry_id, event_id)
);
"""

DOWNGRADE = """
DROP TABLE geometry_events, temporal_geometries, evidence_links, claims, events, places, sources, regions;
"""


def upgrade() -> None:
    op.execute(UPGRADE)


def downgrade() -> None:
    op.execute(DOWNGRADE)
