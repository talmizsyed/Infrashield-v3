'use client';

import type { ReactElement } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Label,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { ChartPoint, NamedMetric } from '../../types/executive-dashboard';
import { LoadingSkeleton } from '../ui/loading-skeleton';

const chartTooltipStyle = {
  backgroundColor: '#0f172a',
  border: '1px solid rgba(148, 163, 184, 0.3)',
  borderRadius: '0.75rem',
  color: '#e2e8f0',
};

function ChartEmptyState(): ReactElement {
  return (
    <div className="flex h-56 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-slate-950/40 text-sm text-slate-400">
      No chart data is available yet.
    </div>
  );
}

interface ChartProps<T> {
  data: T[] | undefined;
  isLoading: boolean;
}

export function PlatformHealthGauge({ data, isLoading }: ChartProps<ChartPoint>): ReactElement {
  if (isLoading) return <LoadingSkeleton className="h-56" />;
  if (!data?.length) return <ChartEmptyState />;

  const health = data[data.length - 1]?.value ?? 0;
  const gaugeData = [
    { name: 'Healthy', value: health },
    { name: 'Remaining', value: Math.max(0, 100 - health) },
  ];

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={gaugeData}
            dataKey="value"
            startAngle={180}
            endAngle={0}
            innerRadius="65%"
            outerRadius="88%"
            stroke="none"
          >
            <Cell fill="#22d3ee" />
            <Cell fill="#1e293b" />
            <Label
              value={`${health}%`}
              position="center"
              fill="#f8fafc"
              fontSize={30}
              fontWeight={600}
            />
          </Pie>
          <Tooltip contentStyle={chartTooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function InfrastructureInventoryChart({
  data,
  isLoading,
}: ChartProps<NamedMetric>): ReactElement {
  if (isLoading) return <LoadingSkeleton className="h-56" />;
  if (!data?.length) return <ChartEmptyState />;

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ left: -20 }}>
          <XAxis
            dataKey="name"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Bar dataKey="value" fill="#22d3ee" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AgentActivityTimeline({
  data,
  isLoading,
}: ChartProps<{ label: string; active: number }>): ReactElement {
  if (isLoading) return <LoadingSkeleton className="h-56" />;
  if (!data?.length) return <ChartEmptyState />;

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ left: -20 }}>
          <defs>
            <linearGradient id="agentActivity" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.45} />
              <stop offset="95%" stopColor="#a78bfa" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Area
            type="monotone"
            dataKey="active"
            stroke="#a78bfa"
            fill="url(#agentActivity)"
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

export function WorkflowStatusDonut({ data, isLoading }: ChartProps<NamedMetric>): ReactElement {
  if (isLoading) return <LoadingSkeleton className="h-56" />;
  if (!data?.length) return <ChartEmptyState />;

  const colors = ['#22d3ee', '#fbbf24', '#34d399', '#fb7185'];

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="56%"
            outerRadius="82%"
            paddingAngle={3}
          >
            {data.map((entry, index) => (
              <Cell key={entry.name} fill={colors[index % colors.length]} />
            ))}
          </Pie>
          <Tooltip contentStyle={chartTooltipStyle} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function SecurityRiskTrend({ data, isLoading }: ChartProps<ChartPoint>): ReactElement {
  if (isLoading) return <LoadingSkeleton className="h-56" />;
  if (!data?.length) return <ChartEmptyState />;

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ left: -20 }}>
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis tick={{ fill: '#94a3b8', fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={chartTooltipStyle} />
          <Line type="monotone" dataKey="value" stroke="#fb7185" strokeWidth={2.5} dot={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
