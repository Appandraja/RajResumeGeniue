"""Deterministic job-description tailoring: keyword extraction, resume matching, suggestions.

No network and no AI. Keywords come from a curated taxonomy (with aliases) plus frequent
noun-phrase n-grams. The service is read-only and only ever proposes *skills* as actions;
it never invents experience, titles, dates or bullets.
"""

import logging
import re
from dataclasses import dataclass, field
from typing import cast

from app.models.resume import Resume
from app.models.resume_section import SectionType
from app.schemas.resume import MAX_SKILLS, AtsCheckResponse
from app.schemas.tailor import (
    Importance,
    MatchedKeyword,
    MissingKeyword,
    TailorAction,
    TailorResponse,
    TailorSuggestion,
)
from app.services import ats_service
from app.services.skills_taxonomy import CERTIFICATION_CATEGORIES, iter_terms

logger = logging.getLogger(__name__)

MAX_TAXONOMY_KEYWORDS = 60
MAX_PHRASE_KEYWORDS = 15
MAX_ADD_SKILL_ACTIONS = 10
WEIGHTS: dict[str, int] = {"high": 3, "medium": 2, "low": 1}
_SEVERITY_ORDER = {"high": 0, "medium": 1, "low": 2}
_WHERE_ORDER = ("skills", "summary", "experience", "project", "certification", "education")

# ---------------------------------------------------------------- tokenizing

_TOKEN_RE = re.compile(r"\.[A-Za-z][A-Za-z0-9]*|[A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*[+#]*")
_CLAUSE_SPLIT_RE = re.compile(r"[,;:()\[\]{}•·|!?•]|\.(?=\s|$)|\s[-–—]\s|\s{2,}")
_BULLET_PREFIX_RE = re.compile(r"^[\s>*\-•·●▪#\d.)]+")


@dataclass(frozen=True)
class Tok:
    text: str  # original spelling
    key: str  # lower-cased, lightly stemmed


def _stem(word: str) -> str:
    if len(word) > 4 and word.endswith("ies"):
        return word[:-3] + "y"
    if len(word) > 3 and word.endswith("s") and not word.endswith(("ss", "us", "is")):
        return word[:-1]
    return word


def _tokens(text: str) -> list[Tok]:
    return [Tok(m, _stem(m.lower())) for m in _TOKEN_RE.findall(text)]


def _clauses(text: str) -> list[list[Tok]]:
    return [toks for part in _CLAUSE_SPLIT_RE.split(text) if (toks := _tokens(part))]


# ------------------------------------------------------------------ taxonomy


@dataclass(frozen=True)
class _Term:
    canonical: str
    category: str
    case_text: str | None  # when set, the single token must be spelled exactly like this


def _build_index() -> tuple[dict[tuple[str, ...], list[_Term]], int]:
    index: dict[tuple[str, ...], list[_Term]] = {}
    longest = 1
    for category, canonical, aliases in iter_terms():
        display = canonical.lstrip("=")
        for raw in (canonical, *aliases):
            case_sensitive = raw.startswith("=")
            text = raw.lstrip("=")
            toks = _tokens(text)
            key = tuple(t.key for t in toks)
            case_text = toks[0].text if case_sensitive and len(toks) == 1 else None
            bucket = index.setdefault(key, [])
            if all(t.canonical != display for t in bucket):
                bucket.append(_Term(display, category, case_text))
            longest = max(longest, len(key))
    return index, longest


_INDEX, _MAX_TERM_LEN = _build_index()
_CATEGORY: dict[str, str] = {t.canonical: t.category for ts in _INDEX.values() for t in ts}
# Single tokens that must not be read as a case-sensitive term when followed by these words.
_CASE_GUARD: dict[str, frozenset[str]] = {"go": frozenset({"to", "getting", "live"})}


def _lookup(toks: list[Tok], start: int, length: int) -> str | None:
    chunk = toks[start : start + length]
    terms = _INDEX.get(tuple(t.key for t in chunk))
    if not terms:
        return None
    for term in terms:
        if term.case_text is None:
            return term.canonical
        if chunk[0].text == term.case_text:
            following = toks[start + 1].key if start + 1 < len(toks) else ""
            if following not in _CASE_GUARD.get(chunk[0].key, frozenset()):
                return term.canonical
    return None


