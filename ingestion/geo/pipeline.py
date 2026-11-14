"""Text -> spatial relations -> places -> constraints -> geometry -> validation -> routing.

Each stage is a plain function so it can be tested alone. Rule-based on purpose: it runs
without paid services, and every output can be traced to the pattern that produced it.

Classification:
  observed      coordinates stated in the source
  reconstructed computed from a stated distance and direction
  inferred      shape assumed by us, such as a straight link between two named ends
"""
from __future__ import annotations

import hashlib
import math
import re
from dataclasses import dataclass, field

from shapely.geometry import LineString, Point, mapping, shape
from shapely.geometry.base import BaseGeometry

EXTRACTOR_VERSION = "rules-v1"
NAME = r"[A-ZÄÖÜŠŽČ][\w'’-]*(?:[ -][A-ZÄÖÜŠŽČ][\w'’-]*)?"
ROUTE_WORDS = re.compile(r"railway|railroad|\bline\b|\bsection\b|\broad\b|canal|bahn|strecke|straße|abschnitt|kanal", re.I)
OPENING_WORDS = re.compile(r"\bopened\b|\bopening\b|completed|inaugurated|eröffnet|eröffnung|inbetriebnahme|fertiggestellt", re.I)
# Words a capitalised-name pattern would otherwise take for a place.
NOT_PLACES = {"The", "Der", "Die", "Das", "This", "It", "Es", "Sie", "North", "South", "East", "West", "January", "July"}

BEARINGS = {
    "north": 0, "northeast": 45, "north-east": 45, "east": 90, "southeast": 135, "south-east": 135,
    "south": 180, "southwest": 225, "south-west": 225, "west": 270, "northwest": 315, "north-west": 315,
    "nördlich": 0, "nordöstlich": 45, "östlich": 90, "südöstlich": 135,
    "südlich": 180, "südwestlich": 225, "westlich": 270, "nordwestlich": 315,
}
_bearing = "|".join(sorted(map(re.escape, BEARINGS), key=len, reverse=True))

CONNECT = [
    re.compile(rf"\b(?:between|zwischen)\s+({NAME})\s+(?:and|und)\s+({NAME})"),
    re.compile(rf"\bfrom\s+({NAME})\s+to\s+({NAME})"),
    re.compile(rf"\bvon\s+({NAME})\s+nach\s+({NAME})"),
]
OFFSET = re.compile(rf"\b({NAME})\s+(?:is|lies|liegt|lay|lag|was)\b[^.]*?(\d+(?:[.,]\d+)?)\s*(km|kilomet\w+|miles?)\s+(?:to the\s+)?({_bearing})\s*(?:of|von)?\s+({NAME})")
COORD = re.compile(rf"\b({NAME})\s+(?:is|lies|liegt|lay|lag|was)\b[^.]*?(\d{{1,2}}(?:\.\d+)?)°\s*([NS])[,\s]+(\d{{1,3}}(?:\.\d+)?)°\s*([EW])")
LENGTH = re.compile(r"(\d+(?:[.,]\d+)?)\s*(km|kilomet\w+|miles?)\b")
YEAR = re.compile(r"\b(1[0-9]{3})\b")


@dataclass
class Relation:
    kind: str  # connects | offset | coordinates
    subject: str
    obj: str | None = None
    distance_km: float | None = None
    bearing: float | None = None
    lat: float | None = None
    lng: float | None = None
    year: int | None = None
    year_is_opening: bool = False
    stated_length_km: float | None = None
    is_route_text: bool = False
    source_id: str = ""
    sentence_sha256: str = ""
    locator: str = ""


@dataclass
class Candidate:
    qid: str
    label: str
    description: str
    lat: float
    lng: float


