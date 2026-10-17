import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { listTemplates } from '../services/templateService';
import type { Template } from '../types';

interface ApiErrorBody {
  error?: { code?: string; message?: string };
}

interface UseTemplatesResult {
  data: Template[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function getErrorMessage(err: unknown): string {
  if (isAxiosError<ApiErrorBody>(err)) {
    return err.response?.data?.error?.message ?? err.message;
  }
  return err instanceof Error ? err.message : 'Something went wrong';
}

export function useTemplates(): UseTemplatesResult {
  const [data, setData] = useState<Template[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState<number>(0);

  useEffect(() => {
    let cancelled = false;
    listTemplates()
      .then((items) => {
        if (!cancelled) setData(items);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    setNonce((n) => n + 1);
  }, []);

  return { data, loading, error, refetch };
}
