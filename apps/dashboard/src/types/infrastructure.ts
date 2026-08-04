export interface InfrastructureOverviewData {
  totalAssets: number;
  healthyAssets: number;
  unhealthyAssets: number;
  maintenanceAssets: number;
  discoveryCoverage: number;
  lastDiscovery: string;
}

export interface InfrastructureServerRow {
  hostname: string;
  ip: string;
  environment: string;
  cpu: string;
  memory: string;
  disk: string;
  status: 'healthy' | 'warning' | 'critical' | 'maintenance';
  owner: string;
  location: string;
  os: string;
}

export interface InfrastructureVirtualizationData {
  vCenters: number;
  clusters: number;
  hosts: number;
  virtualMachines: number;
  datastores: number;
  clusterHealth: number;
}

export interface InfrastructureOpenShiftData {
  clusters: number;
  namespaces: number;
  projects: number;
  pods: number;
  nodes: number;
  operators: number;
  alerts: number;
}

export interface InfrastructureDatabaseRow {
  name: string;
  version: string;
  health: string;
  backupStatus: string;
}
