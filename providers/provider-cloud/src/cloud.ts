import type { SerializableValueObject } from '@infrashield/contracts';
import { ToolCapability } from '@infrashield/ai-tools';
import {
  AuthenticationResult,
  BaseProvider,
  CapabilityDefinition,
  CapabilityMetadata,
  CapabilityResolver,
  CapabilityValidator,
  CapabilityVersion,
  ConnectionFactory,
  ConnectionHealth,
  ConnectionPool,
  CredentialStore,
  ProviderAuthentication,
  ProviderCapabilities,
  ProviderCapabilityRegistry,
  ProviderConfiguration,
  ProviderConnection,
  ProviderConnectionManager,
  ProviderHealthMonitor,
  ProviderLifecycleManager,
  ProviderManifest,
  ProviderMetadata,
  ProviderRecovery,
  ProviderRegistryService,
  ProviderShutdown,
  ProviderStartup,
  ProviderVersion,
} from '@infrashield/providers';

export type CloudVendor = 'aws' | 'azure' | 'gcp';

export type CloudResourceKind =
  | 'account'
  | 'subscription'
  | 'project'
  | 'region'
  | 'availabilityZone'
  | 'virtualMachine'
  | 'autoScalingGroup'
  | 'image'
  | 'instanceType'
  | 'blockStorage'
  | 'objectStorage'
  | 'fileStorage'
  | 'virtualNetwork'
  | 'subnet'
  | 'routeTable'
  | 'securityGroup'
  | 'loadBalancer'
  | 'publicIp'
  | 'kubernetesCluster'
  | 'containerRegistry'
  | 'iamUser'
  | 'role'
  | 'policy'
  | 'serviceAccount';

export interface CloudProviderConfiguration extends SerializableValueObject {
  readonly endpoint: string;
  readonly organizationId: string;
  readonly credentialRef: string;
  readonly enabledVendors: readonly CloudVendor[];
  readonly readOnly: boolean;
  readonly connectionTimeoutMs: number;
  readonly inventoryCacheTtlSeconds: number;
}

