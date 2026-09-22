"use client";

import { cn } from "cn";
import { History } from "lucide-react";
import { useMemo, useState } from "react";

import { ActivityItem } from "@/components/app/activity-item";
import { EmptyState } from "@/components/app/empty-state";
import { groupByDate, type TimelineEntry, type TimelineKind } from "@/lib/activity";
import { formatFullDate } from "@/lib/dates";

const FILTERS: Array<{ value: "all" | TimelineKind; label: string }> = [
  { value: "all", label: "All" },
  { value: "borrow", label: "Lent out" },
  { value: "repayment", label: "Repaid" },
  { value: "overdue", label: "Overdue" },
];

/** The ledger, newest first, grouped under the day each entry belongs to. */
export function ActivityFeed({ entries }: { entries: TimelineEntry[] }) {
  const [filter, setFilter] = useState<"all" | TimelineKind>("all");

  const groups = useMemo(() => {
    const visible = filter === "all" ? entries : entries.filter((entry) => entry.kind === filter);
    return groupByDate(visible);
  }, [entries, filter]);

  if (entries.length === 0) {
    return (
      <div className="px-4 pt-8">
        <EmptyState
          icon={<History className="size-6" aria-hidden />}
          title="Nothing recorded yet."
          description="Every borrowing and repayment you add will show up here as a running ledger."
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="scrollbar-none flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((option) => {
          const active = filter === option.value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(option.value)}
              className={cn(
                "tap-transparent shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border hover:bg-muted text-muted-foreground",
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>

      {groups.length === 0 ? (
        <div className="px-4">
          <EmptyState title="Nothing here." description="No entries of this kind yet." />
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.date}>
              <h2 className="text-muted-foreground px-4 pb-2 text-xs font-semibold tracking-wide uppercase">
                {formatFullDate(group.date)}
              </h2>
              <div className="bg-card border-border divide-border mx-4 divide-y overflow-hidden rounded-xl border">
                {group.entries.map((entry) => (
                  <ActivityItem key={entry.key} entry={entry} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
