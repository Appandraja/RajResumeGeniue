import { useCallback, useEffect, useState } from 'react';
import {
  deleteResume,
  duplicateResume,
  getApiErrorMessage,
  listResumes,
} from '../services/resumeService';
import type { Resume } from '../types';

interface UseResumesResult {
  resumes: Resume[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  remove: (id: number) => Promise<void>;
  duplicate: (id: number) => Promise<void>;
}

export function useResumes(): UseResumesResult {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setResumes(await listResumes());
    } catch (err) {
      setError(getApiErrorMessage(err, 'We could not load your resumes. Please try again.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    listResumes()
      .then((data) => {
        if (!cancelled) setResumes(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'We could not load your resumes. Please try again.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const remove = useCallback(async (id: number): Promise<void> => {
    await deleteResume(id);
    setResumes((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const duplicate = useCallback(async (id: number): Promise<void> => {
    const copy = await duplicateResume(id);
    setResumes((prev) => [copy, ...prev]);
  }, []);

  return { resumes, loading, error, reload, remove, duplicate };
}
