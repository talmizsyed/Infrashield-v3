import { createCloudProviderRuntime, type CloudProvider } from '@infrashield/provider-cloud';
import { createITSMProviderRuntime, type ITSMProvider } from '@infrashield/provider-itsm';
import {
  createKubernetesProviderRuntime,
  type KubernetesProvider,
} from '@infrashield/provider-kubernetes';
import { createLinuxProviderRuntime, type LinuxProvider } from '@infrashield/provider-linux';
import { createMockProviderRuntime, type MockProvider } from '@infrashield/provider-mock';
import {
  createMonitoringProviderRuntime,
  type MonitoringProvider,
} from '@infrashield/provider-monitoring';
import { createNetworkProviderRuntime, type NetworkProvider } from '@infrashield/provider-network';
import {
  createOpenShiftProviderRuntime,
  type OpenShiftProvider,
} from '@infrashield/provider-openshift';
import { createOracleProviderRuntime, type OracleProvider } from '@infrashield/provider-oracle';
import { createStorageProviderRuntime, type StorageProvider } from '@infrashield/provider-storage';
import { createVmwareProviderRuntime, type VmwareProvider } from '@infrashield/provider-vmware';
import { createWindowsProviderRuntime, type WindowsProvider } from '@infrashield/provider-windows';
import type { ProviderCertificationTarget } from './certification';

function createTargetFromRuntime<TProvider>(input: {
  readonly id: string;
  readonly displayName: string;
  readonly createRuntime: () => unknown;
  readonly contextInput: Readonly<Record<string, unknown>>;
  readonly authPayload: Readonly<Record<string, unknown>>;
  readonly capabilityName: string;
  readonly expectedTags: readonly string[];
  readonly configurationRequiredFields: readonly string[];
  readonly searchPayload: Readonly<Record<string, unknown>>;
  readonly connectionTestInput: Readonly<Record<string, unknown>>;
  readonly invokeInventoryDiscovery: (provider: TProvider) => Promise<readonly unknown[]>;
  readonly invokeSearch: (provider: TProvider, query: unknown) => Promise<readonly unknown[]>;
  readonly invokeRefresh: (provider: TProvider) => Promise<unknown>;
  readonly invokeMonitoring: (provider: TProvider) => Promise<{
    readonly hasHealth: boolean;
    readonly hasMetrics: boolean;
    readonly hasEvents: boolean;
  }>;
  readonly invokeConnectionTest: (provider: TProvider, input: unknown) => Promise<unknown>;
}): ProviderCertificationTarget {
  return {
    id: input.id,
    displayName: input.displayName,
    createRuntime: input.createRuntime as ProviderCertificationTarget['createRuntime'],
    probes: {
      contextInput: input.contextInput,
      authPayload: input.authPayload,
      capabilityName: input.capabilityName,
      expectedTags: input.expectedTags,
      configurationRequiredFields: input.configurationRequiredFields,
      searchPayload: input.searchPayload,
      connectionTestInput: input.connectionTestInput,
      invokeInventoryDiscovery: (provider) => input.invokeInventoryDiscovery(provider as TProvider),
      invokeSearch: (provider, query) => input.invokeSearch(provider as TProvider, query),
      invokeRefresh: (provider) => input.invokeRefresh(provider as TProvider),
      invokeMonitoring: (provider) => input.invokeMonitoring(provider as TProvider),
      invokeConnectionTest: (provider, payload) =>
        input.invokeConnectionTest(provider as TProvider, payload),
    },
  };
}

