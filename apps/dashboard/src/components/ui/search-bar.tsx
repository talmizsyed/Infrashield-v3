import type { ReactElement } from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  placeholder?: string;
}

export function SearchBar({ placeholder = 'Search' }: SearchBarProps): ReactElement {
  return (
    <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-400">
      <Search className="h-4 w-4" />
      <input
        aria-label="Search"
        placeholder={placeholder}
        className="w-36 bg-transparent outline-none placeholder:text-slate-500"
      />
    </label>
  );
}