@dataclass
class Feature:
    id: str
    classification: str
    geometry: BaseGeometry
    uncertainty_km: float | None
    uncertainty: str
    relation_kinds: list[str]
    places: list[str]
    valid_from: str | None
    sources: list[dict] = field(default_factory=list)
    alternatives: list[dict] = field(default_factory=list)
    checks: dict[str, str] = field(default_factory=dict)
    status: str = "pending"
    reasons: list[str] = field(default_factory=list)


def to_km(value: str, unit: str) -> float:
    n = float(value.replace(",", "."))
    return n * 1.60934 if unit.lower().startswith("mile") else n


def split_sentences(text: str) -> list[str]:
    # Don't split after a day number ("24. Oktober") or a single initial.
    return [s.strip() for s in re.split(r"(?<=[a-zäöüß)\]]{2}[.!?])\s+(?=[A-ZÄÖÜ])", text) if s.strip()]


def extract_relations(text: str, source_id: str = "") -> list[Relation]:
    out: list[Relation] = []
    for sentence in split_sentences(text):
        if len(sentence) > 500:
            continue
        common = {
            "source_id": source_id,
            "sentence_sha256": hashlib.sha256(sentence.encode()).hexdigest(),
            "year": next((int(y) for y in YEAR.findall(sentence)), None),
            "year_is_opening": bool(OPENING_WORDS.search(sentence)),
        }
        for m in COORD.finditer(sentence):
            lat = float(m[2]) * (1 if m[3] == "N" else -1)
            lng = float(m[4]) * (1 if m[5] == "E" else -1)
            out.append(Relation("coordinates", m[1], lat=lat, lng=lng, locator=m[0][:60], **common))
        for m in OFFSET.finditer(sentence):
            if m[1] in NOT_PLACES or m[5] in NOT_PLACES:
                continue
            out.append(Relation("offset", m[1], m[5], distance_km=to_km(m[2], m[3]), bearing=BEARINGS[m[4]], locator=m[0][:60], **common))
        for pattern in CONNECT:
            for m in pattern.finditer(sentence):
                if m[1] in NOT_PLACES or m[2] in NOT_PLACES or m[1] == m[2]:
                    continue
                length = LENGTH.search(sentence)
                out.append(Relation(
                    "connects", m[1], m[2],
                    is_route_text=bool(ROUTE_WORDS.search(sentence)),
                    stated_length_km=to_km(length[1], length[2]) if length else None,
                    locator=m[0][:60], **common,
                ))
    return out


# --- Place resolution -------------------------------------------------------

SETTLEMENT = re.compile(r"\b(city|town|municipality|commune|village|capital|settlement|statutory city|district capital|gemeinde|stadt)\b", re.I)


