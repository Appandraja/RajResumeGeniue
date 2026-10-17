/**
 * Contract for POST /api/import/resume (multipart field "file").
 * The draft is NOT saved by the server: the user reviews it in the wizard first.
 */
export type ImportedSectionType = 'experience' | 'education' | 'project' | 'certification';

export interface ImportedSection {
  type: ImportedSectionType;
  title: string;
  organization: string | null;
  location: string | null;
  /** ISO date (YYYY-MM-DD) or null when unknown. */
  start_date: string | null;
  /** ISO date or null (null with a start date means "Present"). */
  end_date: string | null;
  bullets: string[];
  position: number;
}

export interface ImportedDraft {
  title: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  summary: string | null;
  skills: string[];
  sections: ImportedSection[];
}

export type ImportSourceFormat = 'pdf' | 'docx' | 'odt' | 'rtf' | 'txt' | 'md' | 'html';

export interface ImportResult {
  draft: ImportedDraft;
  /** Human-readable notes, e.g. "No dates found for 2 entries". */
  warnings: string[];
  source_format: ImportSourceFormat;
  char_count: number;
}

/** Router state passed from the import page to /resumes/new (the review wizard). */
export interface ImportedDraftNavState {
  importedDraft: ImportedDraft;
  warnings: string[];
  sourceFileName: string;
}