def _terms_in(toks: list[Tok], consume: bool) -> list[tuple[str, int, int]]:
    """Return (canonical, start, length) matches; longest match first at each position."""
    found: list[tuple[str, int, int]] = []
    i = 0
    while i < len(toks):
        hit: tuple[str, int] | None = None
        for length in range(min(_MAX_TERM_LEN, len(toks) - i), 0, -1):
            canonical = _lookup(toks, i, length)
            if canonical is not None:
                hit = (canonical, length)
                break
        if hit is None:
            i += 1
            continue
        found.append((hit[0], i, hit[1]))
        i += hit[1] if consume else 1
    return found


# ---------------------------------------------------------------- stop words

_STOPWORDS = frozenset(
    """a about above after again all also am an and any are as at be because been before being
    below between both but by can could did do does doing down during each either else etc even
    ever every few for from further had has have having he her here hers him his how i if in
    into is it its just may me might more most must my no nor not of off on once only or other
    our ours out over own per same shall she should so some such than that the their theirs
    them then there these they this those through to too under until up upon us very via was we
    were what when where which while who whom why will with within without would you your yours
    able across along among around etc ie eg e.g i.e""".split()
)

_GENERIC = frozenset(
    """experience experiences year years work working works worked role roles position positions
    job jobs candidate candidates company team teams skill skills ability abilities strong
    excellent good great knowledge understanding looking join opportunity opportunities
    responsibility responsibilities requirement requirements qualification qualifications
    required preferred nice bonus include including includes related relevant similar new
    ensure support help provide providing using use used develop developing demonstrated proven
    highly well best high level well-versed environment environments business organization
    people person individual individuals time day days week weeks month months range based
    various multiple key many make making take taking need needs needed like per part full
    seeking hiring apply applicant applicants degree bachelor master equivalent field
    successful successfully effective effectively ideal ideally minimum plus benefits salary
    offer offers equal employer employment location remote hybrid onsite office benefit
    contribute contributing contribution drive driving passion passionate love want wants
    know knowing able etc one two three four five six seven eight nine ten first second
    great deliver delivering responsible manage managing within across including manager
    engineer developer specialist analyst director coordinator associate executive officer
    """.split()
)

_MIN_PHRASE_SINGLE_LEN = 4

# ----------------------------------------------------------- context detection

_REQUIRED_HEADER_RE = re.compile(
    r"\b(requirements?|required|must[- ]haves?|qualifications?|minimum|essential|"
    r"what you(?:'|’)?ll need|what we(?:'|’)?re looking for|what you bring|"
    r"you have|you bring|who you are|about you|skills? (?:and|&) experience)\b",
    re.IGNORECASE,
)
_NICE_HEADER_RE = re.compile(
    r"\b(nice[- ]to[- ]haves?|preferred|bonus|desirable|good to have|a plus|extra credit|"
    r"ideally|optional|would be great)\b",
    re.IGNORECASE,
)
_NEUTRAL_HEADER_RE = re.compile(
    r"\b(responsibilit\w+|about (?:us|the)|who we are|what you(?:'|’)?ll do|"
    r"what you will do|benefits|perks|we offer|why join|our (?:team|mission)|the role|"
    r"overview|how to apply|compensation)\b",
    re.IGNORECASE,
)
_REQUIRED_CUE_RE = re.compile(r"\b(required|must|mandatory|essential|minimum|need to have)\b", re.I)
_NICE_CUE_RE = re.compile(
    r"\b(nice to have|nice-to-have|preferred|bonus|a plus|is a plus|are a plus|desirable|"
    r"good to have|ideally|optional|advantage|an asset|beneficial)\b",
    re.IGNORECASE,
)
_TITLE_PREFIX_RE = re.compile(
    r"^\s*(?:job\s*title|position|role|title|vacancy|opening)\s*[:\-]\s*", re.IGNORECASE
)
_HIRING_RE = re.compile(
    r"\b(?:looking for|seeking|hiring|searching for)\s+(?:an?|the)?\s*"
    r"([A-Z][A-Za-z0-9/&+#.\- ]{2,60}?)(?=\s+(?:to|who|with|that|for|in|at)\b|[.,;:\n]|$)"
)
_LEVEL_WORDS = frozenset(
    "senior junior jr sr lead principal staff associate intern entry level head chief i ii iii "
    "iv mid midlevel".split()
)
_HAS_DIGIT_RE = re.compile(r"\d")

Ctx = str | None  # "high" | "low" | None


