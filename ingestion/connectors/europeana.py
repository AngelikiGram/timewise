"""Europeana Search API. Docs: europeana.atlassian.net, "Search API Documentation".

Field names were checked against real replies on 2026-11-02. Fields are still read as optional,
because not every record has them. A record with no readable rights stays link-only.
Search results are candidates: a hit means the words matched, not that the record is relevant.
"""
from __future__ import annotations

import re
import urllib.parse

from base import Connector, MissingCredentials, Page, SourceRecord

SEARCH_URL = "https://api.europeana.eu/record/v2/search.json"
# Only these allow reuse in a commercial product. NC, ND and "in copyright" never match.
REUSABLE = re.compile(r"creativecommons\.org/(publicdomain/(zero|mark)/|licenses/by(-sa)?/)", re.I)


def first(value) -> str | None:
    if isinstance(value, list):
        return str(value[0]) if value else None
    return str(value) if value not in (None, "") else None


def lang_first(value) -> str | None:
    if isinstance(value, dict):
        for lang in ("en", "de", "def"):
            if value.get(lang):
                return first(value[lang])
    return first(value)


def classify_rights(uri: str | None) -> str:
    return "permitted_with_attribution" if uri and REUSABLE.search(uri) else "link_and_paraphrase_only"


def normalize(item: dict) -> SourceRecord | None:
    """Returns None for a record that can't be cited: one with no ID or no title."""
    record_id, title = item.get("id"), first(item.get("title"))
    if not record_id or not title:
        return None
    rights = first(item.get("rights"))
    return SourceRecord(
        provider="europeana",
        provider_record_id=record_id,
        title=title,
        creator=first(item.get("dcCreator")),
        date_text=first(item.get("year")),
        language=first(item.get("language")),
        record_type=first(item.get("type")),
        institution=lang_first(item.get("dataProvider")),
        # guid carries a tracking parameter, which doesn't belong in a citation.
        url=(first(item.get("guid")) or first(item.get("edmIsShownAt")) or "").split("?utm_")[0] or None,
        # The provider can forbid redistributing its preview image.
        preview_url=None if item.get("previewNoDistribute") else first(item.get("edmPreview")),
        media_rights=rights,
        reproduction=classify_rights(rights),
        raw=item,
    )


class EuropeanaConnector(Connector):
    provider = "europeana"

    def __init__(self, api_key: str | None, **kwargs):
        super().__init__(**kwargs)
        self.api_key = api_key

    def search(self, query: str, cursor: str | None = None, rows: int = 50) -> Page:
        if not self.api_key:
            raise MissingCredentials("EUROPEANA_API_KEY isn't set in .env.")
        params = {"wskey": self.api_key, "query": query, "rows": min(rows, 100), "cursor": cursor or "*"}
        reply = self.fetch_json(f"{SEARCH_URL}?{urllib.parse.urlencode(params)}")
        records = [r for r in map(normalize, reply.get("items", [])) if r]
        return Page(records, reply.get("totalResults"), reply.get("nextCursor"))
