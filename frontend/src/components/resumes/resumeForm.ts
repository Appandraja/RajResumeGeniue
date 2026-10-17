import type { Resume, ResumeSection, ResumeSectionType } from '../../types';
import type { ImportedDraft } from '../../types/importer';
import type { ResumePayload, SectionPayload } from '../../services/resumeService';

export interface SectionDraft {
  /** Local key for React lists. */
  key: string;
  /** Server id when the section already exists. */
  id: number | null;
  type: ResumeSectionType;
  title: string;
  organization: string;
  location: string;
  start_date: string;
  end_date: string;
  bullets: string[];
}

export interface ResumeFormState {
  title: string;
  template_id: number | null;
  full_name: string;
  email: string;
  phone: string;
  location: string;
  linkedin_url: string;
  website_url: string;
  summary: string;
  skills: string[];
  job_title: string;
  company: string;
  job_description: string;
  sections: SectionDraft[];
}

export const MAX_JOB_DESCRIPTION = 20000;

export type FormErrors = Partial<Record<string, string>>;

let keyCounter = 0;
export function nextKey(): string {
  keyCounter += 1;
  return `draft-${keyCounter}`;
}

export function emptyForm(): ResumeFormState {
  return {
    title: '',
    template_id: null,
    full_name: '',
    email: '',
    phone: '',
    location: '',
    linkedin_url: '',
    website_url: '',
    summary: '',
    skills: [],
    job_title: '',
    company: '',
    job_description: '',
    sections: [],
  };
}

export function newSection(type: ResumeSectionType): SectionDraft {
  return {
    key: nextKey(),
    id: null,
    type,
    title: '',
    organization: '',
    location: '',
    start_date: '',
    end_date: '',
    bullets: [],
  };
}

function draftFromSection(s: ResumeSection): SectionDraft {
  return {
    key: `section-${s.id}`,
    id: s.id,
    type: s.type,
    title: s.title,
    organization: s.organization ?? '',
    location: s.location ?? '',
    start_date: s.start_date ?? '',
    end_date: s.end_date ?? '',
    bullets: s.bullets,
  };
}

export function formFromResume(r: Resume): ResumeFormState {
  return {
    title: r.title,
    template_id: r.template_id,
    full_name: r.full_name ?? '',
    email: r.email ?? '',
    phone: r.phone ?? '',
    location: r.location ?? '',
    linkedin_url: r.linkedin_url ?? '',
    website_url: r.website_url ?? '',
    summary: r.summary ?? '',
    skills: r.skills,
    job_title: r.job_title ?? '',
    company: r.company ?? '',
    job_description: r.job_description ?? '',
    sections: [...r.sections].sort((a, b) => a.position - b.position).map(draftFromSection),
  };
}

/**
 * Maps an imported draft to form state. Unknown values stay empty; nothing is invented.
 * A null end date with a start date means "Present", which the form represents as ''.
 */
export function formFromImportedDraft(draft: ImportedDraft): ResumeFormState {
  const seen = new Set<string>();
  const skills: string[] = [];
  for (const raw of draft.skills) {
    const skill = raw.trim();
    const key = skill.toLowerCase();
    if (skill && !seen.has(key)) {
      seen.add(key);
      skills.push(skill);
    }
  }
  const sections: SectionDraft[] = [...draft.sections]
    .sort((a, b) => a.position - b.position)
    .filter((s) => s.type === 'experience' || s.type === 'education' || s.title.trim() !== '')
    .map((s) => ({
      key: nextKey(),
      id: null,
      type: s.type,
      title: s.title ?? '',
      organization: s.organization ?? '',
      location: s.location ?? '',
      start_date: s.start_date ?? '',
      end_date: s.end_date ?? '',
      bullets: s.bullets.map((b) => b.trim()).filter((b) => b.length > 0),
    }));
  return {
    ...emptyForm(),
    title: draft.title ?? '',
    full_name: draft.full_name ?? '',
    email: draft.email ?? '',
    phone: draft.phone ?? '',
    location: draft.location ?? '',
    linkedin_url: draft.linkedin_url ?? '',
    website_url: draft.website_url ?? '',
    summary: draft.summary ?? '',
    skills,
    sections,
  };
}

const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim());

export function toResumePayload(f: ResumeFormState, templateId: number): ResumePayload {
  return {
    title: f.title.trim() || 'Untitled resume',
    template_id: templateId,
    full_name: orNull(f.full_name),
    email: orNull(f.email),
    phone: orNull(f.phone),
    location: orNull(f.location),
    linkedin_url: orNull(f.linkedin_url),
    website_url: orNull(f.website_url),
    summary: orNull(f.summary),
    skills: f.skills,
    job_title: orNull(f.job_title),
    company: orNull(f.company),
    job_description: orNull(f.job_description),
  };
}

export function toSectionPayload(d: SectionDraft, position: number): SectionPayload {
  return {
    type: d.type,
    title: d.title.trim(),
    organization: orNull(d.organization),
    location: orNull(d.location),
    start_date: orNull(d.start_date),
    end_date: orNull(d.end_date),
    bullets: d.bullets.map((b) => b.trim()).filter((b) => b.length > 0),
    position,
  };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateContact(f: ResumeFormState): FormErrors {
  const errors: FormErrors = {};
  if (!f.full_name.trim()) errors.full_name = 'Please enter your full name.';
  if (!f.email.trim()) errors.email = 'Please enter your email address.';
  else if (!EMAIL_RE.test(f.email.trim())) errors.email = 'This does not look like an email address.';
  return errors;
}

export function validateSections(sections: SectionDraft[]): FormErrors {
  const errors: FormErrors = {};
  sections.forEach((s) => {
    if (!s.title.trim()) {
      errors[s.key] =
        s.type === 'education'
          ? 'Please enter your degree or course name.'
          : 'Please enter a job title.';
    } else if (s.start_date && s.end_date && s.end_date < s.start_date) {
      errors[s.key] = 'The end date must be after the start date.';
    }
  });
  return errors;
}

export function formatDate(value: string | null): string {
  if (!value) return '';
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function dateRange(start: string | null, end: string | null): string {
  const s = formatDate(start);
  if (!s && !end) return '';
  return `${s} - ${end ? formatDate(end) : 'Present'}`;
}
