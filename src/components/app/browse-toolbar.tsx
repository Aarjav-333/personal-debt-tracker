"use client";

import { cn } from "cn";
import { ArrowUpDown, Search, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SORT_OPTIONS, type SortKey } from "@/lib/aggregate";
import { STATUS_FILTERS, type StatusFilter } from "@/lib/debt-status";

interface BrowseToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  filter: StatusFilter;
  onFilterChange: (value: StatusFilter) => void;
  sort: SortKey;
  onSortChange: (value: SortKey) => void;
  placeholder?: string;
  /** How many items match, shown so an empty result is obviously a filter. */
  counts?: Partial<Record<StatusFilter, number>>;
}

/** Search, status filter and sort, sized for one-handed use. */
export function BrowseToolbar({
  query,
  onQueryChange,
  filter,
  onFilterChange,
  sort,
  onSortChange,
  placeholder = "Search by name",
  counts,
}: BrowseToolbarProps) {
  return (
    <div className="space-y-3">
      <div className="flex gap-2 px-4">
        <div className="relative flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            type="search"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder={placeholder}
            aria-label={placeholder}
            className="pr-9 pl-9"
          />
          {query ? (
            <button
              type="button"
              onClick={() => onQueryChange("")}
              aria-label="Clear search"
              className="text-muted-foreground hover:text-foreground tap-transparent absolute top-1/2 right-2 -translate-y-1/2 rounded-full p-1"
            >
              <X className="size-4" aria-hidden />
            </button>
          ) : null}
        </div>

        <Select value={sort} onValueChange={(value) => onSortChange(value as SortKey)}>
          <SelectTrigger className="w-auto shrink-0" aria-label="Sort by">
            <ArrowUpDown className="size-4" aria-hidden />
            <span className="sr-only">
              <SelectValue />
            </span>
          </SelectTrigger>
          <SelectContent align="end">
            {SORT_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Horizontally scrollable so the chips never wrap on a narrow phone. */}
      <div className="scrollbar-none flex gap-2 overflow-x-auto px-4 pb-0.5">
        {STATUS_FILTERS.map((option) => {
          const active = filter === option.value;
          const count = counts?.[option.value];

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange(option.value)}
              className={cn(
                "tap-transparent shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted text-muted-foreground",
              )}
            >
              {option.label}
              {typeof count === "number" ? (
                <span className={cn("ml-1.5 tabular-nums", active ? "opacity-80" : "opacity-60")}>{count}</span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
