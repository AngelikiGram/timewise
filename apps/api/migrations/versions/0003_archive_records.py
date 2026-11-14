"""Imported archive records and a log of every import run.

Kept apart from events and claims: an imported record is a candidate, not historical knowledge,
until a person links it. The workflow column follows spec section 13.
"""
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE archive_records (
      id bigserial PRIMARY KEY,
      provider text NOT NULL,
      provider_record_id text NOT NULL,
      title text NOT NULL,
      creator text,
      date_text text,
      language text,
      record_type text,
      institution text,
      url text,
      preview_url text,
      media_rights text,
      reproduction text NOT NULL CHECK (reproduction IN ('permitted_with_attribution','link_and_paraphrase_only')),
      workflow text NOT NULL DEFAULT 'imported' CHECK (workflow IN ('imported','processed','extracted','validated','reviewed','published','rejected')),
      raw jsonb NOT NULL,
      raw_sha256 text NOT NULL,
      source_query text NOT NULL,
      first_seen timestamptz NOT NULL DEFAULT now(),
      last_seen timestamptz NOT NULL DEFAULT now(),
      UNIQUE (provider, provider_record_id)
    );
    CREATE INDEX archive_records_workflow_idx ON archive_records (workflow);

    CREATE TABLE ingestion_runs (
      id bigserial PRIMARY KEY,
      provider text NOT NULL,
      query text NOT NULL,
      started_at timestamptz NOT NULL DEFAULT now(),
      finished_at timestamptz,
      status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','completed','failed','awaiting_credentials')),
      error text,
      inserted int NOT NULL DEFAULT 0,
      updated int NOT NULL DEFAULT 0
    );

    ALTER TABLE archive_records ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ingestion_runs ENABLE ROW LEVEL SECURITY;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE ingestion_runs, archive_records")
