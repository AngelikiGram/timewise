"""An imported event may be placed at the administrative area it is in.

Wikidata often gives no point for an event or its venue, but does name the district or town it is in
(P131). That point is approximate, so it gets its own location_source and the site says so.
"""
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE imported_events DROP CONSTRAINT IF EXISTS imported_events_location_source_check;
    ALTER TABLE imported_events ADD CONSTRAINT imported_events_location_source_check CHECK (location_source IN ('event','place','area'));
    """)


def downgrade() -> None:
    op.execute("""
    UPDATE imported_events SET geom = NULL, location_source = NULL WHERE location_source = 'area';
    ALTER TABLE imported_events DROP CONSTRAINT IF EXISTS imported_events_location_source_check;
    ALTER TABLE imported_events ADD CONSTRAINT imported_events_location_source_check CHECK (location_source IN ('event','place'));
    """)