def _line_context(
    line: str, state: Ctx
) -> tuple[Ctx, Ctx, bool]:  # (new state, line-level ctx, is_header)
    """Classify a JD line. Returns (section state after line, ctx for the line, is_header)."""
    plain = _BULLET_PREFIX_RE.sub("", line).strip().strip("*_#: ")
    is_short = 0 < len(plain) <= 70 and len(plain.split()) <= 9
    ends_sentence = plain.endswith((".", "!", "?"))
    if (
        is_short
        and not ends_sentence
        and (line.rstrip().endswith(":") or len(plain.split()) <= 6)
        and not _terms_in(_tokens(plain), consume=True)
    ):
        if _NICE_HEADER_RE.search(plain):
            return "low", "low", True
        if _REQUIRED_HEADER_RE.search(plain):
            return "high", "high", True
        if _NEUTRAL_HEADER_RE.search(plain):
            return None, None, True
    # "Nice to have: X, Y" / "Required: X" at the start of a content line.
    lead = plain.split(":", 1)[0] if ":" in plain[:40] else ""
    if lead:
        if _NICE_HEADER_RE.search(lead):
            return state, "low", False
        if _REQUIRED_HEADER_RE.search(lead) or _REQUIRED_CUE_RE.search(lead):
            return state, "high", False
    return state, state, False


def _clause_context(clause_text: str, line_ctx: Ctx) -> Ctx:
    if _NICE_CUE_RE.search(clause_text):
        return "low"
    if _REQUIRED_CUE_RE.search(clause_text):
        return "high"
    return line_ctx


# --------------------------------------------------------------- JD analysis


@dataclass
class _Keyword:
    name: str
    key: tuple[str, ...]
    taxonomy: bool
    category: str | None = None
    ctxs: list[Ctx] = field(default_factory=list)
    in_title: bool = False

    @property
    def count(self) -> int:
        return len(self.ctxs)

    @property
    def importance(self) -> Importance:
        if self.in_title or self.count >= 3 or "high" in self.ctxs:
            return "high"
        if self.ctxs and all(c == "low" for c in self.ctxs):
            return "low"
        return "medium"


def _taxonomy_key(name: str) -> tuple[str, ...]:
    return ("tax", name)


def infer_job_title(job_description: str) -> str | None:
    """Best-effort title from the first lines of a job description, else None."""
    lines = [ln.strip() for ln in job_description.splitlines() if ln.strip()]
    for line in lines[:12]:
        match = _TITLE_PREFIX_RE.match(line)
        if match:
            candidate = line[match.end() :].strip(" *#_")
            if 2 <= len(candidate) <= 100:
                return candidate
    hiring = _HIRING_RE.search(job_description[:1500])
    if hiring:
        return hiring.group(1).strip()
    if lines:
        first = lines[0].strip(" *#_")
        words = first.split()
        if (
            2 <= len(first) <= 80
            and len(words) <= 10
            and not first.endswith((".", ":", "!", "?"))
            and not re.match(r"^(about|we |we'|our |at |join |the )", first, re.IGNORECASE)
        ):
            return first
    return None


def _extract_keywords(job_description: str, title: str | None) -> list[_Keyword]:
    taxonomy: dict[str, _Keyword] = {}
    phrases: dict[tuple[str, ...], _Keyword] = {}

    title_canon: set[str] = set()
    title_grams: set[tuple[str, ...]] = set()
    if title:
        for toks in _clauses(title):
            title_canon.update(c for c, _, _ in _terms_in(toks, consume=False))
            title_grams.update(_ngrams(toks, 3))

    state: Ctx = None
    for raw_line in job_description.splitlines():
        if not raw_line.strip():
            continue
        state, line_ctx, is_header = _line_context(raw_line, state)
        if is_header:
            continue
        for part in _CLAUSE_SPLIT_RE.split(raw_line):
            toks = _tokens(part)
            if not toks:
                continue
            ctx = _clause_context(part, line_ctx)
            consumed = [False] * len(toks)
            for canonical, start, length in _terms_in(toks, consume=True):
                kw = taxonomy.get(canonical)
                if kw is None:
                    kw = _Keyword(
                        canonical,
                        _taxonomy_key(canonical),
                        True,
                        _CATEGORY.get(canonical),
                        in_title=canonical in title_canon,
                    )
                    taxonomy[canonical] = kw
                kw.ctxs.append(ctx)
                for j in range(start, start + length):
                    consumed[j] = True
            _collect_phrases(toks, consumed, ctx, phrases, title_grams)

    keywords = _select_phrases(phrases)
    tax_sorted = sorted(
        taxonomy.values(),
        key=lambda k: (_SEVERITY_ORDER[k.importance], -k.count, k.name.lower()),
    )[:MAX_TAXONOMY_KEYWORDS]
    return tax_sorted + keywords


