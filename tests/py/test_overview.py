"""Country attribution and wording checks in the overview build (apps/api/timewise_api/overview.py)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps/api"))

from timewise_api.overview import attribute, merge, relabel, title_year  # noqa: E402


def ev(id_, inside, **kw):
    return {"id": id_, "title": {"en": kw.pop("title", id_)}, "category": kw.pop("category", "war"), "start": kw.pop("start", "1776-01-01"), "precision": "year", "inside": inside, **kw}


def test_a_war_filed_under_many_countries_is_not_labelled_as_the_first_of_them():
    countries = ["albania", "france", "spain", "united_kingdom", "united_states"]
    regions = [{"id": c} for c in countries]
    by_region = {c: [ev("Q40949", c == "united_states")] for c in countries}
    attribute(regions, by_region)
    row = merge(regions, by_region)[0]
    assert "country" not in row  # "Multiple regions", not Albania
    assert row["nc"] == 5
    assert by_region["albania"][0]["home"] == "united_states"
    assert by_region["albania"][0]["multi"] is True


def test_an_event_in_a_few_countries_keeps_the_one_it_lies_in():
    regions = [{"id": "andorra"}, {"id": "spain"}]
    by_region = {"andorra": [ev("Q10859", False)], "spain": [ev("Q10859", True)]}
    attribute(regions, by_region)
    assert merge(regions, by_region)[0]["country"] == "spain"


def test_founding_wording_fits_the_record():
    constitution = ev("Q1", True, category="politics", title="Founding of Constitution of Ghana")
    relabel(constitution)
    assert constitution["title"]["en"] == "Constitution of Ghana adopted"
    university = ev("Q2", True, category="culture", title="Founding of Kabul University")
    relabel(university)
    assert university["title"]["en"] == "Founding of Kabul University"
    building = ev("Q3", True, category="culture", title="Founding of Hagia Sophia")
    relabel(building)
    assert building["title"]["en"] == "Hagia Sophia" and building["incept"]


def test_a_name_that_gives_another_year_is_flagged():
    wrong = ev("Q4", True, category="politics", title="1988 Malian parliamentary election", start="1998-06-26")
    title_year(wrong)
    assert wrong["titleYear"] == 1988
    right = ev("Q5", True, category="politics", title="1848 revolution", start="1848-03-13")
    title_year(right)
    assert "titleYear" not in right
    incident = ev("Q6", True, category="politics", title="228 Incident", start="1947-02-27")
    title_year(incident)
    assert "titleYear" not in incident
