"""Tests marked `db` run against DATABASE_URL and skip without it. They write seed data, so
point them at a development database only."""
import json
import os
import subprocess
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
API = ROOT / "apps/api"
sys.path.insert(0, str(API))

from fastapi.testclient import TestClient  # noqa: E402

from timewise_api.db import Settings, database_url, engine  # noqa: E402
from timewise_api.main import app  # noqa: E402

HAS_DB = bool(Settings().database_url)
db = pytest.mark.skipif(not HAS_DB, reason="DATABASE_URL isn't set")
collection = json.loads((ROOT / "data/curated/austria/collection.json").read_text("utf8"))
features = json.loads((ROOT / "data/curated/austria/geometries.json").read_text("utf8"))["features"]


def alembic(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, "-m", "alembic", *args], cwd=API, capture_output=True, text=True, encoding="utf8", env={**os.environ, "PYTHONPATH": str(API)})


def test_migration_compiles_offline():
    result = alembic("upgrade", "head", "--sql")
    assert result.returncode == 0, result.stderr
    assert "geometry(Geometry, 4326)" in result.stdout and "ST_IsValid(geom)" in result.stdout


def test_postgres_url_gets_a_driver(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgres://u:p@h/d")
    assert database_url().startswith("postgresql+psycopg://")


def test_missing_database_is_a_clear_503(monkeypatch):
    monkeypatch.setenv("DATABASE_URL", "postgresql://nobody@127.0.0.1:1/none?connect_timeout=1")
    engine.cache_clear()
    try:
        response = TestClient(app, raise_server_exceptions=False).get("/health")
    finally:
        engine.cache_clear()
    assert response.status_code == 503
    assert "nobody" not in response.text  # the connection string must never leak


def test_bad_bbox_is_refused_before_sql():
    assert TestClient(app).get("/geometries", params={"bbox": "1;DROP TABLE events"}).status_code == 422


@pytest.fixture(scope="module")
def client():
    assert alembic("upgrade", "head").returncode == 0
    from timewise_api.seed import seed

    seed("austria")
    seed("austria")  # re-running must not duplicate anything
    return TestClient(app)


@db
def test_every_record_is_persisted(client):
    health = client.get("/health").json()
    assert health["status"] == "ok" and health["postgis"]
    assert {e["id"] for e in client.get("/events").json()} == {e["id"] for e in collection["events"]}
    assert len(client.get("/places").json()) == len(collection["places"])
    assert {g["id"] for g in client.get("/geometries").json()} == {f["id"] for f in features}


@db
def test_event_traces_to_claims_sources_and_shapes(client):
    body = client.get("/events/brenner-1867").json()
    assert body["start"] == "1867-08-24" and body["precision"] == "day"
    assert body["claims"][0]["evidence"][0]["url"].startswith("https://")
    assert [g["id"] for g in body["geometries"]] == ["s-brenner"]
    assert body["geometries"][0]["derivation"] == "modern_reference"


@db
def test_year_precision_survives(client):
    assert client.get("/events/linz-program-1882").json()["precision"] == "year"


@db
def test_time_filter_leaves_data_gaps_empty(client):
    boundaries = lambda d: [g["id"] for g in client.get("/geometries", params={"at": d}).json() if g["derivation"] == "community_digitized"]
    assert boundaries("1850-01-01") == []
    assert boundaries("1919-06-01") == []
    assert boundaries("1914-06-28") == ["b-ah-1914"]


@db
def test_spatial_filter(client):
    ids = [g["id"] for g in client.get("/geometries", params={"bbox": "16.35,48.19,16.39,48.22"}).json()]
    assert "m-ringstrasse" in ids and "s-brenner" not in ids


def _normalise(value):
    """Order-independent form, with coordinates rounded, for comparing curated and exported data."""
    if isinstance(value, float):
        return round(value, 5)
    if isinstance(value, dict):
        return {k: _normalise(v) for k, v in value.items() if k != "_export"}
    if isinstance(value, list):
        items = [_normalise(v) for v in value]
        if items and isinstance(items[0], dict) and "id" in items[0]:
            return sorted(items, key=lambda x: x["id"])
        return items
    return value


@db
def test_export_matches_curated_data_exactly(client):
    from timewise_api.export import export_region

    data = export_region("austria")
    expected = json.loads(json.dumps(collection))
    for e in expected["events"]:
        e.setdefault("kind", "event")
    assert _normalise(data["collection"]) == _normalise(expected)
    want = [{**f, "eventIds": sorted(f["eventIds"])} for f in features]
    assert _normalise(data["geometries"]["features"]) == _normalise(want)
    curated_journeys = json.loads((ROOT / "data/curated/austria/journeys.json").read_text("utf8"))
    assert data["journeys"] == curated_journeys


@db
def test_tables_are_closed_to_the_public_api(client):
    from sqlalchemy import text

    with engine().connect() as conn:
        open_tables = conn.execute(text("""
            SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity AND c.relname <> 'spatial_ref_sys'
        """)).scalars().all()
    assert open_tables == []


@db
def test_search_and_missing_event(client):
    assert any(p["id"] == "sopron" for p in client.get("/search", params={"q": "Ödenburg"}).json()["places"])
    assert client.get("/events/invented").status_code == 404
