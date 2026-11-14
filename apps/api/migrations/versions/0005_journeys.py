"""Historical Journeys. Stored as one document each: chapters are read and edited as a whole,
and their references to claims and events are validated where the journey is loaded."""
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE journeys (
      id text PRIMARY KEY,
      region_id text NOT NULL REFERENCES regions(id),
      content jsonb NOT NULL,
      seeded_at timestamptz NOT NULL DEFAULT now()
    );
    ALTER TABLE journeys ENABLE ROW LEVEL SECURITY;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE journeys")
