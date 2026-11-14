"""Imports records for the queries in data/source-configs/<provider>.json.

    python ingestion/connectors/run_import.py [limit per query]

Records enter as 'imported' only. Nothing here publishes anything or makes a historical claim.
"""
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(Path(__file__).parent), str(ROOT / "apps/api")]

from base import MissingCredentials, ProviderError  # noqa: E402
from europeana import EuropeanaConnector  # noqa: E402
from pydantic_settings import BaseSettings, SettingsConfigDict  # noqa: E402
from sqlalchemy import text  # noqa: E402
from timewise_api.db import engine  # noqa: E402


class Keys(BaseSettings):
    model_config = SettingsConfigDict(env_file=ROOT / ".env", extra="ignore")
    europeana_api_key: str = ""


UPSERT = text("""
  INSERT INTO archive_records (provider, provider_record_id, title, creator, date_text, language, record_type, institution, url, preview_url,
                               media_rights, reproduction, raw, raw_sha256, source_query)
  VALUES (:provider, :provider_record_id, :title, :creator, :date_text, :language, :record_type, :institution, :url, :preview_url,
          :media_rights, :reproduction, CAST(:raw AS jsonb), :raw_sha256, :source_query)
  ON CONFLICT (provider, provider_record_id) DO UPDATE SET
    title = EXCLUDED.title, creator = EXCLUDED.creator, date_text = EXCLUDED.date_text, language = EXCLUDED.language, record_type = EXCLUDED.record_type,
    institution = EXCLUDED.institution, url = EXCLUDED.url, preview_url = EXCLUDED.preview_url, media_rights = EXCLUDED.media_rights,
    reproduction = EXCLUDED.reproduction, raw = EXCLUDED.raw, raw_sha256 = EXCLUDED.raw_sha256, last_seen = now()
  RETURNING (xmax = 0) AS inserted
""")


def store(conn, record, query: str) -> bool:
    """Returns True for a new record. Re-importing updates in place, so there are no duplicates."""
    row = {k: getattr(record, k) for k in ("provider", "provider_record_id", "title", "creator", "date_text", "language", "record_type", "institution", "url", "preview_url", "media_rights", "reproduction", "raw_sha256")}
    return conn.execute(UPSERT, {**row, "raw": json.dumps(record.raw, ensure_ascii=False), "source_query": query}).scalar()


def import_query(connector, query: str, limit: int) -> dict:
    with engine().begin() as conn:
        run_id = conn.execute(text("INSERT INTO ingestion_runs (provider, query) VALUES (:p, :q) RETURNING id"), {"p": connector.provider, "q": query}).scalar()
    counts = {"inserted": 0, "updated": 0}
    status, error = "completed", None
    try:
        with engine().begin() as conn:
            for record in connector.search_all(query, limit):
                counts["inserted" if store(conn, record, query) else "updated"] += 1
    except MissingCredentials as e:
        status, error = "awaiting_credentials", str(e)
    except ProviderError as e:
        status, error = "failed", str(e)
    with engine().begin() as conn:
        conn.execute(text("UPDATE ingestion_runs SET finished_at = now(), status = :s, error = :e, inserted = :i, updated = :u WHERE id = :id"),
                     {"s": status, "e": error, "i": counts["inserted"], "u": counts["updated"], "id": run_id})
    return {"query": query, "status": status, "error": error, **counts}


def main() -> int:
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else 25
    config = json.loads((ROOT / "data/source-configs/europeana.json").read_text("utf8"))
    connector = EuropeanaConnector(Keys().europeana_api_key or os.environ.get("EUROPEANA_API_KEY"))
    results = [import_query(connector, q, limit) for q in config["queries"]]
    for r in results:
        print(r)
    return 0 if all(r["status"] == "completed" for r in results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
