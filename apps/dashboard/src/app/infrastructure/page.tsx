'use client';

import { useMemo, useState, type ReactElement } from 'react';
import { AppShell } from '../../components/layout/app-shell';
import { HealthBadge } from '../../components/ui/health-badge';
import { LoadingSkeleton } from '../../components/ui/loading-skeleton';
import { MetricCard } from '../../components/ui/metric-card';
import { SectionCard } from '../../components/ui/section-card';
import { useInfrastructureData } from '../../hooks/use-infrastructure-data';
import type { InfrastructureServerRow } from '../../types/infrastructure';

const statusToneMap: Record<
  InfrastructureServerRow['status'],
  'positive' | 'warning' | 'danger' | 'default'
> = {
  healthy: 'positive',
  warning: 'warning',
  critical: 'danger',
  maintenance: 'default',
};

export default function InfrastructurePage(): ReactElement {
  const { overview, servers, virtualization, openshift, databases, isLoading, error, refetch } =
    useInfrastructureData();
  const [search, setSearch] = useState('');
  const [environment, setEnvironment] = useState('all');
  const [status, setStatus] = useState('all');
  const [sortKey, setSortKey] = useState<'hostname' | 'environment' | 'status'>('hostname');

  const environments = useMemo(
    () => ['all', ...Array.from(new Set(servers.map((server) => server.environment)))],
    [servers],
  );

  const statusFilters = useMemo(
    () => ['all', ...Array.from(new Set(servers.map((server) => server.status)))],
    [servers],
  );

  const filteredServers = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return servers
      .filter((server) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          [server.hostname, server.ip, server.environment, server.datacenter, server.os]
            .join(' ')
            .toLowerCase()
            .includes(normalizedSearch);

        const matchesEnvironment = environment === 'all' || server.environment === environment;
        const matchesStatus = status === 'all' || server.status === status;

        return matchesSearch && matchesEnvironment && matchesStatus;
      })
      .sort((left, right) => {
        if (sortKey === 'environment') {
          return left.environment.localeCompare(right.environment);
        }

        if (sortKey === 'status') {
          return left.status.localeCompare(right.status);
        }

        return left.hostname.localeCompare(right.hostname);
      });
  }, [environment, search, servers, sortKey, status]);

  return (
    <AppShell
      title="Infrastructure"
      description="Enterprise inventory posture, platform resilience, and environment readiness."
      breadcrumbs={[{ label: 'Home', href: '/' }, { label: 'Infrastructure' }]}
    >
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {isLoading ? (
            <>
              <LoadingSkeleton className="h-32" />
              <LoadingSkeleton className="h-32" />
              <LoadingSkeleton className="h-32" />
              <LoadingSkeleton className="h-32" />
            </>
          ) : overview ? (
            <>
              <MetricCard
                label="Total assets"
                value={overview.totalAssets.toString()}
                detail="Across production and shared services"
                tone="default"
              />
              <MetricCard
                label="Healthy assets"
                value={overview.healthyAssets.toString()}
                detail={`${overview.unhealthyAssets} need attention`}
                tone="positive"
              />
              <MetricCard
                label="Maintenance"
                value={overview.maintenanceAssets.toString()}
                detail="Planned interventions in flight"
                tone="warning"
              />
              <MetricCard
                label="Discovery coverage"
                value={`${overview.discoveryCoverage}%`}
                detail={`Last scan ${overview.lastDiscovery}`}
                tone="default"
              />
            </>
          ) : null}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <SectionCard
            title="Operational posture"
            description="A consolidated view of platform health, virtualization readiness, and cluster efficiency."
          >
            {isLoading ? (
              <div className="space-y-3">
                <LoadingSkeleton className="h-20" />
                <LoadingSkeleton className="h-20" />
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>Virtualization</span>
                    <span>{virtualization?.vmCount ?? 0} VMs</span>
                  </div>
                  <p className="mt-3 text-xl font-semibold text-white">
                    {virtualization?.vmware ?? 'Unavailable'}
                  </p>
                  <p className="mt-1 text-sm text-slate-400">{virtualization?.vCenter ?? 'n/a'}</p>
                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>ESXi hosts</span>
                      <span>{virtualization?.esxiHosts ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Clusters</span>
                      <span>{virtualization?.clusters ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Datastores</span>
                      <span>{virtualization?.datastores ?? 0}</span>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="flex items-center justify-between text-sm text-slate-400">
                    <span>OpenShift</span>
                    <span>{openshift?.nodeHealth ?? 0}% node health</span>
                  </div>
                  <p className="mt-3 text-xl font-semibold text-white">
                    {openshift?.clusters ?? 0} clusters
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {openshift?.namespaces ?? 0} namespaces and {openshift?.deployments ?? 0}{' '}
                    deployments
                  </p>
                  <div className="mt-4 space-y-2 text-sm text-slate-300">
                    <div className="flex items-center justify-between">
                      <span>Projects</span>
                      <span>{openshift?.projects ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Pods</span>
                      <span>{openshift?.pods ?? 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Operators</span>
                      <span>{openshift?.operators ?? 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Platform focus"
            description="Immediate priorities across patching, resiliency, and capacity planning."
          >
            <div className="space-y-3">
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Patch cadence</p>
                    <p className="text-sm text-slate-400">Shared services hardening</p>
                  </div>
                  <HealthBadge label="On track" tone="positive" />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Capacity planning</p>
                    <p className="text-sm text-slate-400">AI inference clustering</p>
                  </div>
                  <HealthBadge label="Planning" tone="warning" />
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Backup coverage</p>
                    <p className="text-sm text-slate-400">Critical datastore verification</p>
                  </div>
                  <HealthBadge label="Stable" tone="positive" />
                </div>
              </div>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="Server inventory"
          description="Live inventory row filtering, status awareness, and rapid triage for infrastructure assets."
        >
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-3 md:flex-row">
              <input
                aria-label="Search inventory"
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-cyan-400"
                placeholder="Search hostname, IP, datacenter, OS"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <select
                aria-label="Filter by environment"
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                value={environment}
                onChange={(event) => setEnvironment(event.target.value)}
              >
                {environments.map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'All environments' : value}
                  </option>
                ))}
              </select>
              <select
                aria-label="Filter by status"
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                {statusFilters.map((value) => (
                  <option key={value} value={value}>
                    {value === 'all' ? 'All statuses' : value}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400" htmlFor="sort-by">
                Sort by
              </label>
              <select
                id="sort-by"
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
                value={sortKey}
                onChange={(event) =>
                  setSortKey(event.target.value as 'hostname' | 'environment' | 'status')
                }
              >
                <option value="hostname">Hostname</option>
                <option value="environment">Environment</option>
                <option value="status">Status</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              <LoadingSkeleton className="h-16" />
              <LoadingSkeleton className="h-16" />
              <LoadingSkeleton className="h-16" />
            </div>
          ) : error ? (
            <div className="rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">
              <p className="font-medium">Unable to load inventory.</p>
              <p className="mt-1">{error}</p>
              <button
                className="mt-3 rounded-xl border border-rose-400/20 bg-rose-500/15 px-3 py-2 text-sm font-medium text-rose-100"
                onClick={() => refetch()}
                type="button"
              >
                Retry loading
              </button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-white/10">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm">
                  <thead className="bg-slate-950/70 text-slate-400">
                    <tr>
                      <th className="px-4 py-3 font-medium">Host</th>
                      <th className="px-4 py-3 font-medium">Environment</th>
                      <th className="px-4 py-3 font-medium">Resources</th>
                      <th className="px-4 py-3 font-medium">Status</th>
                      <th className="px-4 py-3 font-medium">Datacenter</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10 bg-slate-900/50 text-slate-200">
                    {filteredServers.map((server) => (
                      <tr key={`${server.hostname}-${server.ip}`}>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{server.hostname}</div>
                          <div className="text-xs text-slate-400">{server.ip}</div>
                        </td>
                        <td className="px-4 py-3">{server.environment}</td>
                        <td className="px-4 py-3">
                          <div>CPU {server.cpu}</div>
                          <div className="text-xs text-slate-400">
                            Mem {server.memory} • Disk {server.disk}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <HealthBadge label={server.status} tone={statusToneMap[server.status]} />
                        </td>
                        <td className="px-4 py-3">
                          <div>{server.datacenter}</div>
                          <div className="text-xs text-slate-400">{server.os}</div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </SectionCard>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <SectionCard
            title="Database inventory"
            description="Core database services and backup posture."
          >
            {!isLoading && databases.length > 0 ? (
              <div className="space-y-3">
                {databases.map((database) => (
                  <div
                    key={database.name}
                    className="rounded-2xl border border-white/10 bg-slate-950/60 p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-white">{database.name}</p>
                        <p className="text-sm text-slate-400">
                          {database.environment} • v{database.version}
                        </p>
                      </div>
                      <HealthBadge
                        label={database.status}
                        tone={
                          database.status === 'healthy'
                            ? 'positive'
                            : database.status === 'warning'
                              ? 'warning'
                              : 'default'
                        }
                      />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm text-slate-400">
                      <span>Backup</span>
                      <span>{database.backupStatus}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>

          <SectionCard
            title="Capacity trend"
            description="Service utilization and headroom indicators across the estate."
          >
            {!isLoading ? (
              <div className="space-y-4">
                {[
                  { label: 'Compute utilization', value: 74, tone: 'positive' },
                  { label: 'Storage saturation', value: 58, tone: 'warning' },
                  { label: 'Network resilience', value: 91, tone: 'positive' },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between text-sm text-slate-300">
                      <span>{item.label}</span>
                      <span>{item.value}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-800">
                      <div
                        className={`h-2 rounded-full ${item.tone === 'warning' ? 'bg-amber-400' : 'bg-emerald-400'}`}
                        style={{ width: `${item.value}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </SectionCard>
        </div>
      </div>
    </AppShell>
  );
}
