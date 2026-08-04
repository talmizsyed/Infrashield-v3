import type {
  InfrastructureDatabaseRow,
  InfrastructureOpenShiftData,
  InfrastructureOverviewData,
  InfrastructureServerRow,
  InfrastructureVirtualizationData,
} from '../types/infrastructure';

export async function getInfrastructureOverview(): Promise<InfrastructureOverviewData> {
  const response = await fetch('/api/infrastructure/overview');

  if (!response.ok) {
    throw new Error('Unable to load infrastructure overview.');
  }

  return (await response.json()) as InfrastructureOverviewData;
}

export async function getInfrastructureServers(): Promise<InfrastructureServerRow[]> {
  const response = await fetch('/api/infrastructure/servers');

  if (!response.ok) {
    throw new Error('Unable to load infrastructure servers.');
  }

  return (await response.json()) as InfrastructureServerRow[];
}

export async function getInfrastructureVirtualization(): Promise<InfrastructureVirtualizationData> {
  const response = await fetch('/api/infrastructure/virtualization');

  if (!response.ok) {
    throw new Error('Unable to load virtualization data.');
  }

  return (await response.json()) as InfrastructureVirtualizationData;
}

export async function getInfrastructureOpenShift(): Promise<InfrastructureOpenShiftData> {
  const response = await fetch('/api/infrastructure/openshift');

  if (!response.ok) {
    throw new Error('Unable to load OpenShift data.');
  }

  return (await response.json()) as InfrastructureOpenShiftData;
}

export async function getInfrastructureDatabases(): Promise<InfrastructureDatabaseRow[]> {
  const response = await fetch('/api/infrastructure/databases');

  if (!response.ok) {
    throw new Error('Unable to load database inventory.');
  }

  return (await response.json()) as InfrastructureDatabaseRow[];
}
