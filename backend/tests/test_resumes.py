"""Resume + section CRUD, validation, ownership isolation and auth enforcement."""

from collections.abc import Callable
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Resume, ResumeSection
from tests.conftest import resume_payload

Headers = dict[str, str]
MakeResume = Callable[..., dict[str, Any]]

API = "/api/resumes"


def _section(**overrides: Any) -> dict[str, Any]:
    body: dict[str, Any] = {"type": "experience", "title": "Engineer", "bullets": ["Did a thing"]}
    body.update(overrides)
    return body


def _positions(resume: dict[str, Any]) -> list[tuple[str, int]]:
    return [(s["title"], s["position"]) for s in resume["sections"]]


# -------------------------------------------------------------------- CRUD
def test_create_resume_full(client: TestClient, auth_headers: Headers, template_id: int) -> None:
    response = client.post(API, json=resume_payload(template_id), headers=auth_headers)
    assert response.status_code == 201
    body = response.json()
    assert body["title"] == "Backend Engineer Resume"
    assert body["template_id"] == template_id
    assert body["ats_score"] is None
    assert body["skills"] == ["Python", "FastAPI", "PostgreSQL", "Docker", "AWS"]
    assert _positions(body) == [("Senior Engineer", 0), ("BSc Computer Science", 1)]
    assert body["sections"][0]["bullets"] == ["Built the billing API", "Cut p99 latency by 40%"]
    assert body["sections"][0]["start_date"] == "2020-01-01"


def test_create_resume_minimal(client: TestClient, auth_headers: Headers, template_id: int) -> None:
    response = client.post(
        API, json={"template_id": template_id, "title": "Bare"}, headers=auth_headers
    )
    assert response.status_code == 201
    body = response.json()
    assert body["skills"] == []
    assert body["sections"] == []
    assert body["email"] is None


def test_create_normalises_blank_optionals(
    client: TestClient, auth_headers: Headers, template_id: int
) -> None:
    payload = {
        "template_id": template_id,
        "title": "  Padded  ",
        "email": "",
        "phone": "   ",
        "linkedin_url": "",
        "summary": " ",
        "skills": ["  Python  "],
    }
    body = client.post(API, json=payload, headers=auth_headers).json()
    assert body["title"] == "Padded"
    assert body["email"] is None
    assert body["phone"] is None
    assert body["linkedin_url"] is None
    assert body["summary"] is None
    assert body["skills"] == ["Python"]


def test_list_resumes_only_own_newest_first(
    client: TestClient, auth_headers: Headers, other_headers: Headers, make_resume: MakeResume
) -> None:
    first = make_resume(auth_headers, title="First")
    second = make_resume(auth_headers, title="Second")
    make_resume(other_headers, title="Bob's")
    listed = client.get(API, headers=auth_headers).json()
    assert [r["id"] for r in listed] == [second["id"], first["id"]]
    assert all(r["title"] != "Bob's" for r in listed)


