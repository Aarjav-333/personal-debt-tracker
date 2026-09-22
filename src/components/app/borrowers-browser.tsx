"use client";

import { SearchX, Users } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { BorrowerCard } from "@/components/app/borrower-card";
import { BrowseToolbar } from "@/components/app/browse-toolbar";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";
import { sortBorrowers, type BorrowerSummary, type SortKey } from "@/lib/aggregate";
import type { StatusFilter } from "@/lib/debt-status";

/**
 * A borrower matches a status filter when any of their debts does - except
 * "Paid", which means everything they ever borrowed has come back.
 */
function matchesFilter(borrower: BorrowerSummary, filter: StatusFilter): boolean {
  switch (filter) {
    case "all":
      return true;
    case "overdue":
      return borrower.overdueDebtCount > 0;
    case "due_soon":
      return borrower.dueSoonDebtCount > 0;
    case "active":
      return borrower.outstandingMinor > 0;
    case "paid":
      return borrower.debtCount > 0 && borrower.outstandingMinor <= 0;
    default:
      return true;
  }
}

export function BorrowersBrowser({ borrowers }: { borrowers: BorrowerSummary[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("outstanding_desc");

  const counts = useMemo(
    () => ({
      all: borrowers.length,
      active: borrowers.filter((borrower) => matchesFilter(borrower, "active")).length,
      due_soon: borrowers.filter((borrower) => matchesFilter(borrower, "due_soon")).length,
      overdue: borrowers.filter((borrower) => matchesFilter(borrower, "overdue")).length,
      paid: borrowers.filter((borrower) => matchesFilter(borrower, "paid")).length,
    }),
    [borrowers],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();

    const filtered = borrowers.filter((borrower) => {
      if (!matchesFilter(borrower, filter)) return false;
      if (!needle) return true;
      return (
        borrower.name.toLowerCase().includes(needle) ||
        (borrower.phone ?? "").toLowerCase().includes(needle)
      );
    });

    return sortBorrowers(filtered, sort);
  }, [borrowers, query, filter, sort]);

  if (borrowers.length === 0) {
    return (
      <div className="px-4 pt-8">
        <EmptyState
          icon={<Users className="size-6" aria-hidden />}
          title="No borrowers yet."
          description="Add your first borrower to start tracking what you have lent."
          action={
            <Button asChild size="lg">
              <Link href="/add">Add borrower</Link>
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BrowseToolbar
        query={query}
        onQueryChange={setQuery}
        filter={filter}
        onFilterChange={setFilter}
        sort={sort}
        onSortChange={setSort}
        placeholder="Search borrowers"
        counts={counts}
      />

      {visible.length === 0 ? (
        <div className="px-4 pt-4">
          <EmptyState
            icon={<SearchX className="size-6" aria-hidden />}
            title="Nothing matches."
            description={
              query
                ? `No borrower matches "${query.trim()}" with the current filter.`
                : "No borrower matches the current filter."
            }
            action={
              <Button
                variant="outline"
                onClick={() => {
                  setQuery("");
                  setFilter("all");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </div>
      ) : (
        <ul className="space-y-3 px-4">
          {visible.map((borrower) => (
            <li key={borrower.id}>
              <BorrowerCard borrower={borrower} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
