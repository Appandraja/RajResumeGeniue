import { useCallback, useEffect, useState } from 'react';
import { getApiErrorMessage, getAtsCheck, getResume } from '../services/resumeService';
import type { AtsCheckResult, Resume } from '../types';

interface UseResumeResult {
  resume: Resume | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useResume(id: number | null): UseResumeResult {
  const [resume, setResume] = useState<Resume | null>(null);
  const [loading, setLoading] = useState<boolean>(id !== null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async (): Promise<void> => {
    if (id === null) return;
    setLoading(true);
    setError(null);
    try {
      setResume(await getResume(id));
    } catch (err) {
      setError(getApiErrorMessage(err, 'We could not load this resume.'));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id === null) return;
    let cancelled = false;
    getResume(id)
      .then((data) => {
        if (!cancelled) setResume(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'We could not load this resume.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return { resume, loading, error, reload };
}

interface UseAtsCheckResult {
  result: AtsCheckResult | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useAtsCheck(resumeId: number | null): UseAtsCheckResult {
  const [result, setResult] = useState<AtsCheckResult | null>(null);
  const [loading, setLoading] = useState<boolean>(resumeId !== null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (resumeId === null) return;
    setLoading(true);
    setError(null);
    try {
      setResult(await getAtsCheck(resumeId));
    } catch (err) {
      setError(getApiErrorMessage(err, 'We could not run the ATS check.'));
    } finally {
      setLoading(false);
    }
  }, [resumeId]);

  useEffect(() => {
    if (resumeId === null) return;
    let cancelled = false;
    getAtsCheck(resumeId)
      .then((data) => {
        if (!cancelled) setResult(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getApiErrorMessage(err, 'We could not run the ATS check.'));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [resumeId]);

  return { result, loading, error, refresh };
}
