import { AxiosError } from 'axios';
import api from './api';
import type { AtsCheckResult, Resume, ResumeSection, ResumeSectionType, Template } from '../types';

export interface ResumePayload {
  title: string;
  template_id: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  location: string | null;
  linkedin_url: string | null;
  website_url: string | null;
  summary: string | null;
  skills: string[];
}

export interface SectionPayload {
  type: ResumeSectionType;
  title: string;
  organization: string | null;
  location: string | null;
  start_date: string | null;
  end_date: string | null;
  bullets: string[];
  position: number;
}

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

export function getApiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof AxiosError) {
    const body = err.response?.data as ApiErrorBody | undefined;
    if (body?.error?.message) return body.error.message;
    if (!err.response) return 'Cannot reach the server. Please check your connection.';
  }
  return fallback;
}

export async function listResumes(): Promise<Resume[]> {
  const { data } = await api.get<Resume[]>('/api/resumes');
  return data;
}

export async function getResume(id: number): Promise<Resume> {
  const { data } = await api.get<Resume>(`/api/resumes/${id}`);
  return data;
}

export async function createResume(payload: ResumePayload): Promise<Resume> {
  const { data } = await api.post<Resume>('/api/resumes', payload);
  return data;
}

export async function updateResume(id: number, payload: Partial<ResumePayload>): Promise<Resume> {
  const { data } = await api.put<Resume>(`/api/resumes/${id}`, payload);
  return data;
}

export async function deleteResume(id: number): Promise<void> {
  await api.delete(`/api/resumes/${id}`);
}

export async function duplicateResume(id: number): Promise<Resume> {
  const { data } = await api.post<Resume>(`/api/resumes/${id}/duplicate`);
  return data;
}

export async function addSection(resumeId: number, payload: SectionPayload): Promise<ResumeSection> {
  const { data } = await api.post<ResumeSection>(`/api/resumes/${resumeId}/sections`, payload);
  return data;
}

export async function updateSection(
  resumeId: number,
  sectionId: number,
  payload: Partial<SectionPayload>,
): Promise<ResumeSection> {
  const { data } = await api.put<ResumeSection>(
    `/api/resumes/${resumeId}/sections/${sectionId}`,
    payload,
  );
  return data;
}

export async function deleteSection(resumeId: number, sectionId: number): Promise<void> {
  await api.delete(`/api/resumes/${resumeId}/sections/${sectionId}`);
}

export async function getAtsCheck(resumeId: number): Promise<AtsCheckResult> {
  const { data } = await api.get<AtsCheckResult>(`/api/resumes/${resumeId}/ats-check`);
  return data;
}

export async function listTemplatesForPicker(): Promise<Template[]> {
  const { data } = await api.get<Template[]>('/api/templates');
  return data;
}
