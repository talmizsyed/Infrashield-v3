'use client';

import { useEffect, useState } from 'react';
import { getExecutiveDashboardData } from '../services/executive-dashboard-service';
import type { ExecutiveDashboardData } from '../types/executive-dashboard';

export function useExecutiveDashboardData(): {
  data: ExecutiveDashboardData | null;
  isLoading: boolean;
  error: string | null;
} {
  const [data, setData] = useState<ExecutiveDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void getExecutiveDashboardData()
      .then((result) => {
        if (isMounted) {
          setData(result);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (isMounted) {
          setError(
            reason instanceof Error ? reason.message : 'Unable to load executive dashboard data.',
          );
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
