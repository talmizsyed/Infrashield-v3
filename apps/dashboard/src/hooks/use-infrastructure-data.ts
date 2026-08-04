'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  getInfrastructureDatabases,
  getInfrastructureOpenShift,
  getInfrastructureOverview,
  getInfrastructureServers,
  getInfrastructureVirtualization,
} from '../services/infrastructure-service';
import type {
  InfrastructureDatabaseRow,
  InfrastructureOpenShiftData,
  InfrastructureOverviewData,
  InfrastructureServerRow,
  InfrastructureVirtualizationData,
} from '../types/infrastructure';

export function useInfrastructureData(): {
  overview: InfrastructureOverviewData | null;
  servers: InfrastructureServerRow[];
  virtualization: InfrastructureVirtualizationData | null;
  openshift: InfrastructureOpenShiftData | null;
  databases: InfrastructureDatabaseRow[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
} {
  const [overview, setOverview] = useState<InfrastructureOverviewData | null>(null);
  const [servers, setServers] = useState<InfrastructureServerRow[]>([]);
  const [virtualization, setVirtualization] = useState<InfrastructureVirtualizationData | null>(
    null,
  );
  const [openshift, setOpenshift] = useState<InfrastructureOpenShiftData | null>(null);
  const [databases, setDatabases] = useState<InfrastructureDatabaseRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => {
    let isCanceled = false;
    setIsLoading(true);
    setError(null);

    Promise.all([
      getInfrastructureOverview(),
      getInfrastructureServers(),
      getInfrastructureVirtualization(),
      getInfrastructureOpenShift(),
      getInfrastructureDatabases(),
    ])
      .then(([overviewData, serverData, virtualizationData, openshiftData, databaseData]) => {
        if (!isCanceled) {
          setOverview(overviewData);
          setServers(serverData);
          setVirtualization(virtualizationData);
          setOpenshift(openshiftData);
          setDatabases(databaseData);
        }
      })
      .catch((err) => {
        if (!isCanceled) {
          setError(err instanceof Error ? err.message : 'Unable to load infrastructure data.');
        }
      })
      .finally(() => {
        if (!isCanceled) {
          setIsLoading(false);
        }
      });

    return () => {
      isCanceled = true;
    };
  };

  useEffect(() => {
    return refresh();
  }, []);

  const refetch = useMemo(() => () => refresh(), []);

  return {
    overview,
    servers,
    virtualization,
    openshift,
    databases,
    isLoading,
    error,
    refetch,
  };
}
