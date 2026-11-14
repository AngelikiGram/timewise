"""Review of imported records. Every route needs the admin token, and every change is logged.

The single shared token suits an API on the developer's own machine. Replace it with real
accounts (Supabase Auth) before this API is hosted anywhere public.
"""
import hmac
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.engine import Connection

from .db import Settings, engine

REVIEWER = "admin"


def require_admin(authorization: Annotated[str | None, Header()] = None) -> None:
    token = Settings().admin_token
    if not token:  # fail closed: no configured token means no access at all
        raise HTTPException(503, "ADMIN_TOKEN isn't set on the server.")
    supplied = (authorization or "").removeprefix("Bearer ").encode()
    if not hmac.compare_digest(supplied, token.encode()):
        raise HTTPException(401, "Invalid admin key.")


router = APIRouter(prefix="/admin", dependencies=[Depends(require_admin)])


class LinkBody(BaseModel):
    claim_id: str
    relation: Literal["primary_evidence", "illustrates", "context"]
    note: str = Field(min_length=10, max_length=1000, description="Why this record relates to this claim")


class NoteBody(BaseModel):
    note: str = Field(default="", max_length=1000)


def _rows(conn: Connection, sql: str, **params) -> list[dict]:
    return [dict(r._mapping) for r in conn.execute(text(sql), params)]


def _log(conn: Connection, record_id: int, action: str, claim_id=None, relation=None, note=None) -> None:
    conn.execute(
        text("INSERT INTO record_review_log (record_id, action, claim_id, relation, note, reviewer) VALUES (:r, :a, :c, :rel, :n, :u)"),
        {"r": record_id, "a": action, "c": claim_id, "rel": relation, "n": note, "u": REVIEWER},
    )


def _workflow(conn: Connection, record_id: int) -> str:
    """Locks the record, so two simultaneous decisions can't overwrite each other."""
    row = conn.execute(text("SELECT workflow FROM archive_records WHERE id = :r FOR UPDATE"), {"r": record_id}).first()
    if not row:
        raise HTTPException(404, "No such record.")
    return row[0]


@router.get("/session")
def session() -> dict:
    return {"ok": True}


@router.get("/quality")
def quality() -> dict:
    with engine().connect() as conn:
        return {
            "by_workflow": {r["workflow"]: r["n"] for r in _rows(conn, "SELECT workflow, count(*) AS n FROM archive_records GROUP BY 1")},
            "by_reproduction": {r["reproduction"]: r["n"] for r in _rows(conn, "SELECT reproduction, count(*) AS n FROM archive_records GROUP BY 1")},
            "links_by_relation": {r["relation"]: r["n"] for r in _rows(conn, "SELECT relation, count(*) AS n FROM record_claim_links GROUP BY 1")},
            "claims_total": conn.execute(text("SELECT count(*) FROM claims")).scalar(),
            "claims_with_archival_link": conn.execute(text("SELECT count(DISTINCT claim_id) FROM record_claim_links")).scalar(),
        }


@router.get("/claims")
def claims() -> list[dict]:
    with engine().connect() as conn:
        return _rows(conn, """
            SELECT c.id, c.statement->>'en' AS statement, c.support, e.id AS event_id, e.title->>'en' AS event_title, e.date_start::text AS event_date
            FROM claims c JOIN events e ON e.id = c.event_id ORDER BY e.date_start, c.id""")


@router.get("/records")
def records(
    workflow: Literal["imported", "reviewed", "rejected"] = "imported",
    q: Annotated[str | None, Query(max_length=100)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 30,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> dict:
    like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%" if q else None
    where = "workflow = :w AND (CAST(:q AS text) IS NULL OR title ILIKE :q OR source_query ILIKE :q OR institution ILIKE :q)"
    with engine().connect() as conn:
        total = conn.execute(text(f"SELECT count(*) FROM archive_records WHERE {where}"), {"w": workflow, "q": like}).scalar()
        items = _rows(conn, f"""
            SELECT id, provider, provider_record_id, title, creator, date_text, language, record_type, institution, url, preview_url, media_rights, reproduction,
                   workflow, source_query, raw->'dcDescription'->>0 AS description
            FROM archive_records WHERE {where} ORDER BY id LIMIT :limit OFFSET :offset""", w=workflow, q=like, limit=limit, offset=offset)
        for item in items:
            item["links"] = _rows(conn, """
                SELECT l.claim_id, l.relation, l.note, c.statement->>'en' AS statement FROM record_claim_links l
                JOIN claims c ON c.id = l.claim_id WHERE l.record_id = :r ORDER BY l.id""", r=item["id"])
    return {"total": total, "items": items}


@router.post("/records/{record_id}/link")
def link(record_id: int, body: LinkBody) -> dict:
    with engine().begin() as conn:
        if _workflow(conn, record_id) == "rejected":
            raise HTTPException(409, "Reopen this record before linking it.")
        if not conn.execute(text("SELECT 1 FROM claims WHERE id = :c"), {"c": body.claim_id}).first():
            raise HTTPException(404, "No such claim.")
        conn.execute(text("""
            INSERT INTO record_claim_links (record_id, claim_id, relation, note, reviewer) VALUES (:r, :c, :rel, :n, :u)
            ON CONFLICT (record_id, claim_id) DO UPDATE SET relation = EXCLUDED.relation, note = EXCLUDED.note, reviewer = EXCLUDED.reviewer"""),
            {"r": record_id, "c": body.claim_id, "rel": body.relation, "n": body.note, "u": REVIEWER})
        conn.execute(text("UPDATE archive_records SET workflow = 'reviewed' WHERE id = :r"), {"r": record_id})
        _log(conn, record_id, "link", body.claim_id, body.relation, body.note)
    return {"workflow": "reviewed"}


@router.delete("/records/{record_id}/link/{claim_id}")
def unlink(record_id: int, claim_id: str) -> dict:
    with engine().begin() as conn:
        _workflow(conn, record_id)
        removed = conn.execute(text("DELETE FROM record_claim_links WHERE record_id = :r AND claim_id = :c"), {"r": record_id, "c": claim_id}).rowcount
        if not removed:
            raise HTTPException(404, "No such link.")
        left = conn.execute(text("SELECT count(*) FROM record_claim_links WHERE record_id = :r"), {"r": record_id}).scalar()
        workflow = "reviewed" if left else "imported"
        conn.execute(text("UPDATE archive_records SET workflow = :w WHERE id = :r"), {"w": workflow, "r": record_id})
        _log(conn, record_id, "unlink", claim_id)
    return {"workflow": workflow}


@router.post("/records/{record_id}/reject")
def reject(record_id: int, body: NoteBody) -> dict:
    with engine().begin() as conn:
        _workflow(conn, record_id)
        if conn.execute(text("SELECT 1 FROM record_claim_links WHERE record_id = :r LIMIT 1"), {"r": record_id}).first():
            raise HTTPException(409, "Remove this record's links before rejecting it.")
        conn.execute(text("UPDATE archive_records SET workflow = 'rejected' WHERE id = :r"), {"r": record_id})
        _log(conn, record_id, "reject", note=body.note or None)
    return {"workflow": "rejected"}


@router.post("/records/{record_id}/reopen")
def reopen(record_id: int) -> dict:
    with engine().begin() as conn:
        if _workflow(conn, record_id) != "rejected":
            raise HTTPException(409, "Only a rejected record can be reopened.")
        conn.execute(text("UPDATE archive_records SET workflow = 'imported' WHERE id = :r"), {"r": record_id})
        _log(conn, record_id, "reopen")
    return {"workflow": "imported"}