export interface CloudInventoryResource {
  readonly id: string;
  readonly kind: CloudResourceKind;
  readonly vendor: CloudVendor;
  readonly name: string;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface CloudProviderAbstraction {
  readonly vendor: CloudVendor;
  readonly metadata: Readonly<Record<string, string>>;
}

export interface CloudHealth {
  readonly scopeName: string;
  readonly vendor: CloudVendor;
  readonly healthy: boolean;
  readonly status: 'healthy' | 'degraded' | 'down';
  readonly checkedAt: string;
}

export interface CloudMetric {
  readonly scopeName: string;
  readonly metricName: string;
  readonly value: number;
  readonly unit: string;
  readonly checkedAt: string;
}

export interface CloudAlert {
  readonly id: string;
  readonly source: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly summary: string;
  readonly timestamp: string;
}

export interface CloudEvent {
  readonly id: string;
  readonly source: string;
  readonly severity: 'info' | 'warning' | 'critical';
  readonly message: string;
  readonly timestamp: string;
}

export interface CloudResourceUtilization {
  readonly resourceName: string;
  readonly cpuPercent: number;
  readonly memoryPercent: number;
  readonly networkPercent: number;
  readonly checkedAt: string;
}

export interface CloudCostMetadata {
  readonly scopeName: string;
  readonly vendor: CloudVendor;
  readonly currency: string;
  readonly monthlyCostEstimate: number;
  readonly costCenter: string;
  readonly checkedAt: string;
}

export interface CloudConnectionTestResult {
  readonly connected: boolean;
  readonly latencyMs: number;
  readonly message: string;
}

export interface CloudCapabilityDescriptor {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly category:
    | 'discovery'
    | 'compute'
    | 'storage'
    | 'networking'
    | 'containers'
    | 'identity'
    | 'monitoring'
    | 'operations';
}

export interface CloudSearchQuery {
  readonly text: string;
  readonly vendor?: CloudVendor;
  readonly kind?: CloudResourceKind;
}

export interface CloudInventoryCacheSnapshot {
  readonly resources: readonly CloudInventoryResource[];
  readonly refreshedAt?: string;
}

export interface ICloudAdapter {
  discoverProviders(): Promise<readonly CloudProviderAbstraction[]>;
  discoverAccounts(): Promise<readonly CloudInventoryResource[]>;
  discoverSubscriptions(): Promise<readonly CloudInventoryResource[]>;
  discoverProjects(): Promise<readonly CloudInventoryResource[]>;
  discoverRegions(): Promise<readonly CloudInventoryResource[]>;
  discoverAvailabilityZones(): Promise<readonly CloudInventoryResource[]>;
  discoverVirtualMachines(): Promise<readonly CloudInventoryResource[]>;
  discoverAutoScalingGroups(): Promise<readonly CloudInventoryResource[]>;
  discoverImages(): Promise<readonly CloudInventoryResource[]>;
  discoverInstanceTypes(): Promise<readonly CloudInventoryResource[]>;
  discoverBlockStorage(): Promise<readonly CloudInventoryResource[]>;
  discoverObjectStorage(): Promise<readonly CloudInventoryResource[]>;
  discoverFileStorage(): Promise<readonly CloudInventoryResource[]>;
  discoverVirtualNetworks(): Promise<readonly CloudInventoryResource[]>;
  discoverSubnets(): Promise<readonly CloudInventoryResource[]>;
  discoverRouteTables(): Promise<readonly CloudInventoryResource[]>;
  discoverSecurityGroups(): Promise<readonly CloudInventoryResource[]>;
  discoverLoadBalancers(): Promise<readonly CloudInventoryResource[]>;
  discoverPublicIps(): Promise<readonly CloudInventoryResource[]>;
  discoverKubernetesClusters(): Promise<readonly CloudInventoryResource[]>;
  discoverContainerRegistries(): Promise<readonly CloudInventoryResource[]>;
  discoverIamUsers(): Promise<readonly CloudInventoryResource[]>;
  discoverRoles(): Promise<readonly CloudInventoryResource[]>;
  discoverPolicies(): Promise<readonly CloudInventoryResource[]>;
  discoverServiceAccounts(): Promise<readonly CloudInventoryResource[]>;
  getHealth(): Promise<readonly CloudHealth[]>;
  getMetrics(): Promise<readonly CloudMetric[]>;
  getAlerts(): Promise<readonly CloudAlert[]>;
  getEvents(): Promise<readonly CloudEvent[]>;
  getResourceUtilization(): Promise<readonly CloudResourceUtilization[]>;
  getCostMetadata(): Promise<readonly CloudCostMetadata[]>;
  refreshInventory(): Promise<{ readonly refreshedAt: string }>;
  testConnection(
    configuration: Readonly<CloudProviderConfiguration>,
  ): Promise<CloudConnectionTestResult>;
  discoverCapabilities(): Promise<readonly CloudCapabilityDescriptor[]>;
  searchResources(query: CloudSearchQuery): Promise<readonly CloudInventoryResource[]>;
}

const DATASET_TIMESTAMP = '2026-01-01T00:00:00.000Z';

function metadata(values: Record<string, string>): Readonly<Record<string, string>> {
  return values;
}

function vendorList(...vendors: readonly CloudVendor[]): readonly CloudVendor[] {
  return Object.freeze([...vendors]);
}

const MOCK_PROVIDERS: readonly CloudProviderAbstraction[] = Object.freeze([
  {
    vendor: 'aws',
    metadata: metadata({ family: 'amazon-web-services', controlPlane: 'global' }),
  },
  {
    vendor: 'azure',
    metadata: metadata({ family: 'microsoft-azure', controlPlane: 'global' }),
  },
  {
    vendor: 'gcp',
    metadata: metadata({ family: 'google-cloud-platform', controlPlane: 'global' }),
  },
]);

const MOCK_INVENTORY: readonly CloudInventoryResource[] = Object.freeze([
  {
    id: 'aws-account-001',
    kind: 'account',
    vendor: 'aws',
    name: 'aws-enterprise-root',
    metadata: metadata({ organizationUnit: 'platform', partition: 'aws' }),
  },
  {
    id: 'azure-subscription-001',
    kind: 'subscription',
    vendor: 'azure',
    name: 'azure-enterprise-subscription',
    metadata: metadata({ tenant: 'infra-enterprise', managementGroup: 'platform' }),
  },
  {
    id: 'gcp-project-001',
    kind: 'project',
    vendor: 'gcp',
    name: 'gcp-enterprise-project',
    metadata: metadata({ folder: 'platform', billingAccount: 'BILL-001' }),
  },
  {
    id: 'region-aws-use1',
    kind: 'region',
    vendor: 'aws',
    name: 'us-east-1',
    metadata: metadata({ geography: 'north-america' }),
  },
  {
    id: 'region-azure-eus',
    kind: 'region',
    vendor: 'azure',
    name: 'eastus',
    metadata: metadata({ geography: 'north-america' }),
  },
  {
    id: 'region-gcp-usc1',
    kind: 'region',
    vendor: 'gcp',
    name: 'us-central1',
    metadata: metadata({ geography: 'north-america' }),
  },
  {
    id: 'az-aws-use1a',
    kind: 'availabilityZone',
    vendor: 'aws',
    name: 'us-east-1a',
    metadata: metadata({ parentRegion: 'us-east-1' }),
  },
  {
    id: 'az-azure-eus-1',
    kind: 'availabilityZone',
    vendor: 'azure',
    name: 'eastus-1',
    metadata: metadata({ parentRegion: 'eastus' }),
  },
  {
    id: 'az-gcp-usc1-a',
    kind: 'availabilityZone',
    vendor: 'gcp',
    name: 'us-central1-a',
    metadata: metadata({ parentRegion: 'us-central1' }),
  },
  {
    id: 'vm-aws-1',
    kind: 'virtualMachine',
    vendor: 'aws',
    name: 'ec2-payments-01',
    metadata: metadata({ region: 'us-east-1', size: 'm6i.large', image: 'ami-0123456789' }),
  },
  {
    id: 'vm-azure-1',
    kind: 'virtualMachine',
    vendor: 'azure',
    name: 'vm-payments-az-01',
    metadata: metadata({ region: 'eastus', size: 'Standard_D4s_v5', image: 'ubuntu-22-lts' }),
  },
  {
    id: 'vm-gcp-1',
    kind: 'virtualMachine',
    vendor: 'gcp',
    name: 'gce-payments-01',
    metadata: metadata({ region: 'us-central1', size: 'e2-standard-4', image: 'debian-12' }),
  },
  {
    id: 'asg-aws-1',
    kind: 'autoScalingGroup',
    vendor: 'aws',
    name: 'asg-payments',
    metadata: metadata({ desired: '4', min: '2', max: '8' }),
  },
  {
    id: 'img-aws-1',
    kind: 'image',
    vendor: 'aws',
    name: 'ami-enterprise-baseline',
    metadata: metadata({ family: 'linux', version: '2026.01' }),
  },
  {
    id: 'img-azure-1',
    kind: 'image',
    vendor: 'azure',
    name: 'sig-enterprise-baseline',
    metadata: metadata({ family: 'linux', version: '2026.01' }),
  },
  {
    id: 'img-gcp-1',
    kind: 'image',
    vendor: 'gcp',
    name: 'gcp-enterprise-baseline',
    metadata: metadata({ family: 'linux', version: '2026.01' }),
  },
  {
    id: 'it-aws-1',
    kind: 'instanceType',
    vendor: 'aws',
    name: 'm6i.large',
    metadata: metadata({ vcpu: '2', memoryGb: '8' }),
  },
  {
    id: 'it-azure-1',
    kind: 'instanceType',
    vendor: 'azure',
    name: 'Standard_D4s_v5',
    metadata: metadata({ vcpu: '4', memoryGb: '16' }),
  },
  {
    id: 'it-gcp-1',
    kind: 'instanceType',
    vendor: 'gcp',
    name: 'e2-standard-4',
    metadata: metadata({ vcpu: '4', memoryGb: '16' }),
  },
  {
    id: 'blk-aws-1',
    kind: 'blockStorage',
    vendor: 'aws',
    name: 'ebs-payments-01',
    metadata: metadata({ sizeGb: '1024', class: 'gp3' }),
  },
  {
    id: 'blk-azure-1',
    kind: 'blockStorage',
    vendor: 'azure',
    name: 'disk-payments-01',
    metadata: metadata({ sizeGb: '1024', class: 'PremiumSSD' }),
  },
  {
    id: 'blk-gcp-1',
    kind: 'blockStorage',
    vendor: 'gcp',
    name: 'pd-payments-01',
    metadata: metadata({ sizeGb: '1024', class: 'pd-ssd' }),
  },
  {
    id: 'obj-aws-1',
    kind: 'objectStorage',
    vendor: 'aws',
    name: 's3-enterprise-logs',
    metadata: metadata({ class: 'standard', encryption: 'kms' }),
  },
  {
    id: 'obj-azure-1',
    kind: 'objectStorage',
    vendor: 'azure',
    name: 'blob-enterprise-logs',
    metadata: metadata({ class: 'hot', encryption: 'cmk' }),
  },
  {
    id: 'obj-gcp-1',
    kind: 'objectStorage',
    vendor: 'gcp',
    name: 'gcs-enterprise-logs',
    metadata: metadata({ class: 'standard', encryption: 'csek' }),
  },
  {
    id: 'fs-aws-1',
    kind: 'fileStorage',
    vendor: 'aws',
    name: 'efs-analytics',
    metadata: metadata({ protocol: 'nfs', throughputMode: 'bursting' }),
  },
  {
    id: 'fs-azure-1',
    kind: 'fileStorage',
    vendor: 'azure',
    name: 'azure-files-analytics',
    metadata: metadata({ protocol: 'smb', sku: 'Premium_LRS' }),
  },
  {
    id: 'fs-gcp-1',
    kind: 'fileStorage',
    vendor: 'gcp',
    name: 'filestore-analytics',
    metadata: metadata({ protocol: 'nfs', tier: 'enterprise' }),
  },
  {
    id: 'vnet-aws-1',
    kind: 'virtualNetwork',
    vendor: 'aws',
    name: 'vpc-enterprise-core',
    metadata: metadata({ cidr: '10.20.0.0/16' }),
  },
  {
    id: 'vnet-azure-1',
    kind: 'virtualNetwork',
    vendor: 'azure',
    name: 'vnet-enterprise-core',
    metadata: metadata({ cidr: '10.30.0.0/16' }),
  },
  {
    id: 'vnet-gcp-1',
    kind: 'virtualNetwork',
    vendor: 'gcp',
    name: 'gcp-enterprise-core',
    metadata: metadata({ cidr: '10.40.0.0/16' }),
  },
  {
    id: 'subnet-aws-1',
    kind: 'subnet',
    vendor: 'aws',
    name: 'subnet-app-a',
    metadata: metadata({ cidr: '10.20.1.0/24', zone: 'us-east-1a' }),
  },
  {
    id: 'subnet-azure-1',
    kind: 'subnet',
    vendor: 'azure',
    name: 'subnet-app-a',
    metadata: metadata({ cidr: '10.30.1.0/24', zone: 'eastus-1' }),
  },
  {
    id: 'subnet-gcp-1',
    kind: 'subnet',
    vendor: 'gcp',
    name: 'subnet-app-a',
    metadata: metadata({ cidr: '10.40.1.0/24', zone: 'us-central1-a' }),
  },
  {
    id: 'rt-aws-1',
    kind: 'routeTable',
    vendor: 'aws',
    name: 'rt-enterprise-core',
    metadata: metadata({ routes: '7' }),
  },
  {
    id: 'rt-azure-1',
    kind: 'routeTable',
    vendor: 'azure',
    name: 'rt-enterprise-core',
    metadata: metadata({ routes: '6' }),
  },
  {
    id: 'rt-gcp-1',
    kind: 'routeTable',
    vendor: 'gcp',
    name: 'rt-enterprise-core',
    metadata: metadata({ routes: '5' }),
  },
  {
    id: 'sg-aws-1',
    kind: 'securityGroup',
    vendor: 'aws',
    name: 'sg-payments-app',
    metadata: metadata({ ingressRules: '9', egressRules: '4' }),
  },
  {
    id: 'sg-azure-1',
    kind: 'securityGroup',
    vendor: 'azure',
    name: 'nsg-payments-app',
    metadata: metadata({ ingressRules: '8', egressRules: '4' }),
  },
  {
    id: 'sg-gcp-1',
    kind: 'securityGroup',
    vendor: 'gcp',
    name: 'fw-payments-app',
    metadata: metadata({ ingressRules: '8', egressRules: '3' }),
  },
  {
    id: 'lb-aws-1',
    kind: 'loadBalancer',
    vendor: 'aws',
    name: 'alb-payments',
    metadata: metadata({ type: 'application', scheme: 'internet-facing' }),
  },
  {
    id: 'lb-azure-1',
    kind: 'loadBalancer',
    vendor: 'azure',
    name: 'alb-payments-azure',
    metadata: metadata({ type: 'standard', scheme: 'public' }),
  },
  {
    id: 'lb-gcp-1',
    kind: 'loadBalancer',
    vendor: 'gcp',
    name: 'gclb-payments',
    metadata: metadata({ type: 'external', scheme: 'public' }),
  },
  {
    id: 'pip-aws-1',
    kind: 'publicIp',
    vendor: 'aws',
    name: 'eip-payments',
    metadata: metadata({ address: '203.0.113.10' }),
  },
  {
    id: 'pip-azure-1',
    kind: 'publicIp',
    vendor: 'azure',
    name: 'pip-payments',
    metadata: metadata({ address: '203.0.113.11' }),
  },
  {
    id: 'pip-gcp-1',
    kind: 'publicIp',
    vendor: 'gcp',
    name: 'ip-payments',
    metadata: metadata({ address: '203.0.113.12' }),
  },
  {
    id: 'k8s-aws-1',
    kind: 'kubernetesCluster',
    vendor: 'aws',
    name: 'eks-platform',
    metadata: metadata({ version: '1.31', nodeGroups: '4' }),
  },
  {
    id: 'k8s-azure-1',
    kind: 'kubernetesCluster',
    vendor: 'azure',
    name: 'aks-platform',
    metadata: metadata({ version: '1.31', nodePools: '4' }),
  },
  {
    id: 'k8s-gcp-1',
    kind: 'kubernetesCluster',
    vendor: 'gcp',
    name: 'gke-platform',
    metadata: metadata({ version: '1.31', nodePools: '4' }),
  },
  {
    id: 'cr-aws-1',
    kind: 'containerRegistry',
    vendor: 'aws',
    name: 'ecr-enterprise',
    metadata: metadata({ repositories: '120' }),
  },
  {
    id: 'cr-azure-1',
    kind: 'containerRegistry',
    vendor: 'azure',
    name: 'acr-enterprise',
    metadata: metadata({ repositories: '118' }),
  },
  {
    id: 'cr-gcp-1',
    kind: 'containerRegistry',
    vendor: 'gcp',
    name: 'artifact-registry-enterprise',
    metadata: metadata({ repositories: '123' }),
  },
  {
    id: 'iam-aws-1',
    kind: 'iamUser',
    vendor: 'aws',
    name: 'platform-automation',
    metadata: metadata({ mfaEnabled: 'true' }),
  },
  {
    id: 'iam-azure-1',
    kind: 'iamUser',
    vendor: 'azure',
    name: 'platform-automation',
    metadata: metadata({ mfaEnabled: 'true' }),
  },
  {
    id: 'role-aws-1',
    kind: 'role',
    vendor: 'aws',
    name: 'role-platform-admin',
    metadata: metadata({ scope: 'account' }),
  },
  {
    id: 'role-azure-1',
    kind: 'role',
    vendor: 'azure',
    name: 'role-platform-admin',
    metadata: metadata({ scope: 'subscription' }),
  },
  {
    id: 'role-gcp-1',
    kind: 'role',
    vendor: 'gcp',
    name: 'role-platform-admin',
    metadata: metadata({ scope: 'project' }),
  },
  {
    id: 'policy-aws-1',
    kind: 'policy',
    vendor: 'aws',
    name: 'policy-platform-readonly',
    metadata: metadata({ statements: '12' }),
  },
  {
    id: 'policy-azure-1',
    kind: 'policy',
    vendor: 'azure',
    name: 'policy-platform-readonly',
    metadata: metadata({ assignments: '9' }),
  },
  {
    id: 'policy-gcp-1',
    kind: 'policy',
    vendor: 'gcp',
    name: 'policy-platform-readonly',
    metadata: metadata({ bindings: '11' }),
  },
  {
    id: 'sa-aws-1',
    kind: 'serviceAccount',
    vendor: 'aws',
    name: 'svc-platform-workload',
    metadata: metadata({ workloadIdentity: 'enabled' }),
  },
  {
    id: 'sa-azure-1',
    kind: 'serviceAccount',
    vendor: 'azure',
    name: 'svc-platform-workload',
    metadata: metadata({ workloadIdentity: 'enabled' }),
  },
  {
    id: 'sa-gcp-1',
    kind: 'serviceAccount',
    vendor: 'gcp',
    name: 'svc-platform-workload',
    metadata: metadata({ workloadIdentity: 'enabled' }),
  },
]);

const MOCK_HEALTH: readonly CloudHealth[] = Object.freeze([
  {
    scopeName: 'enterprise-cloud-control-plane',
    vendor: 'aws',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'enterprise-cloud-control-plane',
    vendor: 'azure',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'enterprise-cloud-control-plane',
    vendor: 'gcp',
    healthy: true,
    status: 'healthy',
    checkedAt: DATASET_TIMESTAMP,
  },
]);

const MOCK_METRICS: readonly CloudMetric[] = Object.freeze([
  {
    scopeName: 'compute-fleet',
    metricName: 'vm-running-count',
    value: 132,
    unit: 'count',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'network-fleet',
    metricName: 'egress-throughput',
    value: 940,
    unit: 'mbps',
    checkedAt: DATASET_TIMESTAMP,
  },
]);

const MOCK_ALERTS: readonly CloudAlert[] = Object.freeze([
  {
    id: 'cloud-alert-1',
    source: 'cost-guardrail',
    severity: 'warning',
    summary: 'Monthly spend reached 82 percent of budget threshold.',
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_EVENTS: readonly CloudEvent[] = Object.freeze([
  {
    id: 'cloud-event-1',
    source: 'identity-audit',
    severity: 'warning',
    message: 'Read-only policy update propagated to all cloud adapters.',
    timestamp: DATASET_TIMESTAMP,
  },
]);

const MOCK_UTILIZATION: readonly CloudResourceUtilization[] = Object.freeze([
  {
    resourceName: 'ec2-payments-01',
    cpuPercent: 47,
    memoryPercent: 63,
    networkPercent: 38,
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    resourceName: 'vm-payments-az-01',
    cpuPercent: 44,
    memoryPercent: 58,
    networkPercent: 35,
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    resourceName: 'gce-payments-01',
    cpuPercent: 41,
    memoryPercent: 55,
    networkPercent: 32,
    checkedAt: DATASET_TIMESTAMP,
  },
]);

const MOCK_COST_METADATA: readonly CloudCostMetadata[] = Object.freeze([
  {
    scopeName: 'aws-enterprise-root',
    vendor: 'aws',
    currency: 'USD',
    monthlyCostEstimate: 124500,
    costCenter: 'platform-core',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'azure-enterprise-subscription',
    vendor: 'azure',
    currency: 'USD',
    monthlyCostEstimate: 118900,
    costCenter: 'platform-core',
    checkedAt: DATASET_TIMESTAMP,
  },
  {
    scopeName: 'gcp-enterprise-project',
    vendor: 'gcp',
    currency: 'USD',
    monthlyCostEstimate: 113200,
    costCenter: 'platform-core',
    checkedAt: DATASET_TIMESTAMP,
  },
]);

export class CloudMockAdapter implements ICloudAdapter {
  public async discoverProviders(): Promise<readonly CloudProviderAbstraction[]> {
    return MOCK_PROVIDERS;
  }

  public async discoverAccounts(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('account');
  }

  public async discoverSubscriptions(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('subscription');
  }

  public async discoverProjects(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('project');
  }

  public async discoverRegions(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('region');
  }

  public async discoverAvailabilityZones(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('availabilityZone');
  }

  public async discoverVirtualMachines(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('virtualMachine');
  }

  public async discoverAutoScalingGroups(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('autoScalingGroup');
  }

  public async discoverImages(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('image');
  }

  public async discoverInstanceTypes(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('instanceType');
  }

  public async discoverBlockStorage(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('blockStorage');
  }

  public async discoverObjectStorage(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('objectStorage');
  }

  public async discoverFileStorage(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('fileStorage');
  }

  public async discoverVirtualNetworks(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('virtualNetwork');
  }

  public async discoverSubnets(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('subnet');
  }

  public async discoverRouteTables(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('routeTable');
  }

  public async discoverSecurityGroups(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('securityGroup');
  }

  public async discoverLoadBalancers(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('loadBalancer');
  }

  public async discoverPublicIps(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('publicIp');
  }

  public async discoverKubernetesClusters(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('kubernetesCluster');
  }

  public async discoverContainerRegistries(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('containerRegistry');
  }

  public async discoverIamUsers(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('iamUser');
  }

  public async discoverRoles(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('role');
  }

  public async discoverPolicies(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('policy');
  }

  public async discoverServiceAccounts(): Promise<readonly CloudInventoryResource[]> {
    return this.byKind('serviceAccount');
  }

  public async getHealth(): Promise<readonly CloudHealth[]> {
    return MOCK_HEALTH;
  }

  public async getMetrics(): Promise<readonly CloudMetric[]> {
    return MOCK_METRICS;
  }

  public async getAlerts(): Promise<readonly CloudAlert[]> {
    return MOCK_ALERTS;
  }

  public async getEvents(): Promise<readonly CloudEvent[]> {
    return MOCK_EVENTS;
  }

  public async getResourceUtilization(): Promise<readonly CloudResourceUtilization[]> {
    return MOCK_UTILIZATION;
  }

  public async getCostMetadata(): Promise<readonly CloudCostMetadata[]> {
    return MOCK_COST_METADATA;
  }

  public async refreshInventory(): Promise<{ readonly refreshedAt: string }> {
    return { refreshedAt: DATASET_TIMESTAMP };
  }

  public async testConnection(
    configuration: Readonly<CloudProviderConfiguration>,
  ): Promise<CloudConnectionTestResult> {
    return {
      connected: configuration.endpoint.startsWith('cloud://'),
      latencyMs: 23,
      message:
        'Cloud connection test succeeded through adapter abstraction without AWS, Azure, or Google Cloud SDK usage.',
    };
  }

  public async discoverCapabilities(): Promise<readonly CloudCapabilityDescriptor[]> {
    return Object.freeze([
      { id: 'cloud-discovery', name: 'discovery', version: '1.0.0', category: 'discovery' },
      { id: 'cloud-compute', name: 'compute', version: '1.0.0', category: 'compute' },
      { id: 'cloud-storage', name: 'storage', version: '1.0.0', category: 'storage' },
      { id: 'cloud-networking', name: 'networking', version: '1.0.0', category: 'networking' },
      { id: 'cloud-containers', name: 'containers', version: '1.0.0', category: 'containers' },
      { id: 'cloud-identity', name: 'identity', version: '1.0.0', category: 'identity' },
      { id: 'cloud-monitoring', name: 'monitoring', version: '1.0.0', category: 'monitoring' },
      { id: 'cloud-operations', name: 'operations', version: '1.0.0', category: 'operations' },
    ]);
  }

  public async searchResources(
    query: CloudSearchQuery,
  ): Promise<readonly CloudInventoryResource[]> {
    const needle = query.text.trim().toLowerCase();
    const byVendor = query.vendor
      ? MOCK_INVENTORY.filter((resource) => resource.vendor === query.vendor)
      : MOCK_INVENTORY;
    const byKind = query.kind
      ? byVendor.filter((resource) => resource.kind === query.kind)
      : byVendor;

    return byKind.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }

  private byKind(kind: CloudResourceKind): readonly CloudInventoryResource[] {
    return MOCK_INVENTORY.filter((resource) => resource.kind === kind);
  }
}

export class CloudInventoryCache {
  private snapshot: CloudInventoryCacheSnapshot = Object.freeze({ resources: Object.freeze([]) });

  public update(resources: readonly CloudInventoryResource[], refreshedAt: string): void {
    this.snapshot = Object.freeze({ resources: Object.freeze([...resources]), refreshedAt });
  }

  public getSnapshot(): CloudInventoryCacheSnapshot {
    return this.snapshot;
  }

  public searchResources(query: CloudSearchQuery): readonly CloudInventoryResource[] {
    const needle = query.text.trim().toLowerCase();
    const byVendor = query.vendor
      ? this.snapshot.resources.filter((resource) => resource.vendor === query.vendor)
      : this.snapshot.resources;
    const byKind = query.kind
      ? byVendor.filter((resource) => resource.kind === query.kind)
      : byVendor;

    return byKind.filter((resource) =>
      [resource.id, resource.name].some((value) => value.toLowerCase().includes(needle)),
    );
  }
}

export class CloudConfiguration {
  public readonly defaultConfiguration: Readonly<CloudProviderConfiguration> = Object.freeze({
    endpoint: 'cloud://enterprise.control-plane.example.local',
    organizationId: 'enterprise-platform',
    credentialRef: 'CLOUD_CREDENTIAL_REF',
    enabledVendors: vendorList('aws', 'azure', 'gcp'),
    readOnly: true,
    connectionTimeoutMs: 12000,
    inventoryCacheTtlSeconds: 300,
  });

  public merge(
    override?: Readonly<Partial<CloudProviderConfiguration>>,
  ): Readonly<CloudProviderConfiguration> {
    const enabledVendors = override?.enabledVendors ?? this.defaultConfiguration.enabledVendors;
    const merged: CloudProviderConfiguration = {
      endpoint: override?.endpoint ?? this.defaultConfiguration.endpoint,
      organizationId: override?.organizationId ?? this.defaultConfiguration.organizationId,
      credentialRef: override?.credentialRef ?? this.defaultConfiguration.credentialRef,
      enabledVendors: Object.freeze([...enabledVendors]),
      readOnly: override?.readOnly ?? this.defaultConfiguration.readOnly,
      connectionTimeoutMs:
        override?.connectionTimeoutMs ?? this.defaultConfiguration.connectionTimeoutMs,
      inventoryCacheTtlSeconds:
        override?.inventoryCacheTtlSeconds ?? this.defaultConfiguration.inventoryCacheTtlSeconds,
    };
    return Object.freeze(merged);
  }
}

export class CloudAuthenticationProvider {
  private readonly providerAuthentication: ProviderAuthentication;

  public constructor(options: { readonly credentialStore?: CredentialStore } = {}) {
    this.providerAuthentication = new ProviderAuthentication({
      credentialStore: options.credentialStore ?? new CredentialStore(),
      autoStoreCredentials: true,
    });

    this.providerAuthentication.registerProvider({
      method: 'api-key',
      authenticate: async (
        context: { readonly provider: { readonly manifest: { readonly id: string } } },
        credential: { readonly method: 'api-key'; readonly apiKey: string },
      ) => {
        const success = credential.apiKey.trim().length > 0;
        return new AuthenticationResult({
          success,
          method: 'api-key',
          providerId: context.provider.manifest.id,
          principalId: success ? 'cloud-api-key-principal' : undefined,
          message: success ? 'Cloud authentication accepted.' : 'Cloud API key payload is invalid.',
          authenticatedAt: DATASET_TIMESTAMP,
        });
      },
    });
  }

  public getProviderAuthentication(): ProviderAuthentication {
    return this.providerAuthentication;
  }
}

export class CloudConnection {
  public readonly id: string;
  public readonly endpoint: string;
  public connectedAt?: string;

  public constructor(endpoint: string) {
    this.endpoint = endpoint;
    this.id = `cloud-connection:${endpoint}`;
  }

  public connect(): void {
    this.connectedAt = DATASET_TIMESTAMP;
  }

  public disconnect(): void {
    this.connectedAt = undefined;
  }
}

export class CloudConnectionManager {
  private readonly sdkConnectionManager: ProviderConnectionManager;

  public constructor(providerId: string) {
    const factory = new ConnectionFactory();
    const pool = new ConnectionPool();

    factory.register(providerId, (provider, context) => {
      const endpoint = String(context.configuration.endpoint);
      return new ProviderConnection({
        provider,
        context,
        connect: async () => {
          const client = new CloudConnection(endpoint);
          client.connect();
          return client;
        },
        disconnect: async (client) => {
          client?.disconnect();
        },
        checkHealth: async (client) =>
          new ConnectionHealth({
            status: client?.connectedAt ? 'connected' : 'degraded',
            latencyMs: 23,
            lastCheckedAt: DATASET_TIMESTAMP,
            message: 'Cloud connection health.',
          }),
      });
    });

    this.sdkConnectionManager = new ProviderConnectionManager({ factory, pool });
  }

  public getSdkConnectionManager(): ProviderConnectionManager {
    return this.sdkConnectionManager;
  }
}

export class CloudCapabilityRegistry {
  private readonly registry: ProviderCapabilityRegistry;

  public constructor(providerId: string, registry = new ProviderCapabilityRegistry()) {
    this.registry = registry;

    const register = (
      id: string,
      name: string,
      category: CloudCapabilityDescriptor['category'],
      description: string,
    ): void => {
      this.registry.register(
        new CapabilityDefinition({
          id,
          providerId,
          name,
          version: new CapabilityVersion('1.0.0'),
          metadata: new CapabilityMetadata({
            description,
            tags: ['cloud', 'vendor-neutral', category],
            featureFlags: { configurationDriven: true, adapterBacked: true },
          }),
          requiresCapabilities: [name],
          requiredFeatureFlags: ['configurationDriven', 'adapterBacked'],
        }),
      );
    };

    register('cloud-discovery', 'discovery', 'discovery', 'Cloud inventory discovery surfaces.');
    register('cloud-compute', 'compute', 'compute', 'Compute resources and scaling groups.');
    register('cloud-storage', 'storage', 'storage', 'Cloud storage inventory and metadata.');
    register('cloud-networking', 'networking', 'networking', 'Virtual networks and traffic paths.');
    register('cloud-containers', 'containers', 'containers', 'Managed Kubernetes and registries.');
    register('cloud-identity', 'identity', 'identity', 'Cloud IAM users, roles, and policies.');
    register(
      'cloud-monitoring',
      'monitoring',
      'monitoring',
      'Health, metrics, events, and alerts.',
    );
    register(
      'cloud-operations',
      'operations',
      'operations',
      'Refresh, search, and synchronization.',
    );
  }

  public getProviderCapabilityRegistry(): ProviderCapabilityRegistry {
    return this.registry;
  }

  public async list(): Promise<readonly CloudCapabilityDescriptor[]> {
    return Object.freeze([
      { id: 'cloud-discovery', name: 'discovery', version: '1.0.0', category: 'discovery' },
      { id: 'cloud-compute', name: 'compute', version: '1.0.0', category: 'compute' },
      { id: 'cloud-storage', name: 'storage', version: '1.0.0', category: 'storage' },
      { id: 'cloud-networking', name: 'networking', version: '1.0.0', category: 'networking' },
      { id: 'cloud-containers', name: 'containers', version: '1.0.0', category: 'containers' },
      { id: 'cloud-identity', name: 'identity', version: '1.0.0', category: 'identity' },
      { id: 'cloud-monitoring', name: 'monitoring', version: '1.0.0', category: 'monitoring' },
      { id: 'cloud-operations', name: 'operations', version: '1.0.0', category: 'operations' },
    ]);
  }
}

export class CloudProvider extends BaseProvider<CloudProviderConfiguration> {
  private readonly adapter: ICloudAdapter;
  private readonly configurationService: CloudConfiguration;
  private readonly inventoryCache: CloudInventoryCache;
  private readonly capabilityRegistry: CloudCapabilityRegistry;

  public constructor(
    options: {
      readonly adapter?: ICloudAdapter;
      readonly configurationService?: CloudConfiguration;
      readonly inventoryCache?: CloudInventoryCache;
      readonly capabilityRegistry?: CloudCapabilityRegistry;
      readonly manifest?: ProviderManifest<CloudProviderConfiguration>;
    } = {},
  ) {
    const configurationService = options.configurationService ?? new CloudConfiguration();
    super({
      manifest:
        options.manifest ??
        new ProviderManifest<CloudProviderConfiguration>({
          id: 'provider-cloud',
          name: 'Enterprise Cloud Provider',
          metadata: new ProviderMetadata({
            description:
              'Vendor-neutral enterprise cloud provider built on Provider SDK with AWS, Azure, and GCP adapter isolation.',
            version: new ProviderVersion('1.0.0'),
            vendor: 'InfraShield',
            tags: ['cloud', 'vendor-neutral', 'enterprise', 'provider-sdk'],
            healthStatus: 'healthy',
          }),
          capabilities: new ProviderCapabilities([
            new ToolCapability({ name: 'discovery' }),
            new ToolCapability({ name: 'compute' }),
            new ToolCapability({ name: 'storage' }),
            new ToolCapability({ name: 'networking' }),
            new ToolCapability({ name: 'containers' }),
            new ToolCapability({ name: 'identity' }),
            new ToolCapability({ name: 'monitoring' }),
            new ToolCapability({ name: 'operations' }),
          ]),
          configuration: new ProviderConfiguration<CloudProviderConfiguration>({
            requiredFields: [
              'endpoint',
              'organizationId',
              'credentialRef',
              'enabledVendors',
              'readOnly',
              'connectionTimeoutMs',
              'inventoryCacheTtlSeconds',
            ],
            defaultValues: configurationService.defaultConfiguration,
          }),
        }),
    });

    this.adapter = options.adapter ?? new CloudMockAdapter();
    this.configurationService = configurationService;
    this.inventoryCache = options.inventoryCache ?? new CloudInventoryCache();
    this.capabilityRegistry =
      options.capabilityRegistry ?? new CloudCapabilityRegistry(this.manifest.id);
  }

  public resolveConfiguration(
    override?: Readonly<Partial<CloudProviderConfiguration>>,
  ): Readonly<CloudProviderConfiguration> {
    return this.configurationService.merge(override);
  }

  public async discoverProviderAbstractions(): Promise<readonly CloudProviderAbstraction[]> {
    return this.adapter.discoverProviders();
  }

  public async discoverInventory(): Promise<readonly CloudInventoryResource[]> {
    const [
      accounts,
      subscriptions,
      projects,
      regions,
      availabilityZones,
      virtualMachines,
      autoScalingGroups,
      images,
      instanceTypes,
      blockStorage,
      objectStorage,
      fileStorage,
      virtualNetworks,
      subnets,
      routeTables,
      securityGroups,
      loadBalancers,
      publicIps,
      kubernetesClusters,
      containerRegistries,
      iamUsers,
      roles,
      policies,
      serviceAccounts,
    ] = await Promise.all([
      this.adapter.discoverAccounts(),
      this.adapter.discoverSubscriptions(),
      this.adapter.discoverProjects(),
      this.adapter.discoverRegions(),
      this.adapter.discoverAvailabilityZones(),
      this.adapter.discoverVirtualMachines(),
      this.adapter.discoverAutoScalingGroups(),
      this.adapter.discoverImages(),
      this.adapter.discoverInstanceTypes(),
      this.adapter.discoverBlockStorage(),
      this.adapter.discoverObjectStorage(),
      this.adapter.discoverFileStorage(),
      this.adapter.discoverVirtualNetworks(),
      this.adapter.discoverSubnets(),
      this.adapter.discoverRouteTables(),
      this.adapter.discoverSecurityGroups(),
      this.adapter.discoverLoadBalancers(),
      this.adapter.discoverPublicIps(),
      this.adapter.discoverKubernetesClusters(),
      this.adapter.discoverContainerRegistries(),
      this.adapter.discoverIamUsers(),
      this.adapter.discoverRoles(),
      this.adapter.discoverPolicies(),
      this.adapter.discoverServiceAccounts(),
    ]);

    return Object.freeze([
      ...accounts,
      ...subscriptions,
      ...projects,
      ...regions,
      ...availabilityZones,
      ...virtualMachines,
      ...autoScalingGroups,
      ...images,
      ...instanceTypes,
      ...blockStorage,
      ...objectStorage,
      ...fileStorage,
      ...virtualNetworks,
      ...subnets,
      ...routeTables,
      ...securityGroups,
      ...loadBalancers,
      ...publicIps,
      ...kubernetesClusters,
      ...containerRegistries,
      ...iamUsers,
      ...roles,
      ...policies,
      ...serviceAccounts,
    ]);
  }

  public async refreshInventory(): Promise<CloudInventoryCacheSnapshot> {
    const refreshed = await this.adapter.refreshInventory();
    const resources = await this.discoverInventory();
    this.inventoryCache.update(resources, refreshed.refreshedAt);
    return this.inventoryCache.getSnapshot();
  }

  public getInventoryCache(): CloudInventoryCacheSnapshot {
    return this.inventoryCache.getSnapshot();
  }

  public synchronizeCache(snapshot: CloudInventoryCacheSnapshot): void {
    this.inventoryCache.update(snapshot.resources, snapshot.refreshedAt ?? DATASET_TIMESTAMP);
  }

  public async testConnection(
    override?: Readonly<Partial<CloudProviderConfiguration>>,
  ): Promise<CloudConnectionTestResult> {
    return this.adapter.testConnection(this.resolveConfiguration(override));
  }

  public async discoverCapabilities(): Promise<readonly CloudCapabilityDescriptor[]> {
    const [fromRegistry, fromAdapter] = await Promise.all([
      this.capabilityRegistry.list(),
      this.adapter.discoverCapabilities(),
    ]);

    const dedup = new Map<string, CloudCapabilityDescriptor>();
    [...fromRegistry, ...fromAdapter].forEach((capability) => dedup.set(capability.id, capability));
    return Object.freeze([...dedup.values()]);
  }

  public async searchResources(
    query: CloudSearchQuery,
  ): Promise<readonly CloudInventoryResource[]> {
    if (this.inventoryCache.getSnapshot().resources.length > 0) {
      return this.inventoryCache.searchResources(query);
    }
    return this.adapter.searchResources(query);
  }

  public async getHealth(): Promise<readonly CloudHealth[]> {
    return this.adapter.getHealth();
  }

  public async getMetrics(): Promise<readonly CloudMetric[]> {
    return this.adapter.getMetrics();
  }

  public async getAlerts(): Promise<readonly CloudAlert[]> {
    return this.adapter.getAlerts();
  }

  public async getEvents(): Promise<readonly CloudEvent[]> {
    return this.adapter.getEvents();
  }

  public async getResourceUtilization(): Promise<readonly CloudResourceUtilization[]> {
    return this.adapter.getResourceUtilization();
  }

  public async getCostMetadata(): Promise<readonly CloudCostMetadata[]> {
    return this.adapter.getCostMetadata();
  }
}

export class CloudProviderFactory {
  private readonly registryService: ProviderRegistryService;

  public constructor(options: { readonly registryService?: ProviderRegistryService } = {}) {
    this.registryService = options.registryService ?? new ProviderRegistryService();
  }

  public create(options?: {
    readonly adapter?: ICloudAdapter;
    readonly configurationOverride?: Readonly<Partial<CloudProviderConfiguration>>;
  }): CloudProvider {
    const configurationService = new CloudConfiguration();

    const provider = new CloudProvider({
      adapter: options?.adapter,
      configurationService,
      manifest: new ProviderManifest<CloudProviderConfiguration>({
        id: 'provider-cloud',
        name: 'Enterprise Cloud Provider',
        metadata: new ProviderMetadata({
          description:
            'Vendor-neutral enterprise cloud provider built on Provider SDK with AWS, Azure, and GCP adapter isolation.',
          version: new ProviderVersion('1.0.0'),
          vendor: 'InfraShield',
          tags: ['cloud', 'vendor-neutral', 'enterprise', 'provider-sdk'],
          healthStatus: 'healthy',
        }),
        capabilities: new ProviderCapabilities([
          new ToolCapability({ name: 'discovery' }),
          new ToolCapability({ name: 'compute' }),
          new ToolCapability({ name: 'storage' }),
          new ToolCapability({ name: 'networking' }),
          new ToolCapability({ name: 'containers' }),
          new ToolCapability({ name: 'identity' }),
          new ToolCapability({ name: 'monitoring' }),
          new ToolCapability({ name: 'operations' }),
        ]),
        configuration: new ProviderConfiguration<CloudProviderConfiguration>({
          requiredFields: [
            'endpoint',
            'organizationId',
            'credentialRef',
            'enabledVendors',
            'readOnly',
            'connectionTimeoutMs',
            'inventoryCacheTtlSeconds',
          ],
          defaultValues: configurationService.merge(options?.configurationOverride),
        }),
      }),
    });

    this.registryService.register(provider.manifest);
    return provider;
  }

  public getRegistryService(): ProviderRegistryService {
    return this.registryService;
  }
}

export interface CloudProviderRuntime {
  readonly provider: CloudProvider;
  readonly registryService: ProviderRegistryService;
  readonly lifecycleManager: ProviderLifecycleManager;
  readonly capabilityResolver: CapabilityResolver;
  readonly authenticationProvider: CloudAuthenticationProvider;
  readonly connectionManager: CloudConnectionManager;
}

export function createCloudProviderRuntime(): CloudProviderRuntime {
  const factory = new CloudProviderFactory();
  const provider = factory.create();

  const capabilityRegistry = new CloudCapabilityRegistry(provider.manifest.id);
  const capabilityResolver = new CapabilityResolver(
    capabilityRegistry.getProviderCapabilityRegistry(),
    new CapabilityValidator(),
  );

  const lifecycleManager = new ProviderLifecycleManager({
    startup: new ProviderStartup(async () => undefined),
    shutdown: new ProviderShutdown(async () => undefined),
    healthMonitor: new ProviderHealthMonitor(async () => ({
      providerId: provider.manifest.id,
      status: 'healthy',
      healthy: true,
      checkedAt: DATASET_TIMESTAMP,
      message: 'Cloud provider healthy.',
    })),
    recovery: new ProviderRecovery({
      maxAttempts: 2,
      recover: async () => true,
    }),
  });

  return {
    provider,
    registryService: factory.getRegistryService(),
    lifecycleManager,
    capabilityResolver,
    authenticationProvider: new CloudAuthenticationProvider(),
    connectionManager: new CloudConnectionManager(provider.manifest.id),
  };
}
