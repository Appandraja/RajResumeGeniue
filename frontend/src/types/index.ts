export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_verified: boolean;
  oauth_provider: string | null;
  created_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface Template {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  font_family: string;
  accent_color: string;
  is_active: boolean;
  created_at: string;
}

export type ResumeSectionType = 'experience' | 'education' | 'project' | 'certification';

export interface ResumeSection {
  id: number;
  resume_id: number;
  type: ResumeSectionType;
  title: string;
  organization: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  bullets: string[];
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Resume {
  id: number;
  user_id: number;
  template_id: number;
  title: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  summary: string | null;
  skills: string[];
  ats_score: number | null;
  job_title?: string | null;
  company?: string | null;
  job_description?: string | null;
  sections: ResumeSection[];
  created_at: string;
  updated_at: string;
}

export interface AtsCheckResult {
  score: number;
  suggestions: string[];
}
