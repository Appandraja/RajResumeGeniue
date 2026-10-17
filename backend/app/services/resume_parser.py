"""Heuristic, deterministic resume text parser (no network, no AI).

`parse_resume` turns plain text into an `ImportedDraft` plus human readable warnings.
Original wording is kept; nothing is invented. Anything uncertain produces a warning.
"""

import logging
import posixpath
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Final
from urllib.parse import urlparse

from app.schemas.importer import ImportedDraft, ImportedSection

logger = logging.getLogger(__name__)

# Limits mirror app/schemas/resume.py so an imported draft can be saved as-is.
MAX_SECTIONS: Final = 20
MAX_BULLETS: Final = 15
MAX_BULLET_LENGTH: Final = 500
MAX_SKILLS: Final = 50
MAX_SKILL_LENGTH: Final = 60
MAX_SUMMARY: Final = 3000
MAX_TITLE: Final = 200
MAX_ORG: Final = 200
MAX_LOCATION: Final = 150
MAX_NAME: Final = 100
MAX_URL: Final = 500
_MAX_LINE: Final = 1000

# --------------------------------------------------------------- headings
_HEADING_SYNONYMS: Final[dict[str, tuple[str, ...]]] = {
    "summary": (
        "summary",
        "professional summary",
        "executive summary",
        "career summary",
        "summary of qualifications",
        "profile",
        "professional profile",
        "personal profile",
        "about",
        "about me",
        "objective",
        "career objective",
        "professional objective",
        "personal statement",
        "overview",
    ),
    "experience": (
        "experience",
        "work experience",
        "professional experience",
        "relevant experience",
        "employment",
        "employment history",
        "work history",
        "career history",
        "professional background",
        "internships",
        "internship",
    ),
    "education": (
        "education",
        "academic",
        "academics",
        "academic background",
        "educational background",
        "education and training",
        "academic qualifications",
    ),
    "project": (
        "projects",
        "project",
        "personal projects",
        "selected projects",
        "key projects",
        "academic projects",
        "side projects",
        "notable projects",
    ),
    "certification": (
        "certifications",
        "certification",
        "certificates",
        "licenses",
        "licences",
        "licenses and certifications",
        "certifications and licenses",
        "licenses and certificates",
        "courses and certifications",
        "professional certifications",
    ),
    "skills": (
        "skills",
        "technical skills",
        "core competencies",
        "key skills",
        "core skills",
        "skills and tools",
        "tools and technologies",
        "technologies",
        "competencies",
        "areas of expertise",
        "expertise",
        "technical proficiencies",
        "skills and abilities",
        "skills summary",
    ),
    "other": (
        "languages",
        "interests",
        "hobbies",
        "hobbies and interests",
        "references",
        "awards",
        "honors",
        "honors and awards",
        "achievements",
        "publications",
        "volunteer",
        "volunteering",
        "volunteer experience",
        "activities",
        "extracurricular activities",
        "additional information",
        "personal details",
        "declaration",
        "training",
    ),
}
_HEADINGS: Final[dict[str, str]] = {
    synonym: kind for kind, synonyms in _HEADING_SYNONYMS.items() for synonym in synonyms
}
_HEADING_STRIP_RE: Final = re.compile(r"^[\s\-–—=*_#•|:.]+|[\s\-–—=*_#|:.]+$")
_NON_LETTER_RE: Final = re.compile(r"[^a-z ]+")
_PAGE_NUMBER_RE: Final = re.compile(r"^(?:page\s*)?\d{1,3}(?:\s*(?:of|/)\s*\d{1,3})?$", re.I)

_SECTION_LABEL: Final[dict[str, str]] = {
    "experience": "Experience",
    "education": "Education",
    "project": "Project",
    "certification": "Certification",
}