def _ngrams(toks: list[Tok], max_n: int) -> set[tuple[str, ...]]:
    keys = [t.key for t in toks]
    return {tuple(keys[i : i + n]) for n in range(1, max_n + 1) for i in range(len(keys) - n + 1)}


def _usable(tok: Tok) -> bool:
    return (
        tok.key not in _STOPWORDS
        and tok.key not in _GENERIC
        and len(tok.key) >= 2
        and not tok.key[0].isdigit()
    )


def _collect_phrases(
    toks: list[Tok],
    consumed: list[bool],
    ctx: Ctx,
    phrases: dict[tuple[str, ...], _Keyword],
    title_grams: set[tuple[str, ...]],
) -> None:
    run: list[Tok] = []

    def flush() -> None:
        for n in (1, 2, 3):
            for i in range(len(run) - n + 1):
                gram = run[i : i + n]
                key = tuple(t.key for t in gram)
                if n == 1 and len(key[0]) < _MIN_PHRASE_SINGLE_LEN:
                    continue
                kw = phrases.get(key)
                if kw is None:
                    kw = _Keyword(" ".join(t.text.lower() for t in gram), key, False)
                    kw.in_title = key in title_grams
                    phrases[key] = kw
                kw.ctxs.append(ctx)
        run.clear()

    for tok, used in zip(toks, consumed, strict=True):
        if used or not _usable(tok):
            flush()
        else:
            run.append(tok)
    flush()


def _select_phrases(phrases: dict[tuple[str, ...], _Keyword]) -> list[_Keyword]:
    candidates = {k: v for k, v in phrases.items() if v.count >= 2}
    kept: list[_Keyword] = []
    for key, kw in candidates.items():
        dominated = any(
            len(other) > len(key)
            and other_kw.count >= kw.count
            and any(other[i : i + len(key)] == key for i in range(len(other) - len(key) + 1))
            for other, other_kw in candidates.items()
        )
        if not dominated:
            kept.append(kw)
    kept.sort(key=lambda k: (-k.count, -len(k.key), k.name))
    return kept[:MAX_PHRASE_KEYWORDS]


# ------------------------------------------------------------- resume analysis


@dataclass
class _Area:
    canon: set[str] = field(default_factory=set)
    grams: set[tuple[str, ...]] = field(default_factory=set)
    texts: list[str] = field(default_factory=list)

    def add(self, text: str) -> None:
        if not text.strip():
            return
        self.texts.append(text)
        for toks in _clauses(text):
            self.canon.update(c for c, _, _ in _terms_in(toks, consume=False))
            self.grams.update(_ngrams(toks, 3))

    def has(self, kw: _Keyword) -> bool:
        if kw.taxonomy:
            return kw.name in self.canon
        return kw.key in self.grams


def _resume_areas(resume: Resume) -> dict[str, _Area]:
    areas: dict[str, _Area] = {}

    def area(name: str) -> _Area:
        return areas.setdefault(name, _Area())

    for skill in cast(list[str] | None, resume.skills) or []:
        area("skills").add(skill)
    area("summary").add(cast(str | None, resume.summary) or "")
    for sec in resume.sections:
        target = area(sec.type.value if isinstance(sec.type, SectionType) else str(sec.type))
        target.add(cast(str, sec.title))
        target.add(cast(str | None, sec.organization) or "")
        for bullet in cast(list[str] | None, sec.bullets) or []:
            target.add(bullet)
    return areas


def _where(kw: _Keyword, areas: dict[str, _Area]) -> list[str]:
    return [name for name in _WHERE_ORDER if name in areas and areas[name].has(kw)]


def _skill_rank(skill: str, keywords: list[_Keyword]) -> int:
    probe = _Area()
    probe.add(skill)
    best = 3
    for kw in keywords:
        if probe.has(kw):
            best = min(best, _SEVERITY_ORDER[kw.importance])
    return best


# ----------------------------------------------------------------- suggestions

_ADD_HINT = (
    "If you have used {kw}, add it to your skills or mention it in a relevant bullet. "
    "Only add skills you actually have."
)


