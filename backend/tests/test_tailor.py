"""Job description fields, tailoring endpoint and the deterministic keyword engine."""

from collections.abc import Callable
from datetime import date
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import inspect
from sqlalchemy.engine import Engine

from app.main import app
from app.models import Resume, ResumeSection, SectionType
from app.routers import tailor as tailor_router
from app.schemas.resume import MAX_JOB_DESCRIPTION, MAX_SKILLS
from app.schemas.tailor import TailorResponse
from app.services import tailor_service
from app.services.skills_taxonomy import iter_terms
from app.services.tailor_service import analyze, infer_job_title

# Idempotent: main.py wires this router; the guard keeps the module testable on its own.
if not any(getattr(r, "path", "") == "/api/resumes/{resume_id}/tailor" for r in app.routes):
    app.include_router(tailor_router.router)

Headers = dict[str, str]
MakeResume = Callable[..., dict[str, Any]]

SOFTWARE_JD = """Senior Backend Engineer
About us
We are a fast-paced fintech company building payment infrastructure.

Requirements:
- 5+ years of experience with Python and FastAPI
- Strong knowledge of PostgreSQL, Docker and k8s
- Experience with CI/CD pipelines and AWS
- Excellent communication skills

Nice to have:
- Terraform
- Experience with C++ or Golang
- Kafka

Responsibilities:
- Design scalable APIs and microservices
- Mentor junior engineers; code reviews
- Build event-driven systems
"""

MARKETING_JD = """Digital Marketing Manager

We are looking for a Digital Marketing Manager to own our growth.

What you'll do:
- Plan and run SEO, email marketing and content marketing campaigns
- Report on KPIs with Google Analytics and HubSpot
- Run A/B testing on landing pages and improve conversion rate optimization

Qualifications:
- Proven experience in social media marketing and brand management
- Must have excellent copywriting skills

Preferred:
- Experience with Marketo or Salesforce
"""


def exp(
    title: str = "Engineer",
    bullets: list[str] | None = None,
    org: str | None = "Acme",
    pos: int = 0,
) -> ResumeSection:
    return ResumeSection(
        type=SectionType.experience,
        title=title,
        organization=org,
        start_date=date(2020, 1, 1),
        bullets=bullets if bullets is not None else [],
        position=pos,
    )


def mk(**fields: Any) -> Resume:
    base: dict[str, Any] = {
        "title": "Resume",
        "full_name": "Alice Example",
        "email": "alice@example.com",
        "phone": "+1 555 123 4567",
        "location": "Berlin",
        "linkedin_url": "https://linkedin.com/in/alice",
        "summary": "Backend engineer building reliable services for ten years across industries.",
        "skills": [],
        "sections": [],
    }
    base.update(fields)
    return Resume(**base)


def names(items: list[Any]) -> list[str]:
    return [i.keyword for i in items]


def by_keyword(items: list[Any], keyword: str) -> Any:
    return next(i for i in items if i.keyword == keyword)


# ---------------------------------------------------------------- taxonomy


def test_taxonomy_is_large_and_collision_free() -> None:
    entries = list(iter_terms())
    assert len(entries) >= 400
    canon = [c.lstrip("=") for _, c, _ in entries]
    assert len(canon) == len(set(canon))
    for key, terms in tailor_service._INDEX.items():
        assert len(terms) == 1, (key, [t.canonical for t in terms])


# ----------------------------------------------------- schema / CRUD (part 1)


def test_job_columns_exist(engine: Engine) -> None:
    columns = {c["name"]: c for c in inspect(engine).get_columns("resumes")}
    for name in ("job_title", "company", "job_description"):
        assert name in columns
        assert columns[name]["nullable"] is True


