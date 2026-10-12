import type { Resume } from '../../types';

export interface DashboardStats {
  total: number;
  averageScore: number | null;
  bestScore: number | null;
}

export function computeStats(resumes: Resume[]): DashboardStats {
  const scores = resumes.map((r) => r.ats_score).filter((s): s is number => s !== null);
  return {
    total: resumes.length,
    averageScore:
      scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null,
    bestScore: scores.length > 0 ? Math.max(...scores) : null,
  };
}

export function mostRecent(resumes: Resume[], limit: number): Resume[] {
  return [...resumes]
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
    .slice(0, limit);
}