def haversine_km(a: tuple[float, float], b: tuple[float, float]) -> float:
    """Distance between (lng, lat) points."""
    lng1, lat1, lng2, lat2 = map(math.radians, (*a, *b))
    h = math.sin((lat2 - lat1) / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin((lng2 - lng1) / 2) ** 2
    return 2 * 6371 * math.asin(math.sqrt(h))


def destination(lng: float, lat: float, bearing: float, km: float) -> tuple[float, float]:
    d, b = km / 6371, math.radians(bearing)
    p1, l1 = math.radians(lat), math.radians(lng)
    p2 = math.asin(math.sin(p1) * math.cos(d) + math.cos(p1) * math.sin(d) * math.cos(b))
    l2 = l1 + math.atan2(math.sin(b) * math.sin(d) * math.cos(p1), math.cos(d) - math.sin(p1) * math.sin(p2))
    return (round(math.degrees(l2), 5), round(math.degrees(p2), 5))


def filter_candidates(candidates: list[Candidate], bbox: tuple[float, float, float, float]) -> list[Candidate]:
    """Keeps settlements inside the region package's bounding box. A match is a candidate, not proof."""
    w, s, e, n = bbox
    return [c for c in candidates if SETTLEMENT.search(c.description) and w <= c.lng <= e and s <= c.lat <= n]


# --- Geometry from constraints ----------------------------------------------

def circle(lng: float, lat: float, km: float) -> BaseGeometry:
    """A circle in degrees, corrected for latitude. Good enough for error discs of tens of km."""
    pts = [destination(lng, lat, b, km) for b in range(0, 360, 15)]
    from shapely.geometry import Polygon
    return Polygon(pts)


def offset_uncertainty_km(distance_km: float) -> float:
    # A stated distance is usually rounded, and eight-point directions span +/-22.5 degrees.
    return max(2.0, distance_km * math.sin(math.radians(22.5)))


def intersect_constraints(discs: list[BaseGeometry]) -> BaseGeometry | None:
    """Where every source's error disc overlaps. None means the sources disagree."""
    area = discs[0]
    for d in discs[1:]:
        area = area.intersection(d)
        if area.is_empty:
            return None
    return area


def route_feature(fid: str, ends: tuple[Candidate, Candidate], valid_from: str | None) -> Feature:
    a, b = ends
    return Feature(
        id=fid, classification="inferred", geometry=LineString([(a.lng, a.lat), (b.lng, b.lat)]),
        uncertainty_km=None, uncertainty="Only the two named ends are known. The line between them is assumed, not the real route.",
        relation_kinds=["connects"], places=[a.qid, b.qid], valid_from=valid_from,
    )


# --- Validation and routing -------------------------------------------------

def validate_route(f: Feature, stated_length_km: float | None, snapshots: list[tuple[str, str, BaseGeometry]]) -> None:
    f.checks["geometry_valid"] = "pass" if f.geometry.is_valid and not f.geometry.is_empty else "fail"
    coords = list(f.geometry.coords)
    straight = haversine_km(coords[0], coords[-1])
    if stated_length_km is None:
        f.checks["length"] = "not_stated"
    else:
        # A track can't be shorter than the straight line between its ends.
        f.checks["length"] = "pass" if straight <= stated_length_km * 1.05 else "fail"
    f.checks["date"] = "pass" if f.valid_from else "missing"
    active = [g for start, end, g in snapshots if f.valid_from and start <= f.valid_from <= end]
    if not active:
        f.checks["reference_map"] = "no_reference_for_date"
    else:
        f.checks["reference_map"] = "pass" if all(any(g.buffer(0.1).contains(Point(c)) for g in active) for c in coords) else "outside"


def route(f: Feature, ambiguous: bool, high_impact: bool) -> None:
    """Publishes only what passed every check. Everything uncertain goes to a person."""
    if f.checks.get("geometry_valid") == "fail" or f.checks.get("length") == "fail":
        f.status, f.reasons = "rejected", [f"failed check: {k}" for k, v in f.checks.items() if v == "fail"]
        return
    reasons = []
    if ambiguous:
        reasons.append("more than one place matches a name")
    if high_impact:
        reasons.append("high-impact claim requires review")
    if f.checks.get("date") == "missing":
        reasons.append("no opening date in the same sentence, so validity is unknown")
    if f.checks.get("reference_map") == "outside":
        reasons.append("falls outside the reference outline for that date")
    if any(s.get("conflict") for s in f.sources):
        reasons.append("sources disagree")
    f.status, f.reasons = ("needs_review", reasons) if reasons else ("validated", [])


def iou(a: BaseGeometry, b: BaseGeometry) -> float:
    union = a.union(b).area
    return a.intersection(b).area / union if union else 0.0


def to_json(f: Feature) -> dict:
    return {
        "id": f.id, "classification": f.classification, "status": f.status, "reasons": f.reasons,
        "geometry": mapping(f.geometry), "uncertainty_km": f.uncertainty_km, "uncertainty": f.uncertainty,
        "places": f.places, "valid_from": f.valid_from, "sources": f.sources, "alternatives": f.alternatives,
        "checks": f.checks, "extractor": EXTRACTOR_VERSION,
    }


__all__ = ["shape"]
