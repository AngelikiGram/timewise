import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "ingestion/geo"))

import pipeline as P  # noqa: E402
from shapely.geometry import box  # noqa: E402


def cand(qid, lng, lat, desc="city in Austria"):
    return P.Candidate(qid, qid, desc, lat, lng)


def test_political_talks_are_not_treated_as_a_route():
    rel = P.extract_relations("Talks between Austria and Hungary continued.")[0]
    assert rel.kind == "connects" and not rel.is_route_text


def test_vague_period_gives_no_invented_year():
    rel = P.extract_relations("The line between Graz and Linz opened in the early nineteenth century.")[0]
    assert rel.year is None


def test_missing_date_goes_to_review_not_the_map():
    f = P.route_feature("x", (cand("Q1", 15, 47), cand("Q2", 16, 48)), None)
    P.validate_route(f, None, [])
    P.route(f, ambiguous=False, high_impact=False)
    assert f.status == "needs_review"


def test_route_shorter_than_straight_line_is_rejected():
    f = P.route_feature("x", (cand("Q1", 15, 47), cand("Q2", 16, 48)), "1860-01-01")
    P.validate_route(f, 10, [])
    P.route(f, False, False)
    assert f.status == "rejected"


def test_ambiguous_name_goes_to_review():
    f = P.route_feature("x", (cand("Q1", 15, 47), cand("Q2", 16, 48)), "1860-01-01")
    P.validate_route(f, None, [])
    P.route(f, ambiguous=True, high_impact=False)
    assert f.status == "needs_review"


def test_high_impact_always_goes_to_review():
    f = P.route_feature("x", (cand("Q1", 15, 47), cand("Q2", 16, 48)), "1860-01-01")
    P.validate_route(f, None, [])
    P.route(f, False, high_impact=True)
    assert f.status == "needs_review"


def test_outside_reference_outline_goes_to_review():
    f = P.route_feature("x", (cand("Q1", 15, 47), cand("Q2", 16, 48)), "1890-01-01")
    P.validate_route(f, None, [("1880-01-01", "1899-12-31", box(0, 0, 1, 1))])
    P.route(f, False, False)
    assert f.status == "needs_review"


def test_clean_route_is_validated_and_still_classed_inferred():
    f = P.route_feature("x", (cand("Q1", 15, 47), cand("Q2", 16, 48)), "1860-01-01")
    P.validate_route(f, 200, [])
    P.route(f, False, False)
    assert f.status == "validated" and f.classification == "inferred"


def test_filter_drops_non_settlements_and_other_regions():
    kept = P.filter_candidates([cand("Q1", 15, 47), cand("Q2", 15, 47, "country in Europe"), cand("Q3", -80, 40)], (8, 42, 24, 52))
    assert [c.qid for c in kept] == ["Q1"]


def test_conflicting_constraints_give_no_location():
    assert P.intersect_constraints([P.circle(15, 47, 5), P.circle(18, 47, 5)]) is None


def test_agreeing_constraints_narrow_the_area():
    a, b = P.circle(15, 47, 20), P.circle(15.1, 47, 20)
    assert P.intersect_constraints([a, b]).area < a.area


def test_place_names_exclude_sentence_punctuation():
    rel = P.extract_relations("Graz lies about 145 km southwest of Vienna.")[0]
    assert rel.obj == "Vienna"


def test_iou():
    assert abs(P.iou(box(0, 0, 2, 2), box(1, 0, 3, 2)) - 1 / 3) < 1e-9
