"""One imported event can belong to several regions.

A war fought by several states, or an event in a region claimed by more than one country, was
stored once under whichever region imported it first. Keying by (region_id, id) gives each region
its own row, so each can be reviewed or hidden on its own.
"""
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    ALTER TABLE imported_events DROP CONSTRAINT imported_events_pkey;
    ALTER TABLE imported_events ADD PRIMARY KEY (region_id, id);
    CREATE INDEX imported_events_id_idx ON imported_events (id);
    """)


def downgrade() -> None:
    op.execute("""
    DROP INDEX imported_events_id_idx;
    ALTER TABLE imported_events DROP CONSTRAINT imported_events_pkey;
    ALTER TABLE imported_events ADD PRIMARY KEY (id);
    """)