# ------------------------------------------------------------ contact info
_EMAIL_RE: Final = re.compile(
    r"[A-Za-z0-9._%+\-]{1,64}@[A-Za-z0-9\-]{1,63}(?:\.[A-Za-z0-9\-]{1,63}){0,5}\.[A-Za-z]{2,24}"
)
_PHONE_RE: Final = re.compile(r"(?<![\w/])(\+?\(?\d[\d\s().\-]{5,24}\d)(?![\w/])")
_LINKEDIN_RE: Final = re.compile(
    r"(?:https?://)?(?:[a-z]{2,3}\.)?linkedin\.com/(?:in|pub|company)/[\w\-%.]+/?", re.I
)
_URL_RE: Final = re.compile(
    r"(?:https?://|www\.)[^\s<>\"'|,;]+"
    r"|\b[a-z0-9][a-z0-9\-]{0,62}(?:\.[a-z0-9\-]{1,63}){0,5}\.(?:com|io|dev|me|net|org|co|app|tech|ai|xyz|in|uk|de|so)"
    r"(?:/[^\s<>\"'|,;]*)?(?![\w@])"
)
_LABEL_RE: Final = re.compile(
    r"\b(?:email|e-mail|phone|tel|telephone|mobile|cell|linkedin|github|website|web|portfolio|"
    r"address|location|url)\s*:?\s*",
    re.I,
)
_LOCATION_LABEL_RE: Final = re.compile(r"^(?:location|address|based in|city)\s*:\s*(.+)$", re.I)
_RESUME_WORD_RE: Final = re.compile(
    r"\b(?:resume|résumé|curriculum|vitae|cv|profile|contact|summary|portfolio)\b", re.I
)

_TITLE_WORDS: Final = frozenset(
    "engineer developer manager analyst designer consultant intern lead director specialist "
    "architect officer administrator associate assistant scientist coordinator head president "
    "founder programmer technician researcher editor writer teacher tutor vp cto ceo cfo coo "
    "supervisor representative executive owner partner freelancer contractor trainee clerk "
    "accountant nurse".split()
)
_ORG_WORDS: Final = frozenset(
    "inc inc. llc ltd ltd. corp corp. corporation company co. gmbh ag plc technologies "
    "technology solutions labs lab group bank systems software consulting services "
    "partners studio agency university college institute school academy foundation "
    "hospital".split()
)
_SCHOOL_WORDS: Final = frozenset(
    "university college institute school academy universidad universität universite "
    "polytechnic faculty".split()
)
_DEGREE_RE: Final = re.compile(
    r"\b(?:bachelor|master|doctor|phd|ph\.d|b\.?sc|m\.?sc|b\.?a|m\.?a|b\.?eng|m\.?eng|b\.?tech|"
    r"m\.?tech|mba|diploma|degree|associate|certificate|b\.?s|m\.?s|bca|mca|bba|llb|"
    r"high school|a-levels?|baccalaureate|abitur)\b",
    re.I,
)

# ------------------------------------------------------------------- dates
_MONTH: Final = (
    r"(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|"
    r"sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)"
)
_YEAR: Final = r"(?:19|20)\d{2}"
_PRESENT: Final = (
    r"(?:present|currently|current|now|ongoing|today|till\s+date|to\s+date|till\s+now)"
)
_DATE: Final = (
    rf"(?:{_MONTH}\.?,?\s*{_YEAR}"
    rf"|(?:0?[1-9]|1[0-2])\s?[/.\-]\s?{_YEAR}"
    rf"|{_YEAR}[/.\-](?:0?[1-9]|1[0-2])(?!\d)"
    rf"|{_YEAR})"
)
_RANGE_RE: Final = re.compile(
    rf"(?<![\w/])(?P<s>{_DATE})\s*(?:-|–|—|~|to|until|through|till)\s*"
    rf"(?P<e>{_DATE}|{_PRESENT})(?![\w/])",
    re.I,
)
_SINGLE_DATE_RE: Final = re.compile(rf"(?<![\w/])(?P<d>{_DATE})(?![\w/])", re.I)
_PRESENT_RE: Final = re.compile(rf"^{_PRESENT}$", re.I)
_MONTH_NUMBERS: Final = {
    "jan": 1,
    "feb": 2,
    "mar": 3,
    "apr": 4,
    "may": 5,
    "jun": 6,
    "jul": 7,
    "aug": 8,
    "sep": 9,
    "oct": 10,
    "nov": 11,
    "dec": 12,
}
_DATE_LABEL_RE: Final = re.compile(
    r"^(?:expected|graduated|graduation|issued|since|from|date|dates|obtained|completed)$", re.I
)

