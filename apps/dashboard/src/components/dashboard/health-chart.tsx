import type { ReactElement } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
} from 'recharts';

interface HealthChartProps {
  data: Array<{ name: string; value: number }>;
}

export function HealthChart({ data }: HealthChartProps): ReactElement {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis dataKey="name" stroke="#94a3b8" />
          <YAxis stroke="#94a3b8" />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke="#22d3ee" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
