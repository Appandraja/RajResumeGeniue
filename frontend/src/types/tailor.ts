/**
 * Contract for POST /api/resumes/{id}/tailor.
 * Body (optional): { "job_description": string }. When omitted the stored job description is used.
 * Suggestions are never applied automatically: the user approves each one.
 */
export type KeywordImportance = 'high' | 'medium' | 'low';

export interface MatchedKeyword {
  keyword: string;
  importance: KeywordImportance;
  /** Where the keyword was found in the resume, e.g. "skills", "experience", "summary". */
  where: string[];
}

export interface MissingKeyword {
  keyword: string;
  importance: KeywordImportance;
  /** Plain-language advice on how to add it truthfully. */
  suggestion: string;
}

export type TailorActionType = 'add_skill' | 'reorder_skills';

export interface TailorAction {
  type: TailorActionType;
  /** add_skill: the skill (string). reorder_skills: the full reordered list (string[]). */
  value: string | string[];
}

export interface TailorSuggestion {
  code: string;
  severity: KeywordImportance;
  section: string | null;
  message: string;
  /** Present when the suggestion can be applied with one click after the user confirms. */
  action: TailorAction | null;
}

export interface TailorResult {
  /** 0-100: how well the resume covers the job description's keywords. */
  match_score: number;
  job_title: string | null;
  matched: MatchedKeyword[];
  missing: MissingKeyword[];
  suggestions: TailorSuggestion[];
  /** The general ATS completeness result, included for convenience. */
  ats: { score: number; suggestions: string[] };
}

export interface TailorRequest {
  job_description?: string;
}
