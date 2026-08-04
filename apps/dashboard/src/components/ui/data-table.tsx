import type { ReactElement } from 'react';

interface DataTableProps {
  columns: Array<{ key: string; label: string }>;
  rows: Array<Record<string, string | number | ReactElement>>;
}

export function DataTable({ columns, rows }: DataTableProps): ReactElement {
  const fallbackKey = columns[0]?.key;

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-950/60">
      <table className="min-w-full divide-y divide-white/10 text-sm">
        <thead className="bg-slate-900/70 text-left text-slate-400">
          <tr>
            {columns.map((column) => (
              <th key={column.key} className="px-4 py-3 font-medium">
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/10 text-slate-200">
          {rows.map((row, index) => (
            <tr key={fallbackKey ? `${row[fallbackKey] ?? index}` : index}>
              {columns.map((column) => (
                <td key={column.key} className="px-4 py-3">
                  {row[column.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
