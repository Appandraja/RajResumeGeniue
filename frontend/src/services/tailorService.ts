import api from './api';
import type { TailorRequest, TailorResult } from '../types/tailor';

/**
 * Read-only analysis of how well a resume matches a job description. Nothing is saved.
 * When no job description is given the server uses the one stored on the resume.
 */
export async function analyzeTailor(
  resumeId: number,
  jobDescription?: string,
): Promise<TailorResult> {
  const body: TailorRequest = {};
  if (jobDescription !== undefined && jobDescription.trim() !== '') {
    body.job_description = jobDescription;
  }
  const { data } = await api.post<TailorResult>(`/api/resumes/${resumeId}/tailor`, body);
  return data;
}
