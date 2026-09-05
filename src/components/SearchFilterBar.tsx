"use client";

import { Search, X, ListFilter } from "lucide-react";

/** Search box + a tab-specific filter dropdown, used on Kitchen, Cookbook, Planner. */
export function SearchFilterBar({
  query, onQuery, options, value, onValue, placeholder = "Search…",
}: {
  query: string;
  onQuery: (v: string) => void;
  options: { value: string; label: string }[];
  value: string;
  onValue: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="mb-5 flex flex-col gap-2 sm:flex-row">
      <div className="relative flex-1">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl field py-2.5 pl-10 pr-9 text-sm"
        />
        {query && (
          <button onClick={() => onQuery("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted hover:text-ink">
            <X size={16} />
          </button>
        )}
      </div>
      <div className="relative shrink-0">
        <ListFilter size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
        <select
          value={value}
          onChange={(e) => onValue(e.target.value)}
          className="h-full w-full appearance-none rounded-xl field py-2.5 pl-9 pr-8 text-sm sm:w-52"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>
    </div>
  );
}
