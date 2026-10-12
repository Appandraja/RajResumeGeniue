"""ATS rule engine: pure-function unit tests plus the persisted-score endpoint."""

from collections.abc import Callable
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient

from app.models import Resume, ResumeSection, SectionType
from app.services.ats_service import evaluate_resume
from tests.conftest import resume_payload

GOOD_SUMMARY = "Backend engineer with a decade of experience building reliable services at scale."


def _exp(
    title: str = "Engineer",
    bullets: list[str] | None = None,
    start: date | None = date(2020, 1, 1),
) -> ResumeSection:
    return ResumeSection(
        type=SectionType.experience,
        title=title,
        start_date=start,
        bullets=["Shipped feature A", "Shipped feature B"] if bullets is None else bullets,
        position=0,
    )


def _edu(start: date | None = date(2012, 9, 1)) -> ResumeSection:
    return ResumeSection(
        type=SectionType.education, title="BSc", start_date=start, bullets=[], position=1
    )


def make(**overrides: Any) -> Resume:
    """A resume that scores exactly 100 unless overridden."""
    fields: dict[str, Any] = {
        "full_name": "Alice Example",
        "email": "alice@example.com",
        "phone": "+1 555 123 4567",
        "location": "Berlin, Germany",
        "linkedin_url": "https://linkedin.com/in/alice",
        "summary": GOOD_SUMMARY,
        "skills": ["Python", "FastAPI", "SQL", "Docker", "AWS"],
        "sections": [_exp(), _edu()],
    }
    fields.update(overrides)
    return Resume(**fields)


def test_perfect_resume_scores_100() -> None:
    result = evaluate_resume(make())
    assert result.score == 100
    assert result.suggestions == []


@pytest.mark.parametrize(
    ("override", "penalty", "needle"),
    [
        ({"full_name": None}, 8, "full name"),
        ({"full_name": "   "}, 8, "full name"),
        ({"email": None}, 8, "email"),
        ({"phone": None}, 6, "phone"),
        ({"location": ""}, 6, "location"),
        ({"linkedin_url": None}, 3, "LinkedIn"),
        ({"summary": None}, 8, "summary"),
        ({"summary": "Too short."}, 3, "Expand your summary"),
        ({"skills": []}, 10, "skills list"),
        ({"skills": ["  ", ""]}, 10, "skills list"),
        ({"skills": ["a", "b", "c", "d"]}, 5, "at least 5 skills"),
        ({"sections": [_edu()]}, 15, "work experience"),
        ({"sections": [_exp()]}, 8, "education"),
    ],
)
def test_single_rule_penalties(override: dict[str, Any], penalty: int, needle: str) -> None:
    result = evaluate_resume(make(**override))
    assert result.score == 100 - penalty
    assert len(result.suggestions) == 1
    assert needle.lower() in result.suggestions[0].lower()


def test_summary_exactly_min_length_not_penalised() -> None:
    assert evaluate_resume(make(summary="x" * 50)).score == 100
    assert evaluate_resume(make(summary="x" * 49)).score == 97


def test_five_skills_boundary() -> None:
    assert evaluate_resume(make(skills=list("abcde"))).score == 100
    assert evaluate_resume(make(skills=list("abcd"))).score == 95


def test_missing_dates_penalty_capped() -> None:
    one = evaluate_resume(make(sections=[_exp(start=None), _edu()]))
    assert one.score == 96
    assert "Engineer" in one.suggestions[0]
    many = evaluate_resume(
        make(sections=[_exp(title=f"Job {i}", start=None) for i in range(5)] + [_edu(start=None)])
    )
    # capped at 10 for dates; every experience has 2 bullets so no sparse penalty
    assert many.score == 90


def test_empty_bullets_penalty() -> None:
    result = evaluate_resume(make(sections=[_exp(bullets=["good", "  ", "ok"]), _edu()]))
    assert result.score == 98
    assert any("empty bullet" in s for s in result.suggestions)


def test_empty_bullets_penalty_capped_at_6() -> None:
    bullets = ["good one", "ok two"] + [" "] * 10
    assert evaluate_resume(make(sections=[_exp(bullets=bullets), _edu()])).score == 94


def test_long_bullet_penalty_and_boundary() -> None:
    exactly = ["x" * 200, "fine"]
    assert evaluate_resume(make(sections=[_exp(bullets=exactly), _edu()])).score == 100
    too_long = ["x" * 201, "fine"]
    result = evaluate_resume(make(sections=[_exp(bullets=too_long), _edu()]))
    assert result.score == 98
    assert any("longer than 200" in s for s in result.suggestions)


