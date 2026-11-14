"""Human review of imported records: links to claims, plus a log of every decision.

A link states how a record relates to a claim, because a photograph can illustrate an event
without proving anything about it. Linking never changes a claim's support status.
"""
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("""
    CREATE TABLE record_claim_links (
      id bigserial PRIMARY KEY,
      record_id bigint NOT NULL REFERENCES archive_records(id) ON DELETE CASCADE,
      claim_id text NOT NULL REFERENCES claims(id),
      relation text NOT NULL CHECK (relation IN ('primary_evidence','illustrates','context')),
      note text NOT NULL CHECK (length(note) >= 10),
      reviewer text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      UNIQUE (record_id, claim_id)
    );
    CREATE INDEX record_claim_links_claim_idx ON record_claim_links (claim_id);

    CREATE TABLE record_review_log (
      id bigserial PRIMARY KEY,
      record_id bigint NOT NULL REFERENCES archive_records(id) ON DELETE CASCADE,
      action text NOT NULL CHECK (action IN ('link','unlink','reject','reopen')),
      claim_id text,
      relation text,
      note text,
      reviewer text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    ALTER TABLE record_claim_links ENABLE ROW LEVEL SECURITY;
    ALTER TABLE record_review_log ENABLE ROW LEVEL SECURITY;
    """)


def downgrade() -> None:
    op.execute("DROP TABLE record_review_log, record_claim_links")
