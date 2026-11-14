"""Creates or removes the one record the browser review test acts on, so it never touches real imports."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps/api"))

from sqlalchemy import text  # noqa: E402
from timewise_api.db import engine  # noqa: E402

with engine().begin() as conn:
    conn.execute(text("DELETE FROM archive_records WHERE provider = 'e2e'"))
    if sys.argv[1] == "create":
        conn.execute(text("""
            INSERT INTO archive_records (provider, provider_record_id, title, url, media_rights, reproduction, raw, raw_sha256, source_query)
            VALUES ('e2e', '/e2e/fixture', 'E2E fixture record', 'https://example.org/e2e', 'http://rightsstatements.org/vocab/InC/1.0/',
                    'link_and_paraphrase_only', '{}', 'x', 'e2e-fixture')"""))