def test_long_bullet_penalty_capped_at_8() -> None:
    bullets = ["x" * 250] * 6
    assert evaluate_resume(make(sections=[_exp(bullets=bullets), _edu()])).score == 92


def test_sparse_experience_penalty() -> None:
    result = evaluate_resume(make(sections=[_exp(bullets=["only one"]), _edu()]))
    assert result.score == 96
    assert any("at least 2 achievement bullets" in s for s in result.suggestions)


def test_sparse_experience_ignores_blank_bullets() -> None:
    # one real bullet + one blank: sparse (-4) and empty bullet (-2)
    result = evaluate_resume(make(sections=[_exp(bullets=["real", ""]), _edu()]))
    assert result.score == 94


def test_education_bullets_not_required() -> None:
    assert evaluate_resume(make(sections=[_exp(), _edu()])).score == 100


def test_sparse_penalty_capped_at_10() -> None:
    sections = [_exp(title=f"Job {i}", bullets=[]) for i in range(6)] + [_edu()]
    assert evaluate_resume(make(sections=sections)).score == 90


def test_score_clamped_to_0_100_for_worst_case() -> None:
    worst = Resume(
        full_name=None,
        email=None,
        phone=None,
        location=None,
        linkedin_url=None,
        summary=None,
        skills=[],
        sections=[
            *(_exp(title=f"J{i}", start=None, bullets=["", "x" * 300, ""]) for i in range(5)),
            _edu(start=None),
        ],
    )
    result = evaluate_resume(worst)
    assert 0 <= result.score <= 100
    assert len(result.suggestions) >= 8


def test_empty_resume_is_valid_and_non_negative() -> None:
    result = evaluate_resume(Resume(skills=[], sections=[]))
    assert result.score == 100 - (8 + 8 + 6 + 6 + 3 + 8 + 15 + 8 + 10)
    assert result.score >= 0


def test_multiple_penalties_stack() -> None:
    result = evaluate_resume(make(phone=None, linkedin_url=None, skills=[]))
    assert result.score == 100 - 6 - 3 - 10


# ----------------------------------------------------------- endpoint
def test_ats_check_endpoint_persists_score(
    client: TestClient,
    auth_headers: dict[str, str],
    make_resume: Callable[..., dict[str, Any]],
) -> None:
    created = make_resume(auth_headers, skills=["Python"])
    assert created["ats_score"] is None
    response = client.get(f"/api/resumes/{created['id']}/ats-check", headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["score"] == 100 - 5  # <5 skills
    assert len(body["suggestions"]) == 1
    stored = client.get(f"/api/resumes/{created['id']}", headers=auth_headers).json()
    assert stored["ats_score"] == body["score"]
    listed = client.get("/api/resumes", headers=auth_headers).json()
    assert listed[0]["ats_score"] == body["score"]


def test_ats_check_is_recomputed_after_edit(
    client: TestClient,
    auth_headers: dict[str, str],
    make_resume: Callable[..., dict[str, Any]],
) -> None:
    created = make_resume(auth_headers, skills=["Python"])
    url = f"/api/resumes/{created['id']}/ats-check"
    assert client.get(url, headers=auth_headers).json()["score"] == 95
    client.put(
        f"/api/resumes/{created['id']}",
        json={"skills": ["a", "b", "c", "d", "e"]},
        headers=auth_headers,
    )
    assert client.get(url, headers=auth_headers).json()["score"] == 100


def test_ats_check_empty_resume_via_api(
    client: TestClient, auth_headers: dict[str, str], template_id: int
) -> None:
    created = client.post(
        "/api/resumes", json={"template_id": template_id, "title": "Empty"}, headers=auth_headers
    ).json()
    body = client.get(f"/api/resumes/{created['id']}/ats-check", headers=auth_headers).json()
    assert 0 <= body["score"] <= 100
    assert body["score"] == 100 - 72
    assert body["suggestions"]


def test_ats_check_missing_resume_404(client: TestClient, auth_headers: dict[str, str]) -> None:
    assert client.get("/api/resumes/9999/ats-check", headers=auth_headers).status_code == 404


def test_default_payload_scores_100(
    client: TestClient, auth_headers: dict[str, str], template_id: int
) -> None:
    payload = resume_payload(template_id)
    payload["sections"][1]["bullets"] = []
    created = client.post("/api/resumes", json=payload, headers=auth_headers).json()
    body = client.get(f"/api/resumes/{created['id']}/ats-check", headers=auth_headers).json()
    assert body == {"score": 100, "suggestions": []}
