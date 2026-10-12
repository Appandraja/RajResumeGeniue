# INITIAL.md - RajResumeGenie Product Definition

> ATS-friendly resumes without the stress. Fill in your details, pick a clean template, download.

---

## PRODUCT

**Name:** RajResumeGenie

**Description:** Helps non-designers build a clean, professional, ATS-friendly resume quickly. Users enter their details in a guided form, choose from ATS-safe templates (single column, standard headings, no images or tables), preview live, and export to PDF or DOCX.

**Target User:** People who are not designers and just want a clean, professional, ATS-friendly resume quickly without the hassle.

**Type:** SaaS

---

## TECH STACK

| Layer | Choice |
|-------|--------|
| Backend | FastAPI + Python 3.11+ |
| Frontend | React + TypeScript + Vite |
| Database | PostgreSQL + SQLAlchemy |
| Auth | JWT + Google OAuth |
| UI | Chakra UI |
| Payments | None (add later) |

---

## MODULES

### Module 1: Authentication (Built-in)

**Models:** User, RefreshToken

**Endpoints:**
- POST /auth/register, /auth/login, /auth/refresh, /auth/logout
- GET /auth/me, /auth/google

**Pages:** /login, /register, /profile

---

### Module 2: Resumes

**Description:** Create and edit resumes through a guided, section-by-section form.

**Models:**
```
Resume:
  - id, user_id (FK)
  - title: str
  - template_id (FK)
  - full_name, email, phone, location, linkedin_url, website_url: str
  - summary: text
  - skills: list[str]
  - ats_score: int (nullable)
  - created_at, updated_at

ResumeSection:
  - id, resume_id (FK)
  - type: enum (experience, education, project, certification)
  - title, organization, location: str
  - start_date, end_date: date (end nullable = current)
  - bullets: list[str]
  - position: int
  - created_at, updated_at
```

**Endpoints:**
```
GET    /api/resumes                         - List my resumes
POST   /api/resumes                         - Create
GET    /api/resumes/{id}                    - Get one (with sections)
PUT    /api/resumes/{id}                    - Update
DELETE /api/resumes/{id}                    - Delete
POST   /api/resumes/{id}/duplicate          - Duplicate
POST   /api/resumes/{id}/sections           - Add section
PUT    /api/resumes/{id}/sections/{sid}     - Update section
DELETE /api/resumes/{id}/sections/{sid}     - Delete section
GET    /api/resumes/{id}/ats-check          - ATS score + suggestions
```

**Pages:**
```
/resumes            - List
/resumes/new        - Create (guided wizard)
/resumes/{id}       - Detail / live preview
/resumes/{id}/edit  - Edit
```

---

### Module 3: Templates

**Description:** A small set of ATS-safe resume templates (single column, standard fonts, standard section headings).

**Models:**
```
Template:
  - id
  - name, slug: str
  - description: str
  - font_family, accent_color: str
  - is_active: bool
  - created_at
```

**Endpoints:**
```
GET /api/templates       - List active templates
GET /api/templates/{id}  - Get one
```

**Pages:**
```
/templates  - Template gallery with preview
```

---

### Module 4: Export

**Description:** Render a resume with its template to a downloadable, text-selectable file.

**Endpoints:**
```
GET /api/resumes/{id}/export/pdf   - Download PDF
GET /api/resumes/{id}/export/docx  - Download DOCX
```

**Pages:** Export buttons on /resumes/{id}

---

### Module 5: Dashboard

**Pages:** /dashboard (my resumes, ATS scores, quick actions), /settings

---

## MVP SCOPE

Must Have:
- [x] User registration/login (email + Google)
- [ ] Create and edit a resume via guided form
- [ ] At least 3 ATS-safe templates with live preview
- [ ] Export to PDF
- [ ] Basic ATS check (score + suggestions)

Post-MVP:
- [ ] DOCX export
- [ ] Duplicate resume
- [ ] Payments / premium templates
- [ ] AI bullet-point suggestions

---

## ACCEPTANCE CRITERIA

- [ ] Users can register and login
- [ ] Users can CRUD their resumes and sections
- [ ] Users can choose a template and see a live preview
- [ ] Exported PDF is single column with selectable text (no images/tables)
- [ ] ATS check returns a score and actionable suggestions
- [ ] 80%+ test coverage
- [ ] Docker builds successfully

---

## RUN

```bash
/generate-prp INITIAL.md
/execute-prp PRPs/rajresumegenie-prp.md
```
