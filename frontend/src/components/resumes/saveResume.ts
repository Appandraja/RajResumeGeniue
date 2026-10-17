import type { Resume } from '../../types';
import {
  addSection,
  createResume,
  deleteSection,
  updateResume,
  updateSection,
} from '../../services/resumeService';
import { toResumePayload, toSectionPayload, type ResumeFormState } from './resumeForm';

export interface CreateProgress {
  resumeId: number | null;
  /** Keys of drafts already saved on the server (so a retry does not duplicate them). */
  savedKeys: Set<string>;
}

export function newCreateProgress(): CreateProgress {
  return { resumeId: null, savedKeys: new Set<string>() };
}

/** Creates the resume and its sections. Safe to call again with the same progress after a failure. */
export async function createResumeWithSections(
  form: ResumeFormState,
  templateId: number,
  progress: CreateProgress,
): Promise<number> {
  if (progress.resumeId === null) {
    const created = await createResume(toResumePayload(form, templateId));
    progress.resumeId = created.id;
  }
  const resumeId = progress.resumeId;
  for (let i = 0; i < form.sections.length; i += 1) {
    const draft = form.sections[i];
    if (progress.savedKeys.has(draft.key)) continue;
    await addSection(resumeId, toSectionPayload(draft, i));
    progress.savedKeys.add(draft.key);
  }
  return resumeId;
}

/** Saves edits: updates the resume, then syncs sections (add / update / delete). */
export async function saveResumeEdits(
  original: Resume,
  form: ResumeFormState,
  templateId: number,
): Promise<void> {
  await updateResume(original.id, toResumePayload(form, templateId));
  const keptIds = new Set(form.sections.map((s) => s.id).filter((id): id is number => id !== null));
  for (const old of original.sections) {
    if (!keptIds.has(old.id)) await deleteSection(original.id, old.id);
  }
  for (let i = 0; i < form.sections.length; i += 1) {
    const draft = form.sections[i];
    const payload = toSectionPayload(draft, i);
    if (draft.id === null) await addSection(original.id, payload);
    else await updateSection(original.id, draft.id, payload);
  }
}
