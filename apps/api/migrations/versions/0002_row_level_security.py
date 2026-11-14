"""Closes these tables to Supabase's public API.

With row-level security on and no policies, the API's anon and authenticated roles get
nothing. The owner role that this service connects with still has full access.
"""
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None

TABLES = ["regions", "sources", "places", "events", "claims", "evidence_links", "temporal_geometries", "geometry_events", "alembic_version"]


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