def _join(names: list[str]) -> str:
    return ", ".join(names)


def _core_title_keys(title: str) -> set[str]:
    return {t.key for t in _tokens(title) if t.key not in _LEVEL_WORDS and _usable(t)}


def _build_suggestions(
    resume: Resume,
    keywords: list[_Keyword],
    where: dict[str, list[str]],
    areas: dict[str, _Area],
    score: int,
    title: str | None,
) -> list[TailorSuggestion]:
    out: list[TailorSuggestion] = []
    skills = [s for s in (cast(list[str] | None, resume.skills) or [])]
    missing = [k for k in keywords if not where[k.name]]
    matched = [k for k in keywords if where[k.name]]

    if not keywords:
        out.append(
            TailorSuggestion(
                code="no_keywords",
                severity="low",
                section=None,
                message=(
                    "We could not detect specific skills or repeated terms in this job "
                    "description. Paste the full posting, including the requirements, for a "
                    "useful comparison."
                ),
            )
        )
        return out

    if score < 40 and len(keywords) >= 3:
        out.append(
            TailorSuggestion(
                code="low_match",
                severity="high",
                section=None,
                message=(
                    f"Your resume covers only {score}% of this job's keywords. Review the "
                    "missing list and add only what reflects your real experience, or consider "
                    "whether this role is a fit."
                ),
            )
        )

    # add_skill actions: skills only, never certifications, and user-approved.
    room = max(0, MAX_SKILLS - len(skills))
    existing = {s.casefold() for s in skills}
    adds = [
        k
        for k in missing
        if k.taxonomy
        and k.category not in CERTIFICATION_CATEGORIES
        and k.importance in ("high", "medium")
        and k.name.casefold() not in existing
    ][: min(MAX_ADD_SKILL_ACTIONS, room)]
    for kw in adds:
        out.append(
            TailorSuggestion(
                code=f"add_skill:{kw.name}",
                severity=kw.importance,
                section="skills",
                message=(
                    f'The job asks for "{kw.name}", which is not on your resume. '
                    "Add it only if you genuinely have this skill."
                ),
                action=TailorAction(type="add_skill", value=kw.name),
            )
        )

    for kw in missing:
        if kw.taxonomy and kw.category in CERTIFICATION_CATEGORIES and kw.importance != "low":
            out.append(
                TailorSuggestion(
                    code=f"missing_certification:{kw.name}",
                    severity=kw.importance,
                    section="certifications",
                    message=(
                        f'The job mentions "{kw.name}". List it only if you actually hold '
                        "this credential."
                    ),
                )
            )

    # reorder_skills: relevant skills first, original relative order otherwise.
    if skills:
        ranks = [(_skill_rank(s, keywords), i, s) for i, s in enumerate(skills)]
        if any(r < 3 for r, _, _ in ranks):
            reordered = [s for _, _, s in sorted(ranks)]
            if reordered != skills:
                out.append(
                    TailorSuggestion(
                        code="reorder_skills",
                        severity="low",
                        section="skills",
                        message=(
                            "Move the skills this job asks for to the front of your skills "
                            "list so they are seen first. Nothing is added or removed."
                        ),
                        action=TailorAction(type="reorder_skills", value=reordered),
                    )
                )
    else:
        out.append(
            TailorSuggestion(
                code="empty_skills",
                severity="medium",
                section="skills",
                message="Add a skills section listing the tools and skills you really use.",
            )
        )

    # Summary alignment.
    summary_area = areas.get("summary")
    top_matched = [k for k in matched if k.importance != "low"][:5]
    title_keys = _core_title_keys(title) if title else set()
    if summary_area is None or not summary_area.texts:
        out.append(
            TailorSuggestion(
                code="summary_missing",
                severity="medium",
                section="summary",
                message=(
                    "Add a short summary that names the kind of role you are targeting and "
                    "the strengths you genuinely have for it."
                ),
            )
        )
    else:
        summary_keys = {g[0] for g in summary_area.grams if len(g) == 1}
        has_title = bool(title_keys & summary_keys)
        has_keyword = any(summary_area.has(k) for k in matched)
        if not has_title and not has_keyword:
            hint = (
                " Strengths you already have that the job values: "
                f"{_join([k.name for k in top_matched[:3]])}."
                if top_matched
                else ""
            )
            target = f' ("{title}")' if title else ""
            out.append(
                TailorSuggestion(
                    code="summary_keywords",
                    severity="medium",
                    section="summary",
                    message=(
                        f"Your summary does not mention the target role{target} or this job's "
                        f"top keywords. Reword it truthfully to reflect them.{hint}"
                    ),
                )
            )

    # Title mismatch against real experience titles.
    if title_keys:
        pool: set[str] = set()
        if summary_area is not None:
            pool.update(g[0] for g in summary_area.grams if len(g) == 1)
        for sec in resume.sections:
            if sec.type == SectionType.experience:
                pool.update(t.key for t in _tokens(cast(str, sec.title)))
        if len(title_keys & pool) / len(title_keys) < 0.5:
            out.append(
                TailorSuggestion(
                    code="title_mismatch",
                    severity="medium",
                    section="experience",
                    message=(
                        f'The target title "{title}" differs from the titles in your '
                        "experience. Keep your real titles; instead make clear in your "
                        "summary which role you are targeting and which of your experience "
                        "transfers."
                    ),
                )
            )

    # Quantified achievements for the top required skills.
    bullets = [
        b
        for sec in resume.sections
        if sec.type in (SectionType.experience, SectionType.project)
        for b in (cast(list[str] | None, sec.bullets) or [])
        if b.strip()
    ]
    unquantified: list[str] = []
    for kw in [k for k in matched if k.importance == "high"][:5]:
        mentioning = []
        for b in bullets:
            probe = _Area()
            probe.add(b)
            if probe.has(kw):
                mentioning.append(b)
        if mentioning and not any(_HAS_DIGIT_RE.search(b) for b in mentioning):
            unquantified.append(kw.name)
    if unquantified:
        out.append(
            TailorSuggestion(
                code="quantify_achievements",
                severity="medium",
                section="experience",
                message=(
                    f"Bullets mentioning {_join(unquantified[:3])} have no numbers. Add real, "
                    "measurable results (percentages, volumes, time saved) where you have them."
                ),
            )
        )

    # Keywords listed in skills but never shown in experience/projects.
    undemonstrated = [
        k
        for k in matched
        if where[k.name] == ["skills"]
        and k.importance in ("high", "medium")
        and k.category not in CERTIFICATION_CATEGORIES
    ]
    if undemonstrated:
        severity: Importance = (
            "medium" if any(k.importance == "high" for k in undemonstrated) else "low"
        )
        out.append(
            TailorSuggestion(
                code="demonstrate_skills",
                severity=severity,
                section="experience",
                message=(
                    "Listed only under skills, with no supporting experience: "
                    f"{_join([k.name for k in undemonstrated[:5]])}. If true, add a bullet "
                    "that shows how you used them."
                ),
            )
        )

    out.sort(key=lambda s: _SEVERITY_ORDER[s.severity])
    return out