def test_list_empty(client: TestClient, auth_headers: Headers) -> None:
    response = client.get(API, headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == []


def test_get_resume(client: TestClient, auth_headers: Headers, make_resume: MakeResume) -> None:
    created = make_resume(auth_headers)
    response = client.get(f"{API}/{created['id']}", headers=auth_headers)
    assert response.status_code == 200
    assert response.json() == created


def test_get_missing_resume_404(client: TestClient, auth_headers: Headers) -> None:
    assert client.get(f"{API}/424242", headers=auth_headers).status_code == 404


def test_get_non_integer_id_422(client: TestClient, auth_headers: Headers) -> None:
    assert client.get(f"{API}/abc", headers=auth_headers).status_code == 422


def test_update_resume_partial_keeps_other_fields(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    response = client.put(f"{API}/{created['id']}", json={"title": "Renamed"}, headers=auth_headers)
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Renamed"
    assert body["full_name"] == created["full_name"]
    assert body["skills"] == created["skills"]
    assert len(body["sections"]) == 2


def test_update_resume_can_clear_nullable_field(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    response = client.put(f"{API}/{created['id']}", json={"summary": None}, headers=auth_headers)
    assert response.status_code == 200
    assert response.json()["summary"] is None


def test_update_resume_replaces_skills(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    response = client.put(f"{API}/{created['id']}", json={"skills": ["Go"]}, headers=auth_headers)
    assert response.json()["skills"] == ["Go"]


def test_update_resume_ignores_sections_field(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    response = client.put(
        f"{API}/{created['id']}", json={"sections": [], "user_id": 999}, headers=auth_headers
    )
    assert response.status_code == 200
    assert len(response.json()["sections"]) == 2
    assert response.json()["user_id"] == created["user_id"]


def test_update_to_other_active_template(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume, db: Session
) -> None:
    created = make_resume(auth_headers)
    from app.models import Template

    other = db.query(Template).filter(Template.slug == "modern-clean").one()
    response = client.put(
        f"{API}/{created['id']}", json={"template_id": other.id}, headers=auth_headers
    )
    assert response.status_code == 200
    assert response.json()["template_id"] == other.id


def test_update_to_inactive_template_400(
    client: TestClient,
    auth_headers: Headers,
    make_resume: MakeResume,
    inactive_template_id: int,
) -> None:
    created = make_resume(auth_headers)
    response = client.put(
        f"{API}/{created['id']}", json={"template_id": inactive_template_id}, headers=auth_headers
    )
    assert response.status_code == 400


def test_update_keeps_working_after_own_template_deactivated(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume, db: Session
) -> None:
    from app.models import Template

    created = make_resume(auth_headers)
    db.query(Template).filter(Template.id == created["template_id"]).update(
        {Template.is_active: False}
    )
    db.commit()
    same_template = {"title": "Still editable", "template_id": created["template_id"]}
    response = client.put(f"{API}/{created['id']}", json=same_template, headers=auth_headers)
    assert response.status_code == 200


def test_delete_resume_cascades_sections(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume, db: Session
) -> None:
    created = make_resume(auth_headers)
    assert db.query(ResumeSection).count() == 2
    assert client.delete(f"{API}/{created['id']}", headers=auth_headers).status_code == 204
    assert client.get(f"{API}/{created['id']}", headers=auth_headers).status_code == 404
    db.expire_all()
    assert db.query(ResumeSection).count() == 0
    assert db.query(Resume).count() == 0


def test_delete_missing_404(client: TestClient, auth_headers: Headers) -> None:
    assert client.delete(f"{API}/999", headers=auth_headers).status_code == 404


def test_duplicate_resume(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    response = client.post(f"{API}/{created['id']}/duplicate", headers=auth_headers)
    assert response.status_code == 201
    copy = response.json()
    assert copy["id"] != created["id"]
    assert copy["title"] == "Backend Engineer Resume (copy)"
    assert copy["skills"] == created["skills"]
    assert [(s["title"], s["position"]) for s in copy["sections"]] == _positions(created)
    original_ids = {s["id"] for s in created["sections"]}
    assert original_ids.isdisjoint({s["id"] for s in copy["sections"]})
    # Editing the copy does not touch the original.
    client.put(f"{API}/{copy['id']}", json={"title": "X"}, headers=auth_headers)
    assert client.get(f"{API}/{created['id']}", headers=auth_headers).json()["title"] == (
        "Backend Engineer Resume"
    )


def test_duplicate_long_title_is_truncated_to_200(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers, title="T" * 200)
    copy = client.post(f"{API}/{created['id']}/duplicate", headers=auth_headers).json()
    assert len(copy["title"]) == 200


# -------------------------------------------------------------- validation
def _create(client: TestClient, headers: Headers, tid: int, **overrides: Any) -> Any:
    payload = resume_payload(tid)
    payload.update(overrides)
    return client.post(API, json=payload, headers=headers)


@pytest.mark.parametrize(
    "overrides",
    [
        {"email": "not-an-email"},
        {"linkedin_url": "ftp://example.com/x"},
        {"linkedin_url": "javascript:alert(1)"},
        {"website_url": "example.com"},
        {"website_url": "http://has space.com"},
        {"phone": "abc"},
        {"phone": "12345"},
        {"title": None},
        {"title": ""},
        {"title": "   "},
        {"title": "x" * 201},
        {"full_name": "x" * 101},
        {"summary": "x" * 3001},
        {"template_id": 0},
        {"skills": ["Skill"] * 51},
        {"skills": ["x" * 61]},
        {"skills": [""]},
        {"sections": [_section()] * 21},
        {"sections": [_section(bullets=["b"] * 16)]},
        {"sections": [_section(bullets=["x" * 501])]},
        {"sections": [_section(title="")]},
        {"sections": [_section(type="hobby")]},
        {"sections": [_section(start_date="not-a-date")]},
        {"sections": [_section(start_date="2022-01-01", end_date="2021-01-01")]},
        {"sections": [_section(position=-1)]},
    ],
    ids=lambda o: str(list(o.items())[0])[:60],
)
def test_create_validation_422(
    client: TestClient, auth_headers: Headers, template_id: int, overrides: dict[str, Any]
) -> None:
    assert _create(client, auth_headers, template_id, **overrides).status_code == 422


def test_create_missing_required_fields_422(client: TestClient, auth_headers: Headers) -> None:
    assert client.post(API, json={}, headers=auth_headers).status_code == 422


def test_create_at_exact_limits_ok(
    client: TestClient, auth_headers: Headers, template_id: int
) -> None:
    response = _create(
        client,
        auth_headers,
        template_id,
        skills=[f"s{i}" for i in range(50)],
        sections=[_section(bullets=["b"] * 15) for _ in range(20)],
    )
    assert response.status_code == 201
    assert len(response.json()["sections"]) == 20


def test_create_same_start_and_end_date_ok(
    client: TestClient, auth_headers: Headers, template_id: int
) -> None:
    section = _section(start_date="2022-01-01", end_date="2022-01-01")
    assert _create(client, auth_headers, template_id, sections=[section]).status_code == 201


def test_create_nonexistent_template_400(client: TestClient, auth_headers: Headers) -> None:
    response = _create(client, auth_headers, 99999)
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "BAD_REQUEST"


def test_create_inactive_template_400(
    client: TestClient, auth_headers: Headers, inactive_template_id: int
) -> None:
    assert _create(client, auth_headers, inactive_template_id).status_code == 400


@pytest.mark.parametrize(
    "body",
    [
        {"title": None},
        {"skills": None},
        {"template_id": None},
        {"email": "bad"},
        {"title": ""},
    ],
)
def test_update_validation_422(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume, body: dict[str, Any]
) -> None:
    created = make_resume(auth_headers)
    assert client.put(f"{API}/{created['id']}", json=body, headers=auth_headers).status_code == 422


# ---------------------------------------------------------------- sections
def test_add_section_appends_at_end(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    response = client.post(
        f"{API}/{created['id']}/sections", json=_section(title="Appended"), headers=auth_headers
    )
    assert response.status_code == 201
    assert response.json()["position"] == 2
    assert response.json()["resume_id"] == created["id"]


def test_add_section_at_position_renumbers(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    client.post(
        f"{API}/{created['id']}/sections",
        json=_section(title="First!", position=0),
        headers=auth_headers,
    )
    body = client.get(f"{API}/{created['id']}", headers=auth_headers).json()
    assert _positions(body) == [
        ("First!", 0),
        ("Senior Engineer", 1),
        ("BSc Computer Science", 2),
    ]


def test_add_section_position_beyond_end_clamped(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    response = client.post(
        f"{API}/{created['id']}/sections",
        json=_section(title="Last", position=500),
        headers=auth_headers,
    )
    assert response.status_code == 201
    assert response.json()["position"] == 2


def test_add_section_over_limit_400(
    client: TestClient, auth_headers: Headers, template_id: int
) -> None:
    created = _create(
        client, auth_headers, template_id, sections=[_section() for _ in range(20)]
    ).json()
    response = client.post(f"{API}/{created['id']}/sections", json=_section(), headers=auth_headers)
    assert response.status_code == 400


def test_add_section_validation_422(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    url = f"{API}/{created['id']}/sections"
    assert client.post(url, json={"type": "experience"}, headers=auth_headers).status_code == 422
    bad_dates = _section(start_date="2022-02-01", end_date="2022-01-01")
    assert client.post(url, json=bad_dates, headers=auth_headers).status_code == 422


def test_update_section_fields(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    section = created["sections"][0]
    response = client.put(
        f"{API}/{created['id']}/sections/{section['id']}",
        json={"title": "Staff Engineer", "bullets": ["One"], "organization": None},
        headers=auth_headers,
    )
    assert response.status_code == 200
    body = response.json()
    assert body["title"] == "Staff Engineer"
    assert body["bullets"] == ["One"]
    assert body["organization"] is None
    assert body["start_date"] == section["start_date"]  # untouched


def test_update_section_position_renumbers(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(
        auth_headers,
        sections=[_section(title="A"), _section(title="B"), _section(title="C")],
    )
    c = created["sections"][2]
    response = client.put(
        f"{API}/{created['id']}/sections/{c['id']}", json={"position": 0}, headers=auth_headers
    )
    assert response.status_code == 200
    body = client.get(f"{API}/{created['id']}", headers=auth_headers).json()
    assert _positions(body) == [("C", 0), ("A", 1), ("B", 2)]


@pytest.mark.parametrize(
    "body", [{"title": None}, {"type": None}, {"bullets": None}, {"title": ""}]
)
def test_update_section_null_or_empty_rejected_422(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume, body: dict[str, Any]
) -> None:
    created = make_resume(auth_headers)
    sid = created["sections"][0]["id"]
    response = client.put(f"{API}/{created['id']}/sections/{sid}", json=body, headers=auth_headers)
    assert response.status_code == 422


def test_update_section_end_before_existing_start_400(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    sid = created["sections"][0]["id"]  # starts 2020-01-01
    response = client.put(
        f"{API}/{created['id']}/sections/{sid}",
        json={"end_date": "2019-01-01"},
        headers=auth_headers,
    )
    assert response.status_code == 400
    # Rejected edit must not leak into stored data.
    stored = client.get(f"{API}/{created['id']}", headers=auth_headers).json()
    assert stored["sections"][0]["end_date"] == "2023-06-01"


def test_update_section_body_dates_out_of_order_422(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    sid = created["sections"][0]["id"]
    response = client.put(
        f"{API}/{created['id']}/sections/{sid}",
        json={"start_date": "2024-01-01", "end_date": "2023-01-01"},
        headers=auth_headers,
    )
    assert response.status_code == 422


def test_delete_section_renumbers(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(
        auth_headers,
        sections=[_section(title="A"), _section(title="B"), _section(title="C")],
    )
    b = created["sections"][1]
    response = client.delete(f"{API}/{created['id']}/sections/{b['id']}", headers=auth_headers)
    assert response.status_code == 204
    body = client.get(f"{API}/{created['id']}", headers=auth_headers).json()
    assert _positions(body) == [("A", 0), ("C", 1)]


def test_missing_section_404(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    url = f"{API}/{created['id']}/sections/987654"
    assert client.put(url, json={"title": "x"}, headers=auth_headers).status_code == 404
    assert client.delete(url, headers=auth_headers).status_code == 404


def test_section_of_other_resume_404(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    first = make_resume(auth_headers)
    second = make_resume(auth_headers, title="Second")
    foreign_section = first["sections"][0]["id"]
    url = f"{API}/{second['id']}/sections/{foreign_section}"
    assert client.put(url, json={"title": "x"}, headers=auth_headers).status_code == 404
    assert client.delete(url, headers=auth_headers).status_code == 404
    still = client.get(f"{API}/{first['id']}", headers=auth_headers).json()
    assert len(still["sections"]) == 2


# --------------------------------------------------------------- ownership
def test_other_user_gets_404_on_every_verb(
    client: TestClient,
    auth_headers: Headers,
    other_headers: Headers,
    make_resume: MakeResume,
) -> None:
    created = make_resume(auth_headers)
    rid = created["id"]
    sid = created["sections"][0]["id"]
    calls: list[tuple[str, str, dict[str, Any] | None]] = [
        ("GET", f"{API}/{rid}", None),
        ("PUT", f"{API}/{rid}", {"title": "hijacked"}),
        ("DELETE", f"{API}/{rid}", None),
        ("POST", f"{API}/{rid}/duplicate", None),
        ("POST", f"{API}/{rid}/sections", _section()),
        ("PUT", f"{API}/{rid}/sections/{sid}", {"title": "hijacked"}),
        ("DELETE", f"{API}/{rid}/sections/{sid}", None),
        ("GET", f"{API}/{rid}/ats-check", None),
        ("GET", f"{API}/{rid}/export/pdf", None),
        ("GET", f"{API}/{rid}/export/docx", None),
    ]
    for method, url, body in calls:
        response = client.request(method, url, json=body, headers=other_headers)
        assert response.status_code == 404, f"{method} {url} -> {response.status_code}"
        assert response.json()["error"]["code"] == "NOT_FOUND"
    # Owner's data is untouched.
    assert client.get(f"{API}/{rid}", headers=auth_headers).json() == created
    assert client.get(API, headers=other_headers).json() == []


# ------------------------------------------------------ unauthenticated 401
def test_every_endpoint_requires_auth(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers)
    rid = created["id"]
    sid = created["sections"][0]["id"]
    calls: list[tuple[str, str, dict[str, Any] | None]] = [
        ("GET", API, None),
        ("POST", API, {"template_id": 1, "title": "x"}),
        ("GET", f"{API}/{rid}", None),
        ("PUT", f"{API}/{rid}", {"title": "x"}),
        ("DELETE", f"{API}/{rid}", None),
        ("POST", f"{API}/{rid}/duplicate", None),
        ("POST", f"{API}/{rid}/sections", _section()),
        ("PUT", f"{API}/{rid}/sections/{sid}", {"title": "x"}),
        ("DELETE", f"{API}/{rid}/sections/{sid}", None),
        ("GET", f"{API}/{rid}/ats-check", None),
        ("GET", f"{API}/{rid}/export/pdf", None),
        ("GET", f"{API}/{rid}/export/docx", None),
    ]
    for method, url, body in calls:
        response = client.request(method, url, json=body)
        assert response.status_code == 401, f"{method} {url} -> {response.status_code}"