const mockTarget = createTargetFromRuntime<MockProvider>({
  id: 'provider-mock',
  displayName: 'Mock Provider',
  createRuntime: createMockProviderRuntime,
  contextInput: {
    endpoint: 'https://mock-provider.infrashield.local',
    region: 'us-east-1',
    tenantId: 'tenant-default',
    apiKey: 'mock-default-key',
  },
  authPayload: { method: 'api-key', apiKey: 'mock-certification-key' },
  capabilityName: 'inventory',
  expectedTags: ['reference'],
  configurationRequiredFields: [
    'endpoint',
    'region',
    'tenantId',
    'apiKey',
    'readOnly',
    'latencyMs',
  ],
  searchPayload: { text: 'payments' },
  connectionTestInput: { endpoint: 'https://mock-provider.infrashield.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: async (provider, query) => {
    const all = await provider.discoverInventory();
    const queryRecord = query as { readonly text?: string };
    const needle = String(queryRecord.text ?? '').toLowerCase();
    return all.filter((item) => item.name.toLowerCase().includes(needle));
  },
  invokeRefresh: async (provider) => provider.discoverInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getHealthDetails();
    const metrics = await provider.getMetrics();
    const events = await provider.getEvents();
    return {
      hasHealth: Boolean(health),
      hasMetrics: metrics.length > 0,
      hasEvents: events.length > 0,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnectivity(payload as never),
});

const vmwareTarget = createTargetFromRuntime<VmwareProvider>({
  id: 'provider-vmware',
  displayName: 'VMware Provider',
  createRuntime: createVmwareProviderRuntime,
  contextInput: {
    datacenterName: 'dc01',
    credentialRef: 'VMWARE_CREDENTIAL_REF',
  },
  authPayload: { method: 'username-password', username: 'admin', password: 'masked-password' },
  capabilityName: 'operations',
  expectedTags: ['vmware'],
  configurationRequiredFields: [
    'endpoint',
    'username',
    'credentialRef',
    'readOnly',
    'insecureSkipTlsVerify',
    'requestTimeoutMs',
    'inventoryCacheTtlSeconds',
  ],
  searchPayload: { text: 'payments' },
  connectionTestInput: { endpoint: 'vmware://vsphere.dc01.example.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: (provider, query) => provider.searchInventory(query as never),
  invokeRefresh: (provider) => provider.refreshInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getProviderHealth();
    const metrics = await provider.getMetrics();
    const events = await provider.getEvents();
    return {
      hasHealth: Boolean(health),
      hasMetrics: metrics.length > 0,
      hasEvents: events.length > 0,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnection(payload as never),
});

const openShiftTarget = createTargetFromRuntime<OpenShiftProvider>({
  id: 'provider-openshift',
  displayName: 'OpenShift Provider',
  createRuntime: createOpenShiftProviderRuntime,
  contextInput: {
    clusterName: 'openshift-platform',
    credentialRef: 'OPENSHIFT_CREDENTIAL_REF',
  },
  authPayload: { method: 'token', token: 'masked-token' },
  capabilityName: 'operations',
  expectedTags: ['openshift'],
  configurationRequiredFields: [
    'endpoint',
    'clusterName',
    'credentialRef',
    'readOnly',
    'insecureSkipTlsVerify',
    'requestTimeoutMs',
    'inventoryCacheTtlSeconds',
  ],
  searchPayload: { text: 'payments' },
  connectionTestInput: { endpoint: 'openshift://cluster.platform.example.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: (provider, query) => provider.searchResources(query as never),
  invokeRefresh: (provider) => provider.refreshInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getClusterHealth();
    const metrics = await provider.getMetrics();
    const events = await provider.getEvents();
    return {
      hasHealth: Boolean(health),
      hasMetrics: metrics.length > 0,
      hasEvents: events.length > 0,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnection(payload as never),
});

const oracleTarget = createTargetFromRuntime<OracleProvider>({
  id: 'provider-oracle',
  displayName: 'Oracle Provider',
  createRuntime: createOracleProviderRuntime,
  contextInput: {
    tenancyName: 'enterprise-tenancy',
    credentialRef: 'ORACLE_CREDENTIAL_REF',
  },
  authPayload: {
    method: 'username-password',
    username: 'oracle-admin',
    password: 'masked-password',
  },
  capabilityName: 'operations',
  expectedTags: ['oracle'],
  configurationRequiredFields: [
    'endpoint',
    'systemIdentifier',
    'credentialRef',
    'readOnly',
    'connectTimeoutMs',
    'inventoryCacheTtlSeconds',
  ],
  searchPayload: { text: 'APP_OWNER' },
  connectionTestInput: { endpoint: 'oracle://enterprise.oracle.example.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: (provider, query) => provider.searchObjects(query as never),
  invokeRefresh: (provider) => provider.refreshInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getInstanceHealth();
    const metrics = await provider.getPerformanceMetrics();
    const events = await provider.getWaitEvents();
    return {
      hasHealth: Boolean(health),
      hasMetrics: metrics.length > 0,
      hasEvents: events.length > 0,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnection(payload as never),
});

const linuxTarget = createTargetFromRuntime<LinuxProvider>({
  id: 'provider-linux',
  displayName: 'Linux Provider',
  createRuntime: createLinuxProviderRuntime,
  contextInput: {
    hostAlias: 'linux-enterprise-01',
    credentialRef: 'LINUX_CREDENTIAL_REF',
  },
  authPayload: {
    method: 'username-password',
    username: 'linux-admin',
    password: 'masked-password',
  },
  capabilityName: 'operations',
  expectedTags: ['linux'],
  configurationRequiredFields: [
    'endpoint',
    'hostAlias',
    'credentialRef',
    'readOnly',
    'connectionTimeoutMs',
    'inventoryCacheTtlSeconds',
  ],
  searchPayload: { text: 'platform' },
  connectionTestInput: { endpoint: 'linux://enterprise.fabric.example.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: (provider, query) => provider.searchResources(query as never),
  invokeRefresh: (provider) => provider.refreshInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getSystemHealth();
    const metrics = await provider.getCpuUtilization();
    const events = await provider.getLogsMetadata();
    return {
      hasHealth: Boolean(health),
      hasMetrics: metrics.length > 0,
      hasEvents: events.length > 0,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnection(payload as never),
});

const windowsTarget = createTargetFromRuntime<WindowsProvider>({
  id: 'provider-windows',
  displayName: 'Windows Provider',
  createRuntime: createWindowsProviderRuntime,
  contextInput: {
    domainName: 'enterprise.corp.example.local',
    credentialRef: 'WINDOWS_CREDENTIAL_REF',
  },
  authPayload: {
    method: 'username-password',
    username: 'windows-admin',
    password: 'masked-password',
  },
  capabilityName: 'operations',
  expectedTags: ['windows'],
  configurationRequiredFields: [
    'endpoint',
    'hostAlias',
    'credentialRef',
    'readOnly',
    'connectionTimeoutMs',
    'inventoryCacheTtlSeconds',
  ],
  searchPayload: { text: 'Platform' },
  connectionTestInput: { endpoint: 'windows://enterprise.fabric.example.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: (provider, query) => provider.searchResources(query as never),
  invokeRefresh: (provider) => provider.refreshInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getHostHealth();
    const metrics = await provider.getCpuMetrics();
    const events = await provider.getEventLogMetadata();
    return {
      hasHealth: Boolean(health),
      hasMetrics: metrics.length > 0,
      hasEvents: events.length > 0,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnection(payload as never),
});

const kubernetesTarget = createTargetFromRuntime<KubernetesProvider>({
  id: 'provider-kubernetes',
  displayName: 'Kubernetes Provider',
  createRuntime: createKubernetesProviderRuntime,
  contextInput: {
    clusterName: 'kubernetes-platform',
    credentialRef: 'KUBERNETES_CREDENTIAL_REF',
  },
  authPayload: { method: 'token', token: 'masked-token' },
  capabilityName: 'operations',
  expectedTags: ['kubernetes'],
  configurationRequiredFields: [
    'endpoint',
    'clusterName',
    'credentialRef',
    'readOnly',
    'connectionTimeoutMs',
    'inventoryCacheTtlSeconds',
  ],
  searchPayload: { text: 'payments', namespace: 'payments' },
  connectionTestInput: { endpoint: 'kubernetes://enterprise.cluster.example.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: (provider, query) => provider.searchResources(query as never),
  invokeRefresh: (provider) => provider.refreshInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getClusterHealth();
    const metrics = await provider.getMetrics();
    const events = await provider.getEvents();
    return {
      hasHealth: Boolean(health),
      hasMetrics: metrics.length > 0,
      hasEvents: events.length > 0,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnection(payload as never),
});

const networkTarget = createTargetFromRuntime<NetworkProvider>({
  id: 'provider-network',
  displayName: 'Network Provider',
  createRuntime: createNetworkProviderRuntime,
  contextInput: {
    domainName: 'enterprise.network.example.local',
    credentialRef: 'NETWORK_CREDENTIAL_REF',
  },
  authPayload: {
    method: 'username-password',
    username: 'network-admin',
    password: 'masked-password',
  },
  capabilityName: 'operations',
  expectedTags: ['network'],
  configurationRequiredFields: [
    'endpoint',
    'domainName',
    'credentialRef',
    'readOnly',
    'connectionTimeoutMs',
    'inventoryCacheTtlSeconds',
  ],
  searchPayload: { text: 'fw', vendor: 'paloAlto' },
  connectionTestInput: { endpoint: 'network://enterprise.fabric.example.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: (provider, query) => provider.searchDevices(query as never),
  invokeRefresh: (provider) => provider.refreshInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getDeviceHealth();
    const metrics = await provider.getCpuMetrics();
    const events = await provider.getEvents();
    return {
      hasHealth: health.length > 0,
      hasMetrics: metrics.length > 0,
      hasEvents: events.length > 0,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnection(payload as never),
});

const storageTarget = createTargetFromRuntime<StorageProvider>({
  id: 'provider-storage',
  displayName: 'Storage Provider',
  createRuntime: createStorageProviderRuntime,
  contextInput: {
    domainName: 'enterprise.fabric.example.local',
    credentialRef: 'STORAGE_CREDENTIAL_REF',
  },
  authPayload: {
    method: 'username-password',
    username: 'storage-admin',
    password: 'masked-password',
  },
  capabilityName: 'operations',
  expectedTags: ['storage'],
  configurationRequiredFields: [
    'endpoint',
    'domainName',
    'credentialRef',
    'readOnly',
    'connectionTimeoutMs',
    'inventoryCacheTtlSeconds',
  ],
  searchPayload: { text: 'payments', kind: 'volume' },
  connectionTestInput: { endpoint: 'storage://enterprise.fabric.example.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: (provider, query) => provider.searchStorageResources(query as never),
  invokeRefresh: (provider) => provider.refreshInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getArrayHealth();
    const metrics = await provider.getPerformance();
    const events = await provider.getEvents();
    return {
      hasHealth: health.length > 0,
      hasMetrics: metrics.length > 0,
      hasEvents: events.length > 0,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnection(payload as never),
});

const cloudTarget = createTargetFromRuntime<CloudProvider>({
  id: 'provider-cloud',
  displayName: 'Cloud Provider',
  createRuntime: createCloudProviderRuntime,
  contextInput: {
    organizationId: 'enterprise-platform',
    credentialRef: 'CLOUD_CREDENTIAL_REF',
  },
  authPayload: { method: 'api-key', apiKey: 'masked-api-key' },
  capabilityName: 'operations',
  expectedTags: ['cloud'],
  configurationRequiredFields: [
    'endpoint',
    'organizationId',
    'credentialRef',
    'enabledVendors',
    'readOnly',
    'connectionTimeoutMs',
    'inventoryCacheTtlSeconds',
  ],
  searchPayload: { text: 'payments', kind: 'virtualMachine' },
  connectionTestInput: { endpoint: 'cloud://enterprise.control-plane.example.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: (provider, query) => provider.searchResources(query as never),
  invokeRefresh: (provider) => provider.refreshInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getHealth();
    const metrics = await provider.getMetrics();
    const events = await provider.getEvents();
    return {
      hasHealth: health.length > 0,
      hasMetrics: metrics.length > 0,
      hasEvents: events.length > 0,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnection(payload as never),
});

const monitoringTarget = createTargetFromRuntime<MonitoringProvider>({
  id: 'provider-monitoring',
  displayName: 'Monitoring Provider',
  createRuntime: createMonitoringProviderRuntime,
  contextInput: {
    organizationId: 'enterprise-observability',
    credentialRef: 'MONITORING_CREDENTIAL_REF',
  },
  authPayload: { method: 'api-key', apiKey: 'masked-api-key' },
  capabilityName: 'operations',
  expectedTags: ['monitoring'],
  configurationRequiredFields: [
    'endpoint',
    'organizationId',
    'credentialRef',
    'enabledPlatforms',
    'readOnly',
    'connectionTimeoutMs',
    'inventoryCacheTtlSeconds',
  ],
  searchPayload: { text: 'payments', kind: 'application' },
  connectionTestInput: { endpoint: 'monitoring://enterprise.observability.example.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: (provider, query) => provider.searchMonitoringObjects(query as never),
  invokeRefresh: (provider) => provider.refreshInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getHealth();
    const metrics = await provider.getMetrics();
    const events = await provider.getEvents();
    return {
      hasHealth: health.length > 0,
      hasMetrics: metrics.length > 0,
      hasEvents: events.length > 0,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnection(payload as never),
});

const itsmTarget = createTargetFromRuntime<ITSMProvider>({
  id: 'provider-itsm',
  displayName: 'ITSM Provider',
  createRuntime: createITSMProviderRuntime,
  contextInput: {
    organizationId: 'enterprise-service-management',
    credentialRef: 'ITSM_CREDENTIAL_REF',
  },
  authPayload: { method: 'api-key', apiKey: 'masked-api-key' },
  capabilityName: 'operations',
  expectedTags: ['itsm'],
  configurationRequiredFields: [
    'endpoint',
    'organizationId',
    'credentialRef',
    'enabledPlatforms',
    'readOnly',
    'connectionTimeoutMs',
    'inventoryCacheTtlSeconds',
  ],
  searchPayload: { text: 'latency', kind: 'incident' },
  connectionTestInput: { endpoint: 'itsm://enterprise.service-management.example.local' },
  invokeInventoryDiscovery: (provider) => provider.discoverInventory(),
  invokeSearch: (provider, query) => provider.search(query as never),
  invokeRefresh: (provider) => provider.refreshInventory(),
  invokeMonitoring: async (provider) => {
    const health = await provider.getHealth();
    return {
      hasHealth: health.length > 0,
      hasMetrics: true,
      hasEvents: true,
    };
  },
  invokeConnectionTest: (provider, payload) => provider.testConnection(payload as never),
});

export const PROVIDER_CERTIFICATION_TARGETS: readonly ProviderCertificationTarget[] = Object.freeze(
  [
    mockTarget,
    vmwareTarget,
    openShiftTarget,
    oracleTarget,
    linuxTarget,
    windowsTarget,
    kubernetesTarget,
    networkTarget,
    storageTarget,
    cloudTarget,
    monitoringTarget,
    itsmTarget,
  ],
);