# ------------------------------------------------------------------- facade


def analyze(resume: Resume, job_description: str, job_title: str | None = None) -> TailorResponse:
    """Compare a resume against a job description. Pure and read-only."""
    title = job_title.strip() if job_title and job_title.strip() else None
    title = title or infer_job_title(job_description)
    keywords = _extract_keywords(job_description, title)
    areas = _resume_areas(resume)
    where = {k.name: _where(k, areas) for k in keywords}

    total = sum(WEIGHTS[k.importance] for k in keywords)
    got = sum(WEIGHTS[k.importance] for k in keywords if where[k.name])
    score = max(0, min(100, round(100 * got / total))) if total else 0

    order = {"high": 0, "medium": 1, "low": 2}
    ranked = sorted(keywords, key=lambda k: (order[k.importance], -k.count, k.name.lower()))
    matched = [
        MatchedKeyword(keyword=k.name, importance=k.importance, where=where[k.name])
        for k in ranked
        if where[k.name]
    ]
    missing = [
        MissingKeyword(
            keyword=k.name, importance=k.importance, suggestion=_ADD_HINT.format(kw=k.name)
        )
        for k in ranked
        if not where[k.name]
    ]
    suggestions = _build_suggestions(resume, keywords, where, areas, score, title)
    ats: AtsCheckResponse = ats_service.evaluate_resume(resume)
    logger.info("Tailor analysis for resume %s: score %s", resume.id, score)
    return TailorResponse(
        match_score=score,
        job_title=title,
        matched=matched,
        missing=missing,
        suggestions=suggestions,
        ats=ats,
    )
