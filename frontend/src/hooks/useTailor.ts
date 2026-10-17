import { useCallback, useRef, useState } from 'react';
import { getApiErrorMessage } from '../services/resumeService';
import { analyzeTailor } from '../services/tailorService';
import type { TailorResult } from '../types/tailor';

interface UseTailorResult {
  result: TailorResult | null;
  loading: boolean;
  error: string | null;
  analyze: (jobDescription?: string) => Promise<void>;
}

export function useTailor(resumeId: number): UseTailorResult {
  const [result, setResult] = useState<TailorResult | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<number>(0);

  const analyze = useCallback(
    async (jobDescription?: string): Promise<void> => {
      latest.current += 1;
      const mine = latest.current;
      setLoading(true);
      setError(null);
      try {
        const data = await analyzeTailor(resumeId, jobDescription);
        if (mine === latest.current) setResult(data);
      } catch (err) {
        if (mine === latest.current) {
          setError(getApiErrorMessage(err, 'We could not analyze your resume. Please try again.'));
        }
      } finally {
        if (mine === latest.current) setLoading(false);
      }
    },
    [resumeId],
  );

  return { result, loading, error, analyze };
}
