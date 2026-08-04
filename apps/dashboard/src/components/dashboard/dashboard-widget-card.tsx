'use client';

import type { ReactElement } from 'react';
import { ChevronRight, RefreshCw } from 'lucide-react';
import type { DashboardWidget } from '../../services/dashboard-service';
import { DashboardCard } from '../ui/dashboard-card';
import { DataTable } from '../ui/data-table';
import { HealthBadge } from '../ui/health-badge';
import { LoadingSkeleton } from '../ui/loading-skeleton';
import { MetricCard } from '../ui/metric-card';
import { ProgressRing } from '../ui/progress-ring';
import { StatusChip } from '../ui/status-chip';
import { Timeline } from '../ui/timeline';

interface DashboardWidgetCardProps {
  widget: DashboardWidget;
  onRefresh?: () => void;
}

export function DashboardWidgetCard({ widget, onRefresh }: DashboardWidgetCardProps): ReactElement {
  const renderBody = (): ReactElement => {
    if (widget.loading) {
      return (
        <div className="space-y-3">
          <LoadingSkeleton className="h-20" />
          <LoadingSkeleton className="h-20" />
        </div>
      );
    }

    if (widget.error) {
      return (
        <div className="rounded-2xl border border-amber-400/20 bg-amber-500/10 p-4 text-sm text-amber-100">
          {widget.error}
        </div>
      );
    }

    if (widget.empty) {
      return (
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">
          No data available for this surface yet.
        </div>
      );
    }

    switch (widget.kind) {
      case 'metric': {
        const parsedValue = Number.parseFloat(widget.value ?? '0');
        return (
          <MetricCard
            label={widget.title}
            value={widget.value ?? '—'}
            detail={widget.trend ? `Trend ${widget.trend}` : widget.description}
            tone={parsedValue > 90 ? 'positive' : parsedValue > 70 ? 'warning' : 'default'}
          />
        );
      }
      case 'status': {
        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
              <div>
                <p className="text-sm text-slate-400">Current state</p>
                <p className="mt-1 text-lg font-semibold text-white">{widget.value ?? 'Healthy'}</p>
              </div>
              <HealthBadge label={widget.value ?? 'Healthy'} tone="positive" />
            </div>
            <div className="flex flex-wrap gap-2">
              <StatusChip label="Operational" tone="positive" />
              <StatusChip label="Monitored" tone="default" />
            </div>
          </div>
        );
      }
      case 'timeline': {
        return (
          <Timeline
            items={[
              { title: 'Current posture', detail: widget.description },
              { title: 'Live signal', detail: widget.value ?? 'No active signal' },
            ]}
          />
        );
      }
      case 'table': {
        return (
          <DataTable
            columns={[
              { key: 'metric', label: 'Metric' },
              { key: 'status', label: 'Status' },
            ]}
            rows={[
              { metric: 'Provider readiness', status: widget.value ?? 'Healthy' },
              { metric: 'Operational coverage', status: 'Tracked' },
            ]}
          />
        );
      }
      case 'chart': {
        const parsedValue = Number.parseInt(widget.value ?? '0', 10);
        return (
          <ProgressRing
            value={Number.isFinite(parsedValue) ? parsedValue : 0}
            label={widget.description}
          />
        );
      }
      default:
        return (
          <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 text-sm text-slate-400">
            {widget.description}
          </div>
        );
    }
  };

  return (
    <DashboardCard title={widget.title} description={widget.description} className="h-full">
      <div className="flex items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {widget.refreshable ? (
            <button
              type="button"
              onClick={onRefresh}
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-slate-950/60 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:text-white"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Refresh
            </button>
          ) : null}
          {widget.drillable ? (
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-medium text-cyan-100 transition hover:text-white"
            >
              Drill down <ChevronRight className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>
      <div className="mt-5">{renderBody()}</div>
    </DashboardCard>
  );
}
