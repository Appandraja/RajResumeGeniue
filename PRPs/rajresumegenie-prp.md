# PRP: RajResumeGenie

> Implementation blueprint for parallel agent execution

---

## METADATA

| Field | Value |
|-------|-------|
| **Product** | RajResumeGenie |
| **Type** | SaaS |
| **Version** | 1.0 |
| **Created** | 2026-10-12 |
| **Complexity** | Medium |

---

## PRODUCT OVERVIEW

**Description:** Helps non-designers build a clean, professional, ATS-friendly resume quickly. Users enter their details in a guided form, choose from ATS-safe templates (single column, standard headings, no images or tables), preview live, and export to PDF (DOCX post-MVP).

**Target User:** People who are not designers and want a clean, professional, ATS-friendly resume quickly without the hassle.

**Value Proposition:** Resumes that parse correctly in applicant tracking systems, with no design skills or formatting work required.

**MVP Scope:**
- [ ] User registration/login (email + Google OAuth)
- [ ] Create and edit a resume via guided form
- [ ] At least 3 ATS-safe templates with live preview
- [ ] Export to PDF
- [ ] Basic ATS check (score + suggestions)

**Post-MVP:** DOCX export, duplicate resume, payments / premium templates, AI bullet-point suggestions.

---

## TECH STACK

| Layer | Technology | Skill Reference |
|-------|------------|-----------------|
| Backend | FastAPI + Python 3.11+ | skills/BACKEND.md |
| Frontend | React + TypeScript + Vite | skills/FRONTEND.md |
| Database | PostgreSQL + SQLAlchemy + Alembic | skills/DATABASE.md |
| Auth | JWT + bcrypt + Google OAuth | skills/BACKEND.md |
| UI | Chakra UI | skills/FRONTEND.md |
| Export | PDF renderer (e.g. WeasyPrint/ReportLab, text-selectable output), python-docx (post-MVP) | skills/BACKEND.md |
| Testing | pytest + React Testing Library | skills/TESTING.md |
| Deployment | Docker + GitHub Actions | skills/DEPLOYMENT.md |

**Project rules (from CLAUDE.md):** type hints required, async endpoints, no `print()` (use `logging`), bcrypt for passwords, no hardcoded secrets, no `any` in TypeScript, no `console.log`, no inline styles (use Chakra).

---

## DATABASE MODELS

### User
- id, email, hashed_password (nullable for OAuth-only), full_name, is_active, is_verified, oauth_provider, created_at

### RefreshToken
- id, user_id (FK → User), token, expires_at, revoked, created_at

### Template
- id, name, slug (unique), description, font_family, accent_color, is_active, created_at
- Seeded with at least 3 ATS-safe templates (single column, standard fonts, standard headings)

### Resume
- id, user_id (FK → User), template_id (FK → Template), title
- full_name, email, phone, location, linkedin_url, website_url
- summary (text), skills (list[str]), ats_score (int, nullable)
- created_at, updated_at

### ResumeSection
- id, resume_id (FK → Resume, cascade delete)
- type (enum: experience, education, project, certification)
- title, organization, location, start_date, end_date (nullable = current)
- bullets (list[str]), position (int)
- created_at, updated_at

**Relationships:** User 1—N Resume, Template 1—N Resume, Resume 1—N ResumeSection, User 1—N RefreshToken.
All Resume queries must be scoped to the authenticated user (`user_id`).

---

## MODULES

### Module 1: Authentication
**Agents:** DATABASE-AGENT + BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/register | Create account |
| POST | /auth/login | Get tokens |
| POST | /auth/refresh | Refresh token |
| POST | /auth/logout | Revoke refresh token |
| GET | /auth/me | Current user |
| GET | /auth/google | Google OAuth login |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /login | LoginPage | LoginForm, GoogleSignInButton |
| /register | RegisterPage | RegisterForm |
| /profile | ProfilePage (protected) | ProfileForm |

---

### Module 2: Resumes
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/resumes | List my resumes |
| POST | /api/resumes | Create |
| GET | /api/resumes/{id} | Get one (with sections) |
| PUT | /api/resumes/{id} | Update |
| DELETE | /api/resumes/{id} | Delete |
| POST | /api/resumes/{id}/duplicate | Duplicate (post-MVP) |
| POST | /api/resumes/{id}/sections | Add section |
| PUT | /api/resumes/{id}/sections/{sid} | Update section |
| DELETE | /api/resumes/{id}/sections/{sid} | Delete section |
| GET | /api/resumes/{id}/ats-check | ATS score + suggestions |

