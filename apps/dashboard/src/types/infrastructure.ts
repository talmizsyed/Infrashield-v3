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
  datacenter: string;
  os: string;
}

export interface InfrastructureVirtualizationData {
  vmware: string;
  vCenter: string;
  esxiHosts: number;
  clusters: number;
  datastores: number;
  vmCount: number;
}

export interface InfrastructureOpenShiftData {
  clusters: number;
  namespaces: number;
  projects: number;
  pods: number;
  deployments: number;
  operators: number;
  nodeHealth: number;
}

export interface InfrastructureDatabaseRow {
  name: string;
  environment: string;
  status: string;
  version: string;
  backupStatus: string;
}
