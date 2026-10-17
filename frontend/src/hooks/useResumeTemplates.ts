import { useEffect, useState } from 'react';
import { listTemplatesForPicker } from '../services/resumeService';
import type { Template } from '../types';

/** Loads templates so previews can use the right font and accent colour. Failures are non-fatal. */
export function useResumeTemplates(): Template[] {
  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    let cancelled = false;
    listTemplatesForPicker()
      .then((data) => {
        if (!cancelled) setTemplates(data);
      })
      .catch(() => {
        // Preview falls back to a neutral style when templates cannot be loaded.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return templates;
}
