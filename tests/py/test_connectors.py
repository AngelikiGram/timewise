"""Connector behaviour against scripted replies. These don't prove the live API matches: the
item fixture follows the documented field names, plus assumed ones noted in europeana.py."""
import json
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT / "ingestion/connectors"), str(ROOT / "apps/api")]

from base import MissingCredentials, ProviderError, RateLimiter  # noqa: E402
from europeana import EuropeanaConnector, classify_rights, normalize  # noqa: E402

ITEM = {"id": "/1/abc", "title": ["A title"], "dcCreator": ["Someone"], "year": ["1854"], "language": ["de"], "type": "IMAGE",
        "dataProvider": {"def": ["An archive"]}, "guid": "https://example.org/1", "edmPreview": ["https://example.org/p.jpg"],
        "rights": ["http://creativecommons.org/publicdomain/mark/1.0/"]}


def connector(replies, key="k"):
    calls = []

    def transport(url, headers):
        calls.append(url)
        status, body = replies.pop(0)
        return status, {}, json.dumps(body).encode()

    c = EuropeanaConnector(key, transport=transport, limiter=RateLimiter(0, sleep=lambda s: None), sleep=lambda s: None)
    return c, calls


@pytest.mark.parametrize("uri,expected", [
    ("http://creativecommons.org/publicdomain/mark/1.0/", "permitted_with_attribution"),
    ("http://creativecommons.org/publicdomain/zero/1.0/", "permitted_with_attribution"),
    ("http://creativecommons.org/licenses/by-sa/4.0/", "permitted_with_attribution"),
    ("http://creativecommons.org/licenses/by-nc/4.0/", "link_and_paraphrase_only"),
    ("http://creativecommons.org/licenses/by-nd/4.0/", "link_and_paraphrase_only"),
    ("http://rightsstatements.org/vocab/InC/1.0/", "link_and_paraphrase_only"),
    (None, "link_and_paraphrase_only"),
])
def test_rights_default_to_not_reusable(uri, expected):
    assert classify_rights(uri) == expected


def test_normalize_keeps_provenance_and_raw():
    r = normalize(ITEM)
    assert (r.provider_record_id, r.title, r.institution, r.date_text) == ("/1/abc", "A title", "An archive", "1854")
    assert r.raw == ITEM and len(r.raw_sha256) == 64


def test_record_without_title_or_rights_is_handled():
    assert normalize({"id": "/1/x"}) is None
    assert normalize({"id": "/1/x", "title": ["t"]}).reproduction == "link_and_paraphrase_only"


def test_preview_is_dropped_when_the_provider_forbids_it():
    assert normalize({**ITEM, "previewNoDistribute": True}).preview_url is None
    assert normalize({**ITEM, "previewNoDistribute": False}).preview_url == "https://example.org/p.jpg"


def test_citation_link_has_no_tracking_parameter():
    assert normalize({**ITEM, "guid": "https://www.europeana.eu/item/1/a?utm_source=api&x=1"}).url == "https://www.europeana.eu/item/1/a"


def test_missing_key_never_calls_the_provider():
    c, calls = connector([], key="")
    with pytest.raises(MissingCredentials):
        c.search("x")
    assert calls == []


def test_pagination_follows_cursor_and_stops():
    c, calls = connector([(200, {"items": [ITEM], "totalResults": 2, "nextCursor": "NEXT"}), (200, {"items": [{**ITEM, "id": "/1/b"}], "totalResults": 2})])
    assert [r.provider_record_id for r in c.search_all("x", 10)] == ["/1/abc", "/1/b"]
    assert "cursor=%2A" in calls[0] and "cursor=NEXT" in calls[1]


def test_limit_is_respected():
    c, calls = connector([(200, {"items": [ITEM, ITEM, ITEM], "nextCursor": "N"})])
    assert len(list(c.search_all("x", 2))) == 2 and "rows=2" in calls[0]


def test_retries_throttling_then_succeeds():
    c, calls = connector([(429, {}), (500, {}), (200, {"items": [ITEM]})])
    assert len(c.search("x").records) == 1 and len(calls) == 3


def test_gives_up_without_leaking_the_key():
    c, _ = connector([(500, {})] * 4, key="SECRETKEY")
    with pytest.raises(ProviderError) as e:
        c.search("x")
    assert "SECRETKEY" not in str(e.value)


def test_bad_key_is_not_retried():
    c, calls = connector([(401, {})])
    with pytest.raises(MissingCredentials):
        c.search("x")
    assert len(calls) == 1


def test_rate_limiter_spaces_calls():
    waits, now = [], [0.0]
    limiter = RateLimiter(1.0, sleep=waits.append, clock=lambda: now[0])
    limiter.wait()
    limiter.wait()
    assert waits == [1.0]


def test_import_stores_once_and_records_the_run():
    from sqlalchemy import text
    from timewise_api.db import Settings, engine

    if not Settings().database_url:
        pytest.skip("DATABASE_URL isn't set")
    import run_import

    query = "pytest-fixture-query"
    item = {**ITEM, "id": "/pytest/fixture-record"}
    try:
        for _ in range(2):
            c, _calls = connector([(200, {"items": [item]})])
            c.provider = "pytest"
            result = run_import.import_query(c, query, 5)
            assert result["status"] == "completed"
        with engine().connect() as conn:
            count, workflow = conn.execute(text("SELECT count(*), max(workflow) FROM archive_records WHERE source_query = :q"), {"q": query}).one()
        assert count == 1 and workflow == "imported" and result["updated"] == 1
    finally:
        with engine().begin() as conn:  # removes only this test's own rows
            conn.execute(text("DELETE FROM archive_records WHERE source_query = :q"), {"q": query})
            conn.execute(text("DELETE FROM ingestion_runs WHERE query = :q"), {"q": query})


def test_missing_key_is_logged_not_faked():
    from sqlalchemy import text
    from timewise_api.db import Settings, engine

    if not Settings().database_url:
        pytest.skip("DATABASE_URL isn't set")
    import run_import

    query = "pytest-no-key-query"
    c, _ = connector([], key="")
    try:
        result = run_import.import_query(c, query, 5)
        assert result["status"] == "awaiting_credentials" and result["inserted"] == 0
    finally:
        with engine().begin() as conn:
            conn.execute(text("DELETE FROM ingestion_runs WHERE query = :q"), {"q": query})
