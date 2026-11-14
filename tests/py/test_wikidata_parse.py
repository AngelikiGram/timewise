import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ingestion/connectors"))

from wikidata_events import normalize, parse_point  # noqa: E402


def row(time: str, end: str | None = None, precision: str = "11") -> list[dict]:
    b = {"i": {"value": "http://www.wikidata.org/entity/Q1"}, "en": {"value": "An event"}, "time": {"value": time}, "precision": {"value": precision}, "links": {"value": "3"}}
    if end:
        b["end"] = {"value": end}
    return [b]


def test_unknown_end_date_is_missing_not_a_date():
    # Wikidata's "unknown value" comes back from QLever as an IRI; it once reached the date column.
    rows, _ = normalize(row("1600-01-01T00:00:00Z", "http://www.wikidata.org/.well-known/genid/abc"), "war", "war")
    assert rows[0]["date_end"] is None


def test_real_end_date_is_kept():
    rows, _ = normalize(row("1600-01-01T00:00:00Z", "1601-05-02T00:00:00Z"), "war", "war")
    assert rows[0]["date_end"] == "1601-05-02"


def test_unknown_start_dates_are_dropped_and_counted():
    rows, dropped = normalize(row("http://www.wikidata.org/.well-known/genid/x"), "war", "war")
    assert rows == [] and dropped["unknown_or_too_vague"] == 1


def test_bc_dates_are_kept_in_historical_numbering():
    # Wikidata's RDF counts astronomically: -0489 is 490 BC (Marathon), 0000 is 1 BC.
    rows, _ = normalize(row("-0489-09-07T00:00:00Z"), "war", "war")
    assert rows[0]["date_start"] == "0490-09-07 BC"
    rows, _ = normalize(row("0000-01-01T00:00:00Z", precision="9"), "war", "war")
    assert rows[0]["date_start"] == "0001-01-01 BC"


def test_a_bc_range_keeps_its_end():
    rows, _ = normalize(row("-0263-01-01T00:00:00Z", "-0240-01-01T00:00:00Z", precision="9"), "war", "war")
    assert (rows[0]["date_start"], rows[0]["date_end"]) == ("0264-01-01 BC", "0241-01-01 BC")


def test_precision_is_kept_not_invented():
    rows, _ = normalize(row("1230-01-01T00:00:00Z", precision="8"), "war", "war")
    assert rows[0]["date_precision"] == "decade"


def test_qlever_and_wdqs_points_both_parse():
    # QLever writes upper-case WKT; it once dropped every coordinate in the worldwide import.
    assert parse_point("POINT(16.37 48.21)") == (16.37, 48.21)
    assert parse_point("Point(16.37 48.21)") == (16.37, 48.21)
    assert parse_point("POINT(400 10)") is None
