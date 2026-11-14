"""Read-only API over the knowledge model. All values reach SQL as bound parameters."""
from datetime import date
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from .admin import router as admin_router
from .db import engine

app = FastAPI(title="TIMEWISE API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:3000"], allow_methods=["GET", "POST", "DELETE"], allow_headers=["Authorization", "Content-Type"])
app.include_router(admin_router)

EVENT = """
  SELECT e.id, e.kind, e.title, e.summary, e.date_start::text AS start, e.date_end::text AS "end", e.date_precision AS precision, e.date_note AS note,
         e.place_id, e.no_place_reason, e.place_note, e.themes, e.chapter_id, e.people, e.media
  FROM events e
"""
PLACE = "SELECT id, wikidata, label, names, modern_country, region, ST_Y(geom) AS lat, ST_X(geom) AS lng FROM places"
GEOMETRY = """
  SELECT g.id, g.name, g.layer, g.derivation, g.source_name, g.source_url, g.source_id, g.license, g.accuracy, g.review, g.retrieved_at::text AS retrieved_at, g.note,
         g.valid_from::text AS valid_from, g.valid_to::text AS valid_to, g.snapshot_year, ST_AsGeoJSON(g.geom)::jsonb AS geometry,
         COALESCE((SELECT array_agg(ge.event_id ORDER BY ge.event_id) FROM geometry_events ge WHERE ge.geometry_id = g.id), '{}') AS event_ids
  FROM temporal_geometries g
"""


def rows(sql: str, **params) -> list[dict]:
    with engine().connect() as conn:
        return [dict(r._mapping) for r in conn.execute(text(sql), params)]


# The database being down is an expected state, and it should read as one.
@app.exception_handler(SQLAlchemyError)
async def database_unavailable(_, exc: SQLAlchemyError) -> JSONResponse:
    return JSONResponse({"detail": "The database is unavailable."}, status_code=503)


@app.exception_handler(RuntimeError)
async def not_configured(_, exc: RuntimeError) -> JSONResponse:
    return JSONResponse({"detail": str(exc)}, status_code=503)


@app.get("/health")
def health() -> dict:
    row = rows("SELECT PostGIS_Version() AS postgis, (SELECT count(*) FROM events) AS events")[0]
    return {"status": "ok", **row}


@app.get("/events")
def events(
    theme: str | None = None,
    start: date | None = None,
    end: date | None = None,
) -> list[dict]:
    return rows(
        EVENT + """ WHERE (CAST(:theme AS text) IS NULL OR :theme = ANY(e.themes))
                    AND (CAST(:start AS date) IS NULL OR COALESCE(e.date_end, e.date_start) >= :start)
                    AND (CAST(:end AS date) IS NULL OR e.date_start <= :end)
                    ORDER BY e.date_start, e.id""",
        theme=theme, start=start, end=end,
    )


@app.get("/events/{event_id}")
def event(event_id: str) -> dict:
    found = rows(EVENT + " WHERE e.id = :id", id=event_id)
    if not found:
        raise HTTPException(404, "No such event.")
    claims = rows("SELECT id, statement, support, review, extraction FROM claims WHERE event_id = :id ORDER BY id", id=event_id)
    for c in claims:
        c["evidence"] = rows(
            """SELECT l.locator, l.passage, s.id AS source_id, s.title, s.provider, s.url, s.language, s.record_type, s.rights, s.retrieved_at::text AS retrieved_at
               FROM evidence_links l JOIN sources s ON s.id = l.source_id WHERE l.claim_id = :id ORDER BY l.position""",
            id=c["id"],
        )
    geometries = rows(GEOMETRY + " WHERE EXISTS (SELECT 1 FROM geometry_events x WHERE x.geometry_id = g.id AND x.event_id = :id) ORDER BY g.id", id=event_id)
    return {**found[0], "claims": claims, "geometries": geometries}


@app.get("/places")
def places() -> list[dict]:
    return rows(PLACE + " ORDER BY id")


@app.get("/geometries")
def geometries(
    at: Annotated[date | None, Query(description="Only shapes valid on this date")] = None,
    bbox: Annotated[str | None, Query(description="west,south,east,north", pattern=r"^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$")] = None,
) -> list[dict]:
    w, s, e, n = map(float, bbox.split(",")) if bbox else (None, None, None, None)
    return rows(
        GEOMETRY + """ WHERE (CAST(:at AS date) IS NULL OR :at BETWEEN g.valid_from AND g.valid_to)
                       AND (CAST(:w AS float8) IS NULL OR ST_Intersects(g.geom, ST_MakeEnvelope(:w, :s, :e, :n, 4326)))
                       ORDER BY g.id""",
        at=at, w=w, s=s, e=e, n=n,
    )


@app.get("/events/{event_id}/archive")
def event_archive(event_id: str) -> list[dict]:
    """Records a person has linked to this event's claims. Unreviewed imports are never public.
    The preview is withheld unless the provider's rights allow reuse."""
    return rows(
        """SELECT r.id, r.title, r.creator, r.date_text, r.institution, r.url, r.media_rights, r.reproduction, r.record_type,
                  CASE WHEN r.reproduction = 'permitted_with_attribution' THEN r.preview_url END AS preview_url,
                  l.claim_id, l.relation, l.note
           FROM record_claim_links l
           JOIN archive_records r ON r.id = l.record_id
           JOIN claims c ON c.id = l.claim_id
           WHERE c.event_id = :id AND r.workflow = 'reviewed'
           ORDER BY l.relation, r.id""",
        id=event_id,
    )


@app.get("/ingestion-runs")
def ingestion_runs(limit: Annotated[int, Query(ge=1, le=100)] = 20) -> list[dict]:
    return rows("SELECT id, provider, query, status, error, inserted, updated, started_at::text AS started_at, finished_at::text AS finished_at FROM ingestion_runs ORDER BY id DESC LIMIT :limit", limit=limit)


@app.get("/search")
def search(q: Annotated[str, Query(min_length=2, max_length=100)]) -> dict:
    # unaccent isn't assumed to be installed, so accent-insensitive search stays in the web app for now.
    like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
    return {
        "events": rows(EVENT + " WHERE e.title::text ILIKE :q OR e.summary::text ILIKE :q ORDER BY e.date_start LIMIT 20", q=like),
        "places": rows(PLACE + " WHERE label::text ILIKE :q OR names::text ILIKE :q ORDER BY id LIMIT 20", q=like),
    }