# ----------------------------------------------------------------- bullets
_BULLET_RE: Final = re.compile(
    r"^\s*(?:[•●▪■◦○·‣⁃▶►]\s*|[-*+–—>]\s+|[-*](?=[A-Za-z0-9])|\d{1,2}[.)]\s+)(?P<t>\S.*)$"
)
_SEPARATOR_RE: Final = re.compile(r"\s+[|•·–—]\s+|\s+-\s+|\s*\|\s*|\s{3,}| @ |\s+at\s+")
_SKILL_LABEL_RE: Final = re.compile(r"^[A-Za-z][A-Za-z &/+#.\-]{1,35}:\s*(?P<rest>\S.*)$")
_TRAILING_CONT_WORDS: Final = frozenset(
    "and or of to with for in by the a an on at as from using via into".split()
)


@dataclass
class _DateRange:
    start: date | None
    end: date | None
    present: bool = False
    single: bool = False


@dataclass
class _Entry:
    header: list[str] = field(default_factory=list)
    dates: _DateRange | None = None
    date_first: bool = False
    bullets: list[str] = field(default_factory=list)


@dataclass
class _Block:
    kind: str
    title: str
    lines: list[str]


# ---------------------------------------------------------------- helpers
def _clean(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _normalise_heading(text: str) -> str:
    stripped = _HEADING_STRIP_RE.sub("", text).lower().replace("&", " and ")
    return _clean(_NON_LETTER_RE.sub(" ", stripped))


def _heading_kind(line: str) -> str | None:
    text = line.strip()
    if not text or len(text) > 45:
        return None
    return _HEADINGS.get(_normalise_heading(text))


def _inline_heading(line: str, current: str | None) -> tuple[str, str, str] | None:
    """Detect 'Skills: Python, Go' style headings: returns (kind, title, remainder)."""
    label, sep, rest = line.partition(":")
    if not sep or not rest.strip() or len(label) > 35:
        return None
    kind = _HEADINGS.get(_normalise_heading(label))
    if kind is None:
        return None
    if kind == "other" and current == "skills":
        return None  # e.g. "Languages: Python, Go" inside a skills section
    return kind, label.strip(), rest.strip()


def _words(text: str) -> list[str]:
    return re.findall(r"[^\W\d_][\w'’.\-]*", text.lower())


def _has_title_word(text: str) -> bool:
    return any(w.strip(".") in _TITLE_WORDS for w in _words(text))


def _has_org_word(text: str) -> bool:
    return any(w in _ORG_WORDS or w.strip(".") in _ORG_WORDS for w in _words(text))


def _looks_like_location(text: str) -> bool:
    value = text.strip()
    if not value or len(value) > 60 or any(ch.isdigit() for ch in value):
        return False
    if re.match(r"^(?:remote|hybrid|on[- ]?site|worldwide)\b", value, re.I):
        return True
    parts = [p.strip() for p in value.split(",")]
    if not 2 <= len(parts) <= 3 or not all(parts):
        return False
    if _has_title_word(value) or _has_org_word(value):
        return False
    return all(p[0].isupper() and len(p.split()) <= 3 for p in parts)


def _truncate(text: str, limit: int) -> tuple[str, bool]:
    if len(text) <= limit:
        return text, False
    cut = text[: limit - 1]
    space = cut.rfind(" ")
    if space > limit * 0.6:
        cut = cut[:space]
    return cut.rstrip(" ,;:-") + "…", True


def _http_url(raw: str) -> str | None:
    value = raw.strip().rstrip(".,;:)]}")
    if not value:
        return None
    if not re.match(r"^https?://", value, re.I):
        value = "https://" + re.sub(r"^//", "", value)
    parsed = urlparse(value)
    if parsed.scheme.lower() not in ("http", "https") or not parsed.netloc or " " in value:
        return None
    if "." not in parsed.netloc or len(value) > MAX_URL:
        return None
    return value


# -------------------------------------------------------------------- dates
def _to_date(token: str) -> date | None:
    text = token.strip().lower().rstrip(".,")
    try:
        match = re.match(rf"^({_MONTH})\.?,?\s*({_YEAR})$", text)
        if match:
            return date(int(match.group(2)), _MONTH_NUMBERS[match.group(1)[:3]], 1)
        match = re.match(rf"^(\d{{1,2}})\s?[/.\-]\s?({_YEAR})$", text)
        if match:
            return date(int(match.group(2)), int(match.group(1)), 1)
        match = re.match(rf"^({_YEAR})[/.\-](\d{{1,2}})$", text)
        if match:
            return date(int(match.group(1)), int(match.group(2)), 1)
        if re.match(rf"^{_YEAR}$", text):
            return date(int(text), 1, 1)
    except ValueError:
        return None
    return None


def _find_range(line: str) -> tuple[_DateRange, int, int] | None:
    match = _RANGE_RE.search(line)
    if match is None:
        return None
    start = _to_date(match.group("s"))
    end_token = match.group("e").strip()
    if start is None:
        return None
    if _PRESENT_RE.match(end_token):
        return _DateRange(start, None, present=True), match.start(), match.end()
    end = _to_date(end_token)
    if end is None:
        return None
    return _DateRange(start, end), match.start(), match.end()


def _find_single(line: str) -> tuple[_DateRange, int, int] | None:
    match = _SINGLE_DATE_RE.search(line)
    if match is None:
        return None
    value = _to_date(match.group("d"))
    if value is None:
        return None
    return _DateRange(None, value, single=True), match.start(), match.end()


def _remove_span(line: str, start: int, end: int) -> str:
    rest = f"{line[:start]} {line[end:]}"
    rest = re.sub(r"[(\[]\s*[)\]]", " ", rest)
    rest = re.sub(r"^[\s|,;:\-–—()\[\]]+|[\s|,;:\-–—()\[\]]+$", "", rest)
    rest = _clean(rest)
    return "" if _DATE_LABEL_RE.match(rest) else rest


# ------------------------------------------------------------ header block
def _strip_contacts(line: str) -> str:
    stripped = _EMAIL_RE.sub(" ", line)
    stripped = _LINKEDIN_RE.sub(" ", stripped)
    stripped = _URL_RE.sub(" ", stripped)
    stripped = _PHONE_RE.sub(" ", stripped)
    return _LABEL_RE.sub(" ", stripped)


def _find_phone(lines: list[str]) -> str | None:
    for line in lines:
        cleaned = _EMAIL_RE.sub(" ", line)
        cleaned = _URL_RE.sub(" ", cleaned)
        for match in _PHONE_RE.finditer(cleaned):
            candidate = _clean(match.group(1))
            digits = sum(ch.isdigit() for ch in candidate)
            if not 7 <= digits <= 15 or re.match(rf"^{_YEAR}\s*[-–—]\s*{_YEAR}$", candidate):
                continue
            if re.fullmatch(rf"(?:{_YEAR}\s*[-–—.]?\s*)+", candidate):
                continue
            return candidate
    return None


def _find_email(lines: list[str]) -> str | None:
    for line in lines:
        match = _EMAIL_RE.search(line)
        if match:
            return match.group(0).rstrip(".")
    return None


def _valid_email(value: str) -> bool:
    try:
        from email_validator import EmailNotValidError, validate_email
    except ImportError:  # pragma: no cover - dependency of pydantic[email]
        return True
    try:
        validate_email(value, check_deliverability=False)
    except EmailNotValidError:
        return False
    return True


def _find_urls(lines: list[str]) -> tuple[str | None, str | None]:
    linkedin: str | None = None
    website: str | None = None
    for line in lines:
        no_email = _EMAIL_RE.sub(" ", line)
        if linkedin is None:
            match = _LINKEDIN_RE.search(no_email)
            if match:
                linkedin = _http_url(match.group(0))
        without_linkedin = _LINKEDIN_RE.sub(" ", no_email)
        if website is None:
            for url_match in _URL_RE.finditer(without_linkedin):
                candidate = url_match.group(0)
                bare = not re.match(r"^(?:https?://|www\.)", candidate, re.I)
                if bare and candidate != candidate.lower():
                    continue  # "ASP.NET", "Node.JS" and friends
                website = _http_url(candidate)
                if website:
                    break
    return linkedin, website


def _name_candidates(line: str) -> list[str]:
    stripped = _strip_contacts(line)
    pieces = re.split(r"\s*[|•·;]\s*|\s+[-–—]\s+|\s{3,}", stripped)
    return [_clean(p) for p in pieces if _clean(p)]


def _plausible_name(text: str) -> bool:
    if not text or len(text) > 60 or any(ch.isdigit() for ch in text):
        return False
    if text.endswith(":") or _RESUME_WORD_RE.search(text) or _has_title_word(text):
        return False
    if _has_org_word(text):
        return False
    words = text.replace(",", " ").split()
    if not 1 <= len(words) <= 5:
        return False
    return all(any(ch.isalpha() for ch in w) for w in words)


def _parse_header(lines: list[str], warnings: list[str]) -> tuple[str | None, str | None]:
    """Return (full_name, location) from the lines before the first section heading."""
    name: str | None = None
    name_line = -1
    nonblank = [(i, line) for i, line in enumerate(lines) if line.strip()]
    for rank, (index, line) in enumerate(nonblank[:6]):
        for candidate in _name_candidates(line):
            if _plausible_name(candidate):
                name = candidate
                name_line = index
                if rank > 0:
                    warnings.append(
                        "The full name was guessed from the top of the document; please verify it."
                    )
                break
        if name:
            break
    if name is None:
        warnings.append("Could not determine the full name; please enter it manually.")

    location: str | None = None
    for index, line in nonblank:
        if index == name_line:
            continue
        labelled = _LOCATION_LABEL_RE.match(line.strip())
        if labelled:
            location = _clean(labelled.group(1).split("|")[0])
            break
        had_contact = bool(_EMAIL_RE.search(line) or _PHONE_RE.search(line) or _URL_RE.search(line))
        for piece in _name_candidates(line):
            if _looks_like_location(piece):
                location = piece
                break
            if (
                had_contact
                and index != name_line
                and re.fullmatch(r"[^\W\d_][\w.'’ \-]{1,30}", piece)
                and not _has_title_word(piece)
                and piece[0].isupper()
                and len(piece.split()) <= 3
            ):
                location = piece
                break
        if location:
            break
    return name, location


# --------------------------------------------------------------- sections
def _split_blocks(lines: list[str]) -> tuple[list[str], list[_Block]]:
    header: list[str] = []
    blocks: list[_Block] = []
    current: _Block | None = None
    for line in lines:
        kind = _heading_kind(line)
        if kind is not None:
            current = _Block(kind, _HEADING_STRIP_RE.sub("", line).strip(), [])
            blocks.append(current)
            continue
        inline = _inline_heading(line, current.kind if current else None)
        if inline is not None:
            kind2, title, rest = inline
            current = _Block(kind2, title, [rest])
            blocks.append(current)
            continue
        if current is None:
            header.append(line)
        else:
            current.lines.append(line)
    return header, blocks


def _split_top_level(text: str) -> list[str]:
    """Split on commas/semicolons/bullets/pipes outside parentheses."""
    parts: list[str] = []
    depth = 0
    buf: list[str] = []
    for ch in text:
        if ch in "([{":
            depth += 1
        elif ch in ")]}":
            depth = max(0, depth - 1)
        if depth == 0 and ch in ",;|•·●▪◦":
            parts.append("".join(buf))
            buf = []
        else:
            buf.append(ch)
    parts.append("".join(buf))
    return parts


def _parse_skills(lines: list[str]) -> tuple[list[str], int]:
    skills: list[str] = []
    seen: set[str] = set()
    too_long = 0
    for raw in lines:
        line = raw.strip()
        if not line:
            continue
        bullet = _BULLET_RE.match(line)
        if bullet:
            line = bullet.group("t")
        label = _SKILL_LABEL_RE.match(line)
        if label:
            line = label.group("rest")
        for item in _split_top_level(line):
            skill = _clean(item).strip(".-–— ")
            if not skill or not any(ch.isalnum() for ch in skill):
                continue
            if len(skill) > MAX_SKILL_LENGTH:
                too_long += 1
                continue
            key = skill.lower()
            if key not in seen:
                seen.add(key)
                skills.append(skill)
    return skills, too_long


def _is_sentence_like(text: str) -> bool:
    words = len(text.split())
    if len(text) > 90:
        return True
    ends_with_org = text.endswith(".") and _has_org_word(text.split()[-1])
    return text.endswith(".") and words >= 3 and not ends_with_org


def _is_continuation(previous: str, line: str) -> bool:
    if line[:1].islower():
        return True
    last = previous.rstrip()
    if last.endswith((",", ";", "(", "-", "/", "&")):
        return True
    tail = _words(last)[-1:] if last else []
    return bool(tail and tail[0] in _TRAILING_CONT_WORDS)


def _pieces(line: str) -> list[str]:
    return [_clean(p) for p in _SEPARATOR_RE.split(line) if _clean(p)]


def _parse_entries(lines: list[str]) -> list[_Entry]:
    entries: list[_Entry] = []
    current: _Entry | None = None
    boundary = False

    def start(first: str | None = None) -> _Entry:
        entry = _Entry()
        if first:
            entry.header.append(first)
        entries.append(entry)
        return entry

    for raw in lines:
        line = raw.strip()
        if not line:
            boundary = True
            continue
        bullet = _BULLET_RE.match(line)
        if bullet:
            text = _clean(bullet.group("t"))
            if current is None:
                current = start()
            current.bullets.append(text)
            boundary = False
            continue

        line = _clean(line)
        in_bullets = current is not None and bool(current.bullets)
        dates = _find_range(line)
        single = None
        if dates is None and (current is None or (current.dates is None and not in_bullets)):
            if len(line) <= 80:
                single = _find_single(line)
        found = dates or single

        # wrapped bullet text
        if (
            current is not None
            and in_bullets
            and found is None
            and not boundary
            and _is_continuation(current.bullets[-1], line)
        ):
            current.bullets[-1] = _clean(f"{current.bullets[-1]} {line}")
            continue

        if found is not None:
            rng, begin, end = found
            remainder = _remove_span(line, begin, end)
            if (
                current is None
                or in_bullets
                or current.dates is not None
                or (boundary and (current.header or current.bullets))
            ):
                current = start()
            current.dates = rng
            current.date_first = not current.header and not remainder
            if remainder:
                current.header.append(remainder)
                current.date_first = False
            boundary = False
            continue

        # plain text line
        if current is None or in_bullets or boundary and (current.header or current.dates):
            if current is not None and in_bullets and _is_sentence_like(line) and not boundary:
                current.bullets.append(line)
                continue
            current = start(line)
            boundary = False
            continue
        if _is_sentence_like(line) and (current.header or current.dates):
            current.bullets.append(line)
        elif current.dates is None:
            if len(current.header) >= 4:
                current.bullets.append(line)
            else:
                current.header.append(line)
        elif current.date_first:
            if len(current.header) < 3:
                current.header.append(line)
            else:
                current.bullets.append(line)
        elif len(current.header) == 1 and len(_pieces(current.header[0])) == 1 and len(line) <= 60:
            current.header.append(line)
        else:
            current = start(line)
        boundary = False
    return entries


def _assign_header(kind: str, header: list[str]) -> tuple[str, str | None, str | None]:
    """Map header lines to (title, organization, location) for an entry."""
    pieces: list[str] = []
    for line in header:
        pieces.extend(_pieces(line))
    if not pieces:
        return "", None, None
    if len(pieces) == 1 and "," in pieces[0] and not _looks_like_location(pieces[0]):
        parts = [p.strip() for p in pieces[0].split(",") if p.strip()]
        if len(parts) >= 4:
            pieces = [parts[0], ", ".join(parts[1:-2]), ", ".join(parts[-2:])]
        else:
            pieces = parts
    title: str
    rest: list[str]
    if kind == "education":
        degree_idx = next((i for i, p in enumerate(pieces) if _DEGREE_RE.search(p)), 0)
        title = pieces[degree_idx]
        rest = pieces[:degree_idx] + pieces[degree_idx + 1 :]
        school_idx = next(
            (i for i, p in enumerate(rest) if any(w in _SCHOOL_WORDS for w in _words(p))), None
        )
        if school_idx is not None:
            rest.insert(0, rest.pop(school_idx))
    elif kind == "experience":
        first = 0
        if (
            len(pieces) > 1
            and not _has_title_word(pieces[0])
            and any(_has_title_word(p) for p in pieces[1:])
        ):
            first = next(i for i, p in enumerate(pieces) if i > 0 and _has_title_word(p))
        title = pieces[first]
        rest = pieces[:first] + pieces[first + 1 :]
    else:
        title = pieces[0]
        rest = pieces[1:]

    if kind in ("experience", "education"):
        expanded: list[str] = []
        for piece in rest:
            parts = [x.strip() for x in piece.split(",") if x.strip()]
            if len(parts) >= 3 and _looks_like_location(", ".join(parts[-2:])):
                expanded.extend([", ".join(parts[:-2]), ", ".join(parts[-2:])])
            else:
                expanded.append(piece)
        rest = expanded

    organization: str | None = None
    location: str | None = None
    for piece in rest:
        if location is None and kind in ("experience", "education") and _looks_like_location(piece):
            location = piece
        elif organization is None:
            organization = piece
        elif kind in ("project", "certification") or location is not None:
            organization = f"{organization}, {piece}"
        else:
            location = piece
    return title, organization, location


# ---------------------------------------------------------------- assembly
def _build_section(
    kind: str, entry: _Entry, warnings_state: dict[str, int]
) -> ImportedSection | None:
    title, organization, location = _assign_header(kind, entry.header)
    if not title:
        if not entry.bullets and entry.dates is None:
            return None
        title = _SECTION_LABEL[kind]
        warnings_state["untitled"] += 1
    dates = entry.dates
    start_date: str | None = None
    end_date: str | None = None
    if dates is not None:
        if dates.single:
            single = dates.end.isoformat() if dates.end else None
            if kind == "certification":
                start_date = single
            else:
                end_date = single
        else:
            start_date = dates.start.isoformat() if dates.start else None
            end_date = dates.end.isoformat() if dates.end else None
            if dates.start and dates.end and dates.end < dates.start:
                start_date = end_date = None
                warnings_state["bad_dates"] += 1
    elif kind in ("experience", "education"):
        warnings_state["no_dates"] += 1

    cleaned: list[str] = []
    for bullet in entry.bullets:
        text, cut = _truncate(bullet, MAX_BULLET_LENGTH)
        if cut:
            warnings_state["long_bullets"] += 1
        cleaned.append(text)
    if len(cleaned) > MAX_BULLETS:
        warnings_state["dropped_bullets"] += len(cleaned) - MAX_BULLETS
        cleaned = cleaned[:MAX_BULLETS]

    title, cut_title = _truncate(title, MAX_TITLE)
    if organization:
        organization, cut_org = _truncate(organization, MAX_ORG)
        cut_title = cut_title or cut_org
    if location:
        location, cut_loc = _truncate(location, MAX_LOCATION)
        cut_title = cut_title or cut_loc
    if cut_title:
        warnings_state["long_fields"] += 1
    return ImportedSection(
        type=kind,  # type: ignore[arg-type]
        title=title,
        organization=organization,
        location=location,
        start_date=start_date,
        end_date=end_date,
        bullets=cleaned,
    )


def _preprocess(text: str) -> list[str]:
    """Split into lines, drop page numbers and wrap absurdly long lines (bounds regex cost)."""
    lines: list[str] = []
    for line in text.split("\n"):
        if _PAGE_NUMBER_RE.match(line.strip()):
            continue
        while len(line) > _MAX_LINE:
            cut = line.rfind(" ", 0, _MAX_LINE)
            cut = cut if cut > 0 else _MAX_LINE
            lines.append(line[:cut])
            line = line[cut:].lstrip()
        lines.append(line)
    return lines


def _plural(count: int, singular: str, plural: str | None = None) -> str:
    return f"{count} {singular if count == 1 else (plural or singular + 's')}"


def parse_resume(text: str, filename: str | None = None) -> tuple[ImportedDraft, list[str]]:
    """Parse resume text into a draft and a list of warnings."""
    warnings: list[str] = []
    lines = _preprocess(text)
    header, blocks = _split_blocks(lines)

    full_name, header_location = _parse_header(header, warnings)

    contact_lines = [ln for ln in header if ln.strip()] or [ln for ln in lines if ln.strip()][:8]
    all_lines = [ln for ln in lines if ln.strip()]
    email = _find_email(contact_lines) or _find_email(all_lines)
    if email and not _valid_email(email):
        warnings.append("The email address found looks invalid and was left out.")
        email = None
    if email is None and not any("email" in w.lower() for w in warnings):
        warnings.append("No email address was found.")
    phone = _find_phone(contact_lines)
    if phone is None:
        labelled = [ln for ln in all_lines if re.search(r"\b(?:phone|tel|mobile|cell)\b", ln, re.I)]
        phone = _find_phone(labelled)
    linkedin, website = _find_urls(contact_lines)
    if linkedin is None:
        linkedin, _ = _find_urls(all_lines)
    if website is not None and linkedin is not None and website == linkedin:
        website = None
    if phone is None:
        warnings.append("No phone number was found.")

    summary_parts: list[str] = []
    skills: list[str] = []
    skills_seen = False
    skill_too_long = 0
    sections: list[ImportedSection] = []
    state = {
        "no_dates": 0,
        "untitled": 0,
        "bad_dates": 0,
        "long_bullets": 0,
        "dropped_bullets": 0,
        "long_fields": 0,
    }
    ignored: list[str] = []
    for block in blocks:
        if block.kind == "summary":
            for raw in block.lines:
                line = raw.strip()
                bullet = _BULLET_RE.match(line)
                if bullet:
                    line = bullet.group("t")
                if line:
                    summary_parts.append(_clean(line))
        elif block.kind == "skills":
            skills_seen = True
            found, too_long = _parse_skills(block.lines)
            skill_too_long += too_long
            known = {s.lower() for s in skills}
            skills.extend(s for s in found if s.lower() not in known)
        elif block.kind == "other":
            ignored.append(block.title or "Other")
        else:
            for entry in _parse_entries(block.lines):
                section = _build_section(block.kind, entry, state)
                if section is not None:
                    sections.append(section)

    summary: str | None = None
    if summary_parts:
        summary, cut = _truncate(" ".join(summary_parts), MAX_SUMMARY)
        if cut:
            warnings.append("The summary was too long and was shortened.")

    if not skills:
        warnings.append(
            "No skills were found."
            if not skills_seen
            else "A skills section was found but no individual skills could be read."
        )
    if skill_too_long:
        warnings.append(
            f"{_plural(skill_too_long, 'skill entry', 'skill entries')} "
            f"longer than {MAX_SKILL_LENGTH} characters {'was' if skill_too_long == 1 else 'were'} "
            "skipped."
        )
    if len(skills) > MAX_SKILLS:
        warnings.append(
            f"Only the first {MAX_SKILLS} of {len(skills)} skills were kept (the limit is "
            f"{MAX_SKILLS})."
        )
        skills = skills[:MAX_SKILLS]

    if not sections:
        warnings.append(
            "No experience, education, project or certification sections were detected. "
            "Check that your resume uses standard headings such as 'Work Experience'."
        )
    if len(sections) > MAX_SECTIONS:
        warnings.append(
            f"Only the first {MAX_SECTIONS} of {len(sections)} entries were kept (the limit is "
            f"{MAX_SECTIONS})."
        )
        sections = sections[:MAX_SECTIONS]
    for index, section in enumerate(sections):
        section.position = index

    if state["no_dates"]:
        warnings.append(
            "No dates found for "
            + _plural(
                state["no_dates"], "experience/education entry", "experience/education entries"
            )
            + "."
        )
    if state["untitled"]:
        warnings.append(
            f"{_plural(state['untitled'], 'entry', 'entries')} had no recognisable title; "
            "please review."
        )
    if state["bad_dates"]:
        warnings.append(
            f"{_plural(state['bad_dates'], 'entry', 'entries')} had an end date before its "
            "start date; the dates were left blank."
        )
    if state["long_bullets"]:
        warnings.append(
            f"{_plural(state['long_bullets'], 'bullet')} longer than {MAX_BULLET_LENGTH} "
            "characters "
            f"{'was' if state['long_bullets'] == 1 else 'were'} shortened."
        )
    if state["dropped_bullets"]:
        warnings.append(
            f"{_plural(state['dropped_bullets'], 'bullet')} beyond the limit of {MAX_BULLETS} "
            "per entry "
            f"{'was' if state['dropped_bullets'] == 1 else 'were'} dropped."
        )
    if state["long_fields"]:
        warnings.append("Some titles, organizations or locations were too long and were shortened.")
    for title in ignored:
        warnings.append(f"The '{title}' section is not supported and was skipped.")

    if full_name:
        full_name, cut = _truncate(full_name, MAX_NAME)
    draft_title = f"{full_name} Resume" if full_name else _title_from_filename(filename)
    draft = ImportedDraft(
        title=draft_title[:MAX_TITLE],
        full_name=full_name,
        email=email,
        phone=phone,
        location=header_location[:MAX_LOCATION] if header_location else None,
        linkedin_url=linkedin,
        website_url=website,
        summary=summary,
        skills=skills,
        sections=sections,
    )
    return draft, warnings


def _title_from_filename(filename: str | None) -> str:
    stem = posixpath.splitext(posixpath.basename((filename or "").replace("\\", "/")))[0].strip()
    return stem or "Imported Resume"
