'use client';

import { useEffect, useState } from 'react';
import type { PlatformConfiguration } from '@infrashield/platform-configuration';

export function usePlatformConfiguration(): {
  configuration: PlatformConfiguration | null;
  isLoading: boolean;
  error: string | null;
} {
  const [configuration, setConfiguration] = useState<PlatformConfiguration | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void fetch('/api/configuration', { headers: { Accept: 'application/json' } })
      .then(async (response) => {
        if (!response.ok) throw new Error('Unable to load platform configuration.');
        return (await response.json()) as PlatformConfiguration;
      })
      .then((result) => {
        if (isMounted) setConfiguration(result);
      })
      .catch((reason: unknown) => {
        if (isMounted) {
          setError(
            reason instanceof Error ? reason.message : 'Unable to load platform configuration.',
          );
        }
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  return { configuration, isLoading, error };
}
