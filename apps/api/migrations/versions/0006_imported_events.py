"""Events imported by machine, kept apart from the hand-checked `events` table.

Removing a bad import can never touch checked content. Dates stay text-free of invention:
`date_precision` records what the source gave, and `date_start` beyond it is a placeholder.
"""
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE imported_events (
      id text PRIMARY KEY,
      region_id text NOT NULL,
      provider text NOT NULL,
      title jsonb NOT NULL,
      description text,
      category text NOT NULL,
      date_start date NOT NULL,
      date_end date,
      date_precision text NOT NULL CHECK (date_precision IN ('day','month','year','decade','century')),
      dates_conflict boolean NOT NULL DEFAULT false,
      geom geometry(Point, 4326),
      location_source text CHECK (location_source IN ('event','place')),
      sitelinks int NOT NULL DEFAULT 0,
      url text NOT NULL,
      workflow text NOT NULL DEFAULT 'imported' CHECK (workflow IN ('imported','reviewed','rejected')),
      retrieved_at date NOT NULL DEFAULT current_date
    );
    CREATE INDEX imported_events_region_date_idx ON imported_events (region_id, date_start);
    CREATE INDEX imported_events_geom_idx ON imported_events USING gist (geom);
    ALTER TABLE imported_events ENABLE ROW LEVEL SECURITY;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE imported_events")
