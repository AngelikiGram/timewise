import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "apps/api"))

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from timewise_api.db import Settings, engine  # noqa: E402
from timewise_api.main import app  # noqa: E402

TOKEN = "test-admin-token"
AUTH = {"Authorization": f"Bearer {TOKEN}"}
needs_db = pytest.mark.skipif(not Settings().database_url, reason="DATABASE_URL isn't set")
CLAIM = "c-sem-1"
EVENT = "semmering-1854"
NOTE = "Shows the line itself, photographed in 1886."


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", TOKEN)
    return TestClient(app)


def test_every_admin_route_refuses_without_the_key(client):
    for method, path in [("get", "/admin/records"), ("get", "/admin/claims"), ("get", "/admin/quality"), ("post", "/admin/records/1/reject"), ("post", "/admin/records/1/reopen"), ("delete", "/admin/records/1/link/x")]:
        assert getattr(client, method)(path).status_code == 401, path
        assert getattr(client, method)(path, headers={"Authorization": "Bearer wrong"}).status_code == 401, path


def test_no_configured_token_means_no_access(monkeypatch):
    monkeypatch.setenv("ADMIN_TOKEN", "")
    assert TestClient(app).get("/admin/session", headers={"Authorization": "Bearer "}).status_code == 503


def test_link_needs_a_real_reason_and_relation(client):
    r = client.post("/admin/records/1/link", headers=AUTH, json={"claim_id": CLAIM, "relation": "proves", "note": NOTE})
    assert r.status_code == 422
    r = client.post("/admin/records/1/link", headers=AUTH, json={"claim_id": CLAIM, "relation": "illustrates", "note": "short"})
    assert r.status_code == 422


@pytest.fixture
def record():
    """A fixture row, so these tests never touch imported records."""
    with engine().begin() as conn:
        rid = conn.execute(text("""
            INSERT INTO archive_records (provider, provider_record_id, title, url, preview_url, media_rights, reproduction, raw, raw_sha256, source_query)
            VALUES ('pytest', '/pytest/review', 'Fixture record', 'https://example.org/r', 'https://example.org/p.jpg', 'http://rightsstatements.org/vocab/InC/1.0/',
                    'link_and_paraphrase_only', '{}', 'x', 'pytest-review') RETURNING id""")).scalar()
    yield rid
    with engine().begin() as conn:
        conn.execute(text("DELETE FROM archive_records WHERE id = :r"), {"r": rid})


def log_actions(rid):
    with engine().connect() as conn:
        return conn.execute(text("SELECT action FROM record_review_log WHERE record_id = :r ORDER BY id"), {"r": rid}).scalars().all()


@needs_db
def test_unreviewed_record_is_not_public(client, record):
    assert all(a["id"] != record for a in client.get(f"/events/{EVENT}/archive").json())


@needs_db
def test_link_publishes_and_unlink_withdraws(client, record):
    body = {"claim_id": CLAIM, "relation": "illustrates", "note": NOTE}
    assert client.post(f"/admin/records/{record}/link", headers=AUTH, json=body).json()["workflow"] == "reviewed"
    shown = [a for a in client.get(f"/events/{EVENT}/archive").json() if a["id"] == record]
    assert shown[0]["relation"] == "illustrates" and shown[0]["note"] == NOTE
    assert shown[0]["preview_url"] is None  # in-copyright, so the image is withheld and the link stays
    assert client.delete(f"/admin/records/{record}/link/{CLAIM}", headers=AUTH).json()["workflow"] == "imported"
    assert all(a["id"] != record for a in client.get(f"/events/{EVENT}/archive").json())
    assert log_actions(record) == ["link", "unlink"]


@needs_db
def test_link_leaves_the_claims_support_unchanged(client, record):
    def support():
        with engine().connect() as conn:
            return conn.execute(text("SELECT support FROM claims WHERE id = :c"), {"c": CLAIM}).scalar()

    before = support()
    client.post(f"/admin/records/{record}/link", headers=AUTH, json={"claim_id": CLAIM, "relation": "primary_evidence", "note": NOTE})
    assert support() == before


@needs_db
def test_reject_and_reopen(client, record):
    assert client.post(f"/admin/records/{record}/reject", headers=AUTH, json={"note": "Off-topic"}).json()["workflow"] == "rejected"
    assert client.post(f"/admin/records/{record}/link", headers=AUTH, json={"claim_id": CLAIM, "relation": "context", "note": NOTE}).status_code == 409
    assert client.post(f"/admin/records/{record}/reopen", headers=AUTH).json()["workflow"] == "imported"
    assert log_actions(record) == ["reject", "reopen"]


@needs_db
def test_cannot_reject_a_linked_record_or_link_a_missing_claim(client, record):
    assert client.post(f"/admin/records/{record}/link", headers=AUTH, json={"claim_id": "invented", "relation": "context", "note": NOTE}).status_code == 404
    client.post(f"/admin/records/{record}/link", headers=AUTH, json={"claim_id": CLAIM, "relation": "context", "note": NOTE})
    assert client.post(f"/admin/records/{record}/reject", headers=AUTH, json={}).status_code == 409


@needs_db
def test_listing_and_search(client, record):
    body = client.get("/admin/records", headers=AUTH, params={"q": "pytest-review"}).json()
    assert body["total"] == 1 and body["items"][0]["id"] == record
    assert json.dumps(client.get("/admin/quality", headers=AUTH).json())