**ATS check (MVP, rule-based):** flags missing contact info, missing standard sections, empty or very long bullets, missing dates, and low keyword/skills coverage; returns score 0–100 and a list of suggestions; persists `ats_score`.

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /resumes | ResumeListPage | ResumeCard, EmptyState |
| /resumes/new | ResumeWizardPage | WizardStepper, ContactStep, SummaryStep, ExperienceStep, EducationStep, SkillsStep |
| /resumes/{id} | ResumeDetailPage | ResumePreview, AtsScorePanel, ExportButtons |
| /resumes/{id}/edit | ResumeEditPage | SectionEditor, SectionList (reorderable), LivePreview |

---

### Module 3: Templates
**Agents:** BACKEND-AGENT + FRONTEND-AGENT

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/templates | List active templates |
| GET | /api/templates/{id} | Get one |

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /templates | TemplateGalleryPage | TemplateCard, TemplatePreview |

---

### Module 4: Export
**Agents:** BACKEND-AGENT + FRONTEND-AGENT
**Depends on:** Resumes + Templates services

**Backend Endpoints:**
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | /api/resumes/{id}/export/pdf | Download PDF (MVP) |
| GET | /api/resumes/{id}/export/docx | Download DOCX (post-MVP) |

**Output requirements:** single column, selectable text, standard section headings, no images/tables/text boxes, standard fonts.

**Frontend:** ExportButtons on /resumes/{id} (download with loading and error states).

---

### Module 5: Dashboard
**Agents:** FRONTEND-AGENT

**Frontend Pages:**
| Route | Page | Components |
|-------|------|------------|
| /dashboard | DashboardPage | ResumeSummaryList, AtsScoreBadge, QuickActions |
| /settings | SettingsPage | SettingsForm |

---

## PHASE EXECUTION PLAN

**Phase 1: Foundation (4 agents in parallel)**
- DATABASE-AGENT: All models (User, RefreshToken, Template, Resume, ResumeSection), initial migration, template seed data, database.py
- BACKEND-AGENT: main.py, config.py, logging setup, project structure, health endpoint
- FRONTEND-AGENT: Vite + TS setup, Chakra theme, folder structure, API client, auth context, base components
- DEVOPS-AGENT: Docker, docker-compose, CI/CD, env files

**Validation Gate 1:** `pip install`, `alembic upgrade head`, `npm install`, `docker-compose config`

**Phase 2: Modules (backend + frontend parallel per module)**
- Auth Module: JWT + Google OAuth endpoints + Login/Register/Profile pages
- Templates Module: list/get endpoints + gallery page
- Resumes Module: CRUD, sections, ATS check + list/wizard/detail/edit pages
- Dashboard Module: dashboard + settings pages (consumes Resumes API)
- Export Module (after Resumes + Templates land): PDF export + export buttons

**Validation Gate 2:** `ruff check backend/`, `mypy`, `npm run lint`, `npm run type-check`

**Phase 3: Quality (3 agents in parallel)**
- TEST-AGENT: pytest + RTL tests, 80%+ coverage (incl. ownership checks and export output)
- REVIEW-AGENT: security audit (auth, ownership scoping, OAuth state), performance, code quality
- RESEARCH-AGENT: ATS best-practices validation (headings, fonts, parseability)

**Final Validation:** full test suite, docker build, health checks

---

## VALIDATION GATES

| Gate | Commands |
|------|----------|
| 1 | `alembic upgrade head`, `npm install`, `docker-compose config` |
| 2 | `ruff check backend/`, `npm run type-check` |
| 3 | `pytest --cov --cov-fail-under=80`, `npm test` |
| Final | `docker-compose up -d`, `curl localhost:8000/health` |

---

## ACCEPTANCE CRITERIA

- [ ] Users can register and login (email + Google)
- [ ] Users can CRUD their resumes and sections; no access to other users' resumes
- [ ] Users can choose a template and see a live preview
- [ ] Exported PDF is single column with selectable text (no images/tables)
- [ ] ATS check returns a score and actionable suggestions
- [ ] 80%+ backend test coverage
- [ ] TypeScript strict mode passes, no `any`
- [ ] Docker builds and runs successfully

---

## ENVIRONMENT VARIABLES

```env
DATABASE_URL=postgresql://user:password@localhost:5432/rajresumegenie
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-secret
VITE_API_URL=http://localhost:8000
```

---

## NEXT STEP

Execute with parallel agents:
/execute-prp PRPs/rajresumegenie-prp.md
