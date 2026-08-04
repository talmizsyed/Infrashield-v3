'use client';

import { useEffect, useState } from 'react';
import { getConsoleData } from '../services/console-service';
import type { ConsoleData } from '../types/console';

export function useConsoleData(): {
  data: ConsoleData | null;
  isLoading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<ConsoleData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setError(null);

    getConsoleData()
      .then((result) => {
        if (isMounted) {
          setData(result);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Unable to load console data.');
        }
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { data, isLoading, error };
}