def test_create_with_job_fields_and_default_null(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    plain = make_resume(auth_headers)
    assert plain["job_title"] is None
    assert plain["company"] is None
    assert plain["job_description"] is None
    full = make_resume(
        auth_headers, job_title="  Data Engineer ", company="Initech", job_description=SOFTWARE_JD
    )
    assert full["job_title"] == "Data Engineer"
    assert full["company"] == "Initech"
    assert full["job_description"] == SOFTWARE_JD.strip()
    fetched = client.get(f"/api/resumes/{full['id']}", headers=auth_headers).json()
    assert fetched["job_description"] == SOFTWARE_JD.strip()


def test_update_job_fields_partial_and_blank_to_null(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    created = make_resume(auth_headers, job_title="A", company="B", job_description="C")
    rid = created["id"]
    r = client.put(f"/api/resumes/{rid}", json={"company": "Globex"}, headers=auth_headers)
    assert r.status_code == 200
    body = r.json()
    assert (body["job_title"], body["company"], body["job_description"]) == ("A", "Globex", "C")
    r = client.put(
        f"/api/resumes/{rid}",
        json={"job_title": "   ", "job_description": ""},
        headers=auth_headers,
    )
    body = r.json()
    assert body["job_title"] is None
    assert body["job_description"] is None
    assert body["company"] == "Globex"


def test_job_description_limit(
    client: TestClient, auth_headers: Headers, template_id: int, make_resume: MakeResume
) -> None:
    ok = make_resume(auth_headers, job_description="x" * MAX_JOB_DESCRIPTION)
    assert len(ok["job_description"]) == MAX_JOB_DESCRIPTION
    too_long = client.put(
        f"/api/resumes/{ok['id']}",
        json={"job_description": "x" * (MAX_JOB_DESCRIPTION + 1)},
        headers=auth_headers,
    )
    assert too_long.status_code == 422
    assert (
        client.put(
            f"/api/resumes/{ok['id']}", json={"job_title": "t" * 201}, headers=auth_headers
        ).status_code
        == 422
    )


def test_duplicate_copies_job_fields(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    src = make_resume(auth_headers, job_title="PM", company="Hooli", job_description="Own roadmap")
    r = client.post(f"/api/resumes/{src['id']}/duplicate", headers=auth_headers)
    assert r.status_code == 201
    copy = r.json()
    assert (copy["job_title"], copy["company"], copy["job_description"]) == (
        "PM",
        "Hooli",
        "Own roadmap",
    )


# ------------------------------------------------------- endpoint (part 2)


def tailor(
    client: TestClient, headers: Headers, rid: int, body: dict[str, Any] | None = None
) -> Any:
    return client.post(f"/api/resumes/{rid}/tailor", json=body, headers=headers)


def test_tailor_requires_auth(client: TestClient) -> None:
    assert client.post("/api/resumes/1/tailor", json={}).status_code == 401


def test_tailor_other_users_resume_404(
    client: TestClient, auth_headers: Headers, other_headers: Headers, make_resume: MakeResume
) -> None:
    rid = make_resume(auth_headers)["id"]
    r = tailor(client, other_headers, rid, {"job_description": SOFTWARE_JD})
    assert r.status_code == 404
    assert tailor(client, auth_headers, 99999, {"job_description": SOFTWARE_JD}).status_code == 404


@pytest.mark.parametrize("body", [None, {}, {"job_description": "   "}])
def test_tailor_without_any_job_description_400(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume, body: Any
) -> None:
    rid = make_resume(auth_headers)["id"]
    r = tailor(client, auth_headers, rid, body)
    assert r.status_code == 400
    assert "Add a job description first" in r.text


def test_tailor_uses_stored_description_and_body_overrides(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    rid = make_resume(auth_headers, job_description="We need Terraform and Ansible experts.")["id"]
    stored = tailor(client, auth_headers, rid).json()
    assert {"Terraform", "Ansible"} <= {m["keyword"] for m in stored["missing"]}
    override = tailor(client, auth_headers, rid, {"job_description": "Kubernetes wizard"}).json()
    assert "Kubernetes" in {m["keyword"] for m in override["missing"]}
    assert "Terraform" not in {m["keyword"] for m in override["missing"]}


def test_tailor_body_too_long_422(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    rid = make_resume(auth_headers)["id"]
    r = tailor(client, auth_headers, rid, {"job_description": "a" * (MAX_JOB_DESCRIPTION + 1)})
    assert r.status_code == 422


def test_tailor_response_matches_contract_and_is_read_only(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    rid = make_resume(auth_headers, job_title="Backend Engineer")["id"]
    before = client.get(f"/api/resumes/{rid}", headers=auth_headers).json()
    r = tailor(client, auth_headers, rid, {"job_description": SOFTWARE_JD})
    assert r.status_code == 200
    data = r.json()
    assert set(data) == {"match_score", "job_title", "matched", "missing", "suggestions", "ats"}
    assert 0 <= data["match_score"] <= 100
    assert data["job_title"] == "Backend Engineer"  # stored title wins over inference
    assert set(data["ats"]) == {"score", "suggestions"}
    for m in data["matched"]:
        assert set(m) == {"keyword", "importance", "where"}
        assert m["importance"] in ("high", "medium", "low")
    for m in data["missing"]:
        assert set(m) == {"keyword", "importance", "suggestion"}
        assert "Only add skills you actually have." in m["suggestion"]
    for s in data["suggestions"]:
        assert set(s) == {"code", "severity", "section", "message", "action"}
    after = client.get(f"/api/resumes/{rid}", headers=auth_headers).json()
    assert after == before  # nothing persisted, including ats_score and updated_at
    TailorResponse.model_validate(data)


def test_tailor_request_job_title_override(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    rid = make_resume(auth_headers)["id"]
    data = tailor(
        client, auth_headers, rid, {"job_description": SOFTWARE_JD, "job_title": "Staff Dev"}
    ).json()
    assert data["job_title"] == "Staff Dev"


# --------------------------------------------------------------- engine


def test_aliases_k8s_and_kubernetes() -> None:
    res = analyze(mk(skills=["Kubernetes"]), "You will run k8s clusters.")
    assert "Kubernetes" in names(res.matched)
    res = analyze(mk(skills=["k8s"]), "Experience with Kubernetes is needed.")
    assert "Kubernetes" in names(res.matched)
    res = analyze(mk(skills=["PostgreSQL"]), "We use Postgres and JS daily")
    assert {"PostgreSQL", "JavaScript"} == set(names(res.matched + res.missing))
    assert "JavaScript" in names(res.missing)


def test_special_character_terms() -> None:
    jd = "We use C++, C#, .NET, Node.js and CI/CD."
    res = analyze(mk(skills=["C#", ".NET", "Node.js"]), jd)
    assert {"C#", ".NET", "Node.js"} <= set(names(res.matched))
    assert "C++" in names(res.missing)
    assert "CI/CD" in names(res.missing)
    # C++ must not be confused with C#
    res2 = analyze(mk(skills=["C++"]), jd)
    assert "C++" in names(res2.matched)
    assert "C#" in names(res2.missing)


def test_multi_word_plural_and_hyphen_variants() -> None:
    jd = "Machine learning models, project-management and microservice architecture."
    res = analyze(
        mk(skills=["Machine Learning", "Project Management"], summary="Built microservices."), jd
    )
    found = set(names(res.matched))
    assert {"Machine Learning", "Project Management", "Microservices"} <= found


def test_case_sensitive_ambiguous_terms_are_not_false_positives() -> None:
    jd = "We want people who excel at go-to-market and keep a swift pace."
    res = analyze(mk(), jd)
    assert not ({"Excel", "Go", "Swift"} & set(names(res.matched + res.missing)))
    res = analyze(mk(skills=["Go", "Excel"]), "Skills: Go, Excel and Swift.")
    assert {"Go", "Excel"} <= set(names(res.matched))


def test_importance_required_vs_nice_to_have() -> None:
    jd = """Data Analyst
Requirements:
- Python
- SQL
Nice to have:
- Tableau
Bonus: experience with Snowflake.
We use Kafka, which is a plus.
"""
    res = analyze(mk(), jd)
    imp = {m.keyword: m.importance for m in res.missing}
    assert imp["Python"] == "high"
    assert imp["SQL"] == "high"
    assert imp["Tableau"] == "low"
    assert imp["Snowflake"] == "low"
    assert imp["Apache Kafka"] == "low"


def test_importance_repeated_and_default_medium() -> None:
    jd = "Our stack uses Redis. We use Docker. Docker everywhere. Docker again."
    res = analyze(mk(), jd)
    imp = {m.keyword: m.importance for m in res.missing}
    assert imp["Docker"] == "high"
    assert imp["Redis"] == "medium"


def test_importance_title_and_inline_must() -> None:
    res = analyze(mk(), "Python Developer\nBuild things with Django.\nMust know Flask.\n")
    imp = {m.keyword: m.importance for m in res.missing}
    assert imp["Python"] == "high"  # in the title
    assert imp["Flask"] == "high"  # "must" cue
    assert imp["Django"] == "medium"


def test_header_like_line_with_skill_is_content_not_header() -> None:
    res = analyze(mk(), "Must have Python\nDjango\n")
    imp = {m.keyword: m.importance for m in res.missing}
    assert imp["Python"] == "high"
    assert imp["Django"] == "medium"


def test_score_is_monotonic_with_more_keywords() -> None:
    scores = []
    skill_sets: list[list[str]] = [
        [],
        ["Python"],
        ["Python", "FastAPI"],
        ["Python", "FastAPI", "PostgreSQL", "Docker"],
        ["Python", "FastAPI", "PostgreSQL", "Docker", "Kubernetes", "AWS", "CI/CD"],
    ]
    for skills in skill_sets:
        scores.append(analyze(mk(skills=skills), SOFTWARE_JD).match_score)
    assert scores == sorted(scores)
    assert scores[0] < scores[-1]
    assert all(0 <= s <= 100 for s in scores)


def test_perfect_coverage_scores_100() -> None:
    res = analyze(mk(skills=["Python", "Django"]), "We need Python and Django.")
    assert res.match_score == 100
    assert res.missing == []


def test_where_reports_locations() -> None:
    resume = mk(
        skills=["Python"],
        summary="Python developer with Docker experience.",
        sections=[
            exp("AWS Engineer", bullets=["Wrote Python tools", "Reduced cost 20% on S3"]),
            ResumeSection(
                type=SectionType.education,
                title="MSc Machine Learning",
                bullets=[],
                position=1,
            ),
            ResumeSection(
                type=SectionType.project,
                title="Side project",
                bullets=["Packaged with Docker"],
                position=2,
            ),
        ],
    )
    res = analyze(resume, "Python, Docker, AWS, Machine Learning, S3.")
    assert by_keyword(res.matched, "Python").where == ["skills", "summary", "experience"]
    assert by_keyword(res.matched, "Docker").where == ["summary", "project"]
    assert by_keyword(res.matched, "AWS").where == ["experience"]
    assert by_keyword(res.matched, "Machine Learning").where == ["education"]


def test_phrase_keywords_from_repeated_ngrams() -> None:
    jd = (
        "We value stakeholder alignment. Strong stakeholder alignment skills matter; "
        "stakeholder alignment is key. Also supply planning and supply planning."
    )
    res = analyze(mk(), jd)
    found = {m.keyword for m in res.missing}
    assert "stakeholder alignment" in found
    assert "supply planning" in found
    # a phrase present in the resume matches
    res2 = analyze(mk(summary="Led stakeholder alignment programmes."), jd)
    assert "stakeholder alignment" in names(res2.matched)


def test_reorder_action_moves_relevant_skills_first() -> None:
    resume = mk(skills=["Photoshop", "Excel", "Python", "Leadership", "Docker"])
    res = analyze(resume, "Requirements:\n- Docker\n- Python\nNice to have:\n- Leadership\n")
    action = next(s.action for s in res.suggestions if s.code == "reorder_skills")
    assert action is not None
    assert action.type == "reorder_skills"
    value = action.value
    assert isinstance(value, list)
    assert sorted(value) == sorted(resume.skills)  # a permutation: nothing added or removed
    assert value[:2] == ["Python", "Docker"]
    assert value[2] == "Leadership"
    assert value[3:] == ["Photoshop", "Excel"]


def test_no_reorder_when_already_ordered_or_irrelevant() -> None:
    res = analyze(mk(skills=["Python", "Docker", "Excel"]), "Requirements:\n- Python\n- Docker\n")
    assert all(s.code != "reorder_skills" for s in res.suggestions)
    res = analyze(mk(skills=["Photoshop", "Figma"]), "We need Terraform.")
    assert all(s.code != "reorder_skills" for s in res.suggestions)


def test_actions_never_fabricate_and_analysis_is_read_only() -> None:
    resume = mk(
        skills=["Excel", "Python"],
        sections=[exp("Engineer", bullets=["Built tools"])],
    )
    snapshot = (list(resume.skills), resume.summary, [list(s.bullets) for s in resume.sections])
    res = analyze(resume, SOFTWARE_JD)
    known = {c.lstrip("=") for _, c, _ in iter_terms()}
    adds = [s for s in res.suggestions if s.action and s.action.type == "add_skill"]
    assert adds
    for s in res.suggestions:
        if s.action is None:
            continue
        assert s.action.type in ("add_skill", "reorder_skills")
        if s.action.type == "add_skill":
            assert isinstance(s.action.value, str)
            assert s.action.value in known
            assert s.section == "skills"
    # low-importance keywords never become one-click actions
    low = {m.keyword for m in res.missing if m.importance == "low"}
    assert low
    assert not low & {s.action.value for s in adds if s.action}
    assert snapshot == (
        list(resume.skills),
        resume.summary,
        [list(s.bullets) for s in resume.sections],
    )


def test_certifications_are_message_only() -> None:
    res = analyze(mk(), "Requirements:\n- PMP certification\n- AWS Certified Solutions Architect\n")
    certs = [s for s in res.suggestions if s.code.startswith("missing_certification")]
    assert certs
    assert all(s.action is None for s in certs)
    assert not [s for s in res.suggestions if s.action and s.action.value == "PMP"]


def test_add_skill_actions_capped_and_respect_skill_limit() -> None:
    jd = "Requirements:\n" + "\n".join(
        f"- {t}"
        for t in (
            "Python Java Ruby PHP Kotlin Scala Perl Rust Lua Elixir Haskell Clojure "
            "Django Flask Laravel Symfony Docker Terraform Ansible Jenkins"
        ).split()
    )
    res = analyze(mk(), jd)
    adds = [s for s in res.suggestions if s.code.startswith("add_skill:")]
    assert len(adds) == tailor_service.MAX_ADD_SKILL_ACTIONS
    full = mk(skills=[f"Skill {i}" for i in range(MAX_SKILLS)])
    res = analyze(full, jd)
    assert not [s for s in res.suggestions if s.code.startswith("add_skill:")]
    near = mk(skills=[f"Skill {i}" for i in range(MAX_SKILLS - 2)])
    res = analyze(near, jd)
    assert len([s for s in res.suggestions if s.code.startswith("add_skill:")]) == 2


def test_suggestions_are_severity_ordered() -> None:
    res = analyze(mk(skills=["Excel"], summary=None), SOFTWARE_JD)
    order = {"high": 0, "medium": 1, "low": 2}
    sev = [order[s.severity] for s in res.suggestions]
    assert sev == sorted(sev)
    assert res.suggestions[0].severity == "high"


def test_summary_suggestions() -> None:
    res = analyze(mk(summary=None), "We need Python.")
    assert any(s.code == "summary_missing" for s in res.suggestions)
    res = analyze(
        mk(summary="Hard-working person who loves variety.", skills=["Python"]),
        "Python Developer\nPython and Django are required. Python daily.",
    )
    sug = next(s for s in res.suggestions if s.code == "summary_keywords")
    assert sug.section == "summary"
    assert "Python" in sug.message
    res = analyze(
        mk(summary="Python developer shipping services.", skills=["Python"]),
        "Python Developer\nPython and Django are required.",
    )
    assert all(s.code != "summary_keywords" for s in res.suggestions)


def test_title_mismatch_message_only() -> None:
    resume = mk(
        summary="Teacher with classroom leadership experience in primary education.",
        sections=[exp("Primary Teacher")],
    )
    res = analyze(resume, "Software Engineer\nWe need Python.")
    sug = next(s for s in res.suggestions if s.code == "title_mismatch")
    assert sug.action is None
    res = analyze(
        mk(sections=[exp("Software Engineer")]),
        "Senior Software Engineer\nWe need Python.",
    )
    assert all(s.code != "title_mismatch" for s in res.suggestions)


def test_quantify_and_demonstrate_suggestions() -> None:
    resume = mk(
        skills=["Python", "Docker", "Terraform"],
        sections=[exp("Engineer", bullets=["Built Python services", "Used Docker for builds"])],
    )
    jd = "Requirements:\n- Python\n- Docker\n- Terraform\n"
    res = analyze(resume, jd)
    q = next(s for s in res.suggestions if s.code == "quantify_achievements")
    assert "Python" in q.message and "Docker" in q.message
    d = next(s for s in res.suggestions if s.code == "demonstrate_skills")
    assert "Terraform" in d.message
    assert "Python" not in d.message
    assert d.action is None
    # numbers present -> no quantify suggestion
    resume2 = mk(
        skills=["Python"],
        sections=[exp("Engineer", bullets=["Built Python services handling 5k rps"])],
    )
    res2 = analyze(resume2, "Requirements:\n- Python\n")
    assert all(s.code != "quantify_achievements" for s in res2.suggestions)


def test_empty_skills_and_low_match_and_no_keywords() -> None:
    res = analyze(mk(skills=[]), SOFTWARE_JD)
    assert any(s.code == "empty_skills" for s in res.suggestions)
    assert res.match_score < 40
    assert any(s.code == "low_match" for s in res.suggestions)
    res = analyze(mk(), "Hello there, welcome aboard!")
    assert res.match_score == 0
    assert [s.code for s in res.suggestions] == ["no_keywords"]
    assert res.matched == []
    assert res.missing == []


@pytest.mark.parametrize(
    ("jd", "expected"),
    [
        ("Job Title: Data Scientist\nWe need SQL.", "Data Scientist"),
        ("Senior Backend Engineer\nAbout us", "Senior Backend Engineer"),
        ("About us\nWe are hiring a Product Designer to join us.", "Product Designer"),
        ("We are a company. We build things. " + "x" * 120, None),
        ("Join our amazing team!\nPosition: QA Lead", "QA Lead"),
    ],
)
def test_infer_job_title(jd: str, expected: str | None) -> None:
    assert infer_job_title(jd) == expected


def test_realistic_software_job() -> None:
    resume = mk(
        skills=["Python", "FastAPI", "Docker", "Kubernetes", "Excel"],
        summary="Backend engineer building scalable APIs and microservices with Python.",
        sections=[
            exp(
                "Senior Backend Engineer",
                bullets=[
                    "Designed FastAPI services on AWS handling 3k requests per second",
                    "Ran code reviews and mentored 4 junior engineers",
                ],
            )
        ],
    )
    res = analyze(resume, SOFTWARE_JD)
    assert res.job_title == "Senior Backend Engineer"
    matched = set(names(res.matched))
    assert {"Python", "FastAPI", "Docker", "Kubernetes", "AWS", "Microservices"} <= matched
    missing = {m.keyword: m.importance for m in res.missing}
    assert missing["PostgreSQL"] == "high"
    assert missing["Terraform"] == "low"
    assert 40 <= res.match_score < 100
    assert res.ats.score >= 0


def test_realistic_non_technical_marketing_job() -> None:
    resume = mk(
        skills=["SEO", "Content Marketing", "Google Analytics", "Copywriting"],
        summary="Digital marketing professional growing audiences through content.",
        sections=[
            exp(
                "Marketing Specialist",
                bullets=["Grew organic traffic 120% with SEO and content marketing"],
            )
        ],
    )
    res = analyze(resume, MARKETING_JD)
    assert res.job_title == "Digital Marketing Manager"
    matched = set(names(res.matched))
    assert {"SEO", "Content Marketing", "Google Analytics", "Copywriting"} <= matched
    missing = {m.keyword: m.importance for m in res.missing}
    assert missing["HubSpot"] == "medium"
    assert missing["Marketo"] == "low"
    assert missing["Salesforce"] == "low"
    assert by_keyword(res.matched, "Copywriting").importance == "high"
    assert 20 < res.match_score < 100
    assert "manager" not in names(res.missing)
    assert all(
        s.action is None or s.action.type in ("add_skill", "reorder_skills")
        for s in res.suggestions
    )


def test_inline_required_prefix_and_non_string_body(
    client: TestClient, auth_headers: Headers, make_resume: MakeResume
) -> None:
    res = analyze(mk(), "Required: Python\nPreferred: Docker\n")
    imp = {m.keyword: m.importance for m in res.missing}
    assert imp == {"Python": "high", "Docker": "low"}
    rid = make_resume(auth_headers)["id"]
    assert tailor(client, auth_headers, rid, {"job_description": 5}).status_code == 422
