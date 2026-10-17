import { describe, expect, it } from 'vitest';
import type { Resume } from '../../types';
import type { ImportedDraft } from '../../types/importer';
import { emptyForm, formFromImportedDraft, formFromResume, toResumePayload } from './resumeForm';

const draft: ImportedDraft = {
  title: 'Imported resume',
  full_name: 'Jane Doe',
  email: 'jane@example.com',
  phone: null,
  location: 'Austin, TX',
  linkedin_url: null,
  website_url: null,
  summary: 'Engineer.',
  skills: ['Python', ' SQL ', 'python', ''],
  sections: [
    {
      type: 'education',
      title: 'BSc Computer Science',
      organization: 'UT',
      location: null,
      start_date: '2014-09-01',
      end_date: '2018-06-01',
      bullets: [],
      position: 1,
    },
    {
      type: 'experience',
      title: 'Engineer',
      organization: 'Acme',
      location: null,
      start_date: '2020-01-01',
      end_date: null,
      bullets: ['Built APIs', '  ', 'Cut costs 20%'],
      position: 0,
    },
    {
      type: 'project',
      title: '',
      organization: null,
      location: null,
      start_date: null,
      end_date: null,
      bullets: [],
      position: 2,
    },
  ],
};

describe('formFromImportedDraft', () => {
  const form = formFromImportedDraft(draft);

  it('maps contact fields and keeps unknown values empty', () => {
    expect(form.full_name).toBe('Jane Doe');
    expect(form.phone).toBe('');
    expect(form.linkedin_url).toBe('');
    expect(form.template_id).toBeNull();
    expect(form.job_description).toBe('');
  });

  it('orders sections by position and maps dates, Present and bullets', () => {
    expect(form.sections.map((s) => s.title)).toEqual(['Engineer', 'BSc Computer Science']);
    const job = form.sections[0];
    expect(job?.start_date).toBe('2020-01-01');
    expect(job?.end_date).toBe(''); // Present
    expect(job?.bullets).toEqual(['Built APIs', 'Cut costs 20%']);
    expect(job?.id).toBeNull();
    expect(form.sections[1]?.end_date).toBe('2018-06-01');
  });

  it('trims and de-duplicates skills', () => {
    expect(form.skills).toEqual(['Python', 'SQL']);
  });

  it('gives each section a unique key', () => {
    const keys = form.sections.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('job description fields', () => {
  it('are included in the payload, null when blank', () => {
    const f = { ...emptyForm(), job_title: ' PM ', company: '', job_description: 'Lead things' };
    const payload = toResumePayload(f, 4);
    expect(payload.job_title).toBe('PM');
    expect(payload.company).toBeNull();
    expect(payload.job_description).toBe('Lead things');
  });

  it('are read back from a resume', () => {
    const r = {
      id: 1,
      template_id: 1,
      title: 't',
      skills: [],
      sections: [],
      job_title: 'Dev',
      company: 'Acme',
      job_description: 'Do dev',
    } as unknown as Resume;
    const f = formFromResume(r);
    expect([f.job_title, f.company, f.job_description]).toEqual(['Dev', 'Acme', 'Do dev']);
  });
});
