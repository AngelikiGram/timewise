"""The interface every archive connector implements, plus shared retry and rate limiting."""
from __future__ import annotations

import abc
import hashlib
import json
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from typing import Callable, Iterator


class MissingCredentials(Exception):
    """The provider needs a key that isn't configured. Expected, and never a reason to fake data."""


class ProviderError(Exception):
    pass


@dataclass
class SourceRecord:
    """Normalized metadata. `raw` keeps the provider's reply so normalization can be re-run."""
    provider: str
    provider_record_id: str
    title: str
    creator: str | None
    date_text: str | None
    language: str | None
    record_type: str | None
    institution: str | None
    url: str | None
    preview_url: str | None
    media_rights: str | None
    reproduction: str
    raw: dict = field(repr=False, default_factory=dict)

    @property
    def raw_sha256(self) -> str:
        return hashlib.sha256(json.dumps(self.raw, sort_keys=True, ensure_ascii=False).encode()).hexdigest()


@dataclass
class Page:
    records: list[SourceRecord]
    total: int | None
    next_cursor: str | None


class RateLimiter:
    def __init__(self, min_interval_s: float, sleep: Callable[[float], None] = time.sleep, clock: Callable[[], float] = time.monotonic):
        self.min_interval_s, self.sleep, self.clock = min_interval_s, sleep, clock
        self._last = None

    def wait(self) -> None:
        if self._last is not None:
            remaining = self.min_interval_s - (self.clock() - self._last)
            if remaining > 0:
                self.sleep(remaining)
        self._last = self.clock()


def default_transport(url: str, headers: dict) -> tuple[int, dict, bytes]:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=30) as r:
            return r.status, dict(r.headers), r.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers or {}), e.read()


class Connector(abc.ABC):
    provider: str

    def __init__(self, transport=default_transport, limiter: RateLimiter | None = None, sleep=time.sleep, max_attempts: int = 4):
        self.transport, self.sleep, self.max_attempts = transport, sleep, max_attempts
        self.limiter = limiter or RateLimiter(1.0, sleep=sleep)

    def fetch_json(self, url: str, secret: str | None = None) -> dict:
        """Retries throttling and server errors. Error text never includes the URL, which can hold a key."""
        last = None
        for attempt in range(self.max_attempts):
            self.limiter.wait()
            status, headers, body = self.transport(url, {"User-Agent": "TimewiseDev/0.1 (archive ingestion)"})
            if status == 200:
                return json.loads(body)
            if status in (401, 403):
                raise MissingCredentials(f"{self.provider} rejected the API key (HTTP {status}).")
            if status != 429 and status < 500:
                raise ProviderError(f"{self.provider} refused the request (HTTP {status}).")
            last = status
            retry_after = next((v for k, v in headers.items() if k.lower() == "retry-after"), None)
            # Parse Retry-After: can be seconds (int) or HTTP-date
            wait_s = 60.0
            if retry_after:
                try:
                    wait_s = float(retry_after)
                except ValueError:
                    # Could be HTTP-date, fallback to exponential backoff
                    wait_s = 2 ** (attempt + 1)
            else:
                wait_s = 2 ** (attempt + 1)
            # Cap at 5 minutes, but allow longer if server explicitly asks
            wait_s = min(wait_s, 300.0) if retry_after is None else wait_s
            self.sleep(wait_s)
        raise ProviderError(f"{self.provider} kept failing (last HTTP {last}).")

    @abc.abstractmethod
    def search(self, query: str, cursor: str | None = None, rows: int = 50) -> Page:
        ...

    def search_all(self, query: str, limit: int) -> Iterator[SourceRecord]:
        cursor, seen = None, 0
        while seen < limit:
            page = self.search(query, cursor, rows=min(100, limit - seen))
            for record in page.records[: limit - seen]:
                seen += 1
                yield record
            if not page.next_cursor or not page.records:
                return
            cursor = page.next_cursor
