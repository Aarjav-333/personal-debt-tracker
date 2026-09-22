import { ArrowRight, TriangleAlert, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { ActivityItem } from "@/components/app/activity-item";
import { Amount } from "@/components/app/amount";
import { DueDebtRow } from "@/components/app/due-debt-row";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { ListCard, Section } from "@/components/app/section";
import { StatTile } from "@/components/app/stat-tile";
import { Button } from "@/components/ui/button";
import { buildTimeline } from "@/lib/activity";
import { computeTotals, toDebtViews } from "@/lib/aggregate";
import { DUE_SOON_WINDOW_DAYS } from "@/lib/debt-status";
import { getActivity, getLedger } from "@/server/queries";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Overview" };

function plural(count: number, singular: string, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export default async function DashboardPage() {
  const [{ borrowers, debts }, activityRows, today] = await Promise.all([
    getLedger(),
    getActivity(40),
    getToday(),
  ]);

  const debtViews = toDebtViews(debts, today);
  const totals = computeTotals(debtViews, borrowers.length);

  const overdue = debtViews
    .filter((debt) => debt.status === "overdue")
    .sort((a, b) => (a.expectedReturnDate ?? "").localeCompare(b.expectedReturnDate ?? ""));

  const dueSoon = debtViews
    .filter((debt) => debt.status === "due_soon")
    .sort((a, b) => (a.expectedReturnDate ?? "").localeCompare(b.expectedReturnDate ?? ""));

  const recent = buildTimeline(activityRows, debtViews).slice(0, 5);

  if (borrowers.length === 0) {
    return (
      <>
        <PageHeader title="Overview" subtitle="Your personal lending ledger" />
        <div className="px-4 pt-8">
          <EmptyState
            icon={<Wallet className="size-6" aria-hidden />}
            title="No one owes you money."
            description="Add your first borrower to start tracking what you have lent and what has come back."
            action={
              <Button asChild size="lg">
                <Link href="/add">Add borrower</Link>
              </Button>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Overview"
        subtitle={`${plural(totals.borrowerCount, "borrower")} · ${plural(totals.debtCount, "borrowing")}`}
      />

      <div className="mt-4 space-y-6">
        {/* The one number this whole app exists to answer. */}
        <div className="px-4">
          <div className="bg-card border-border rounded-2xl border p-5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Total outstanding
            </p>
            <Amount
              minor={totals.totalOutstandingMinor}
              className="mt-1 block text-4xl font-semibold tracking-tight"
            />
            <p className="text-muted-foreground mt-2 text-sm">
              {totals.activeDebtCount > 0 ? (
                <>
                  {plural(totals.activeDebtCount, "active debt")} across{" "}
                  {plural(totals.activeBorrowerCount, "borrower")}
                </>
              ) : (
                "Everything you have lent has come back."
              )}
            </p>

            {totals.overdueDebtCount > 0 ? (
              <p className="text-money-danger mt-3 flex items-center gap-1.5 text-sm font-medium">
                <TriangleAlert className="size-4 shrink-0" aria-hidden />
                <Amount minor={totals.totalOverdueMinor} /> overdue across{" "}
                {plural(totals.overdueDebtCount, "debt")}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-4">
          <StatTile label="Total lent" minor={totals.totalLentMinor} caption={plural(totals.debtCount, "borrowing")} />
          <StatTile
            label="Total repaid"
            minor={totals.totalRepaidMinor}
            tone="positive"
            caption={`${plural(totals.paidDebtCount, "debt")} settled`}
          />
          <StatTile
            label="Overdue"
            minor={totals.totalOverdueMinor}
            tone={totals.overdueDebtCount > 0 ? "danger" : "default"}
            caption={plural(totals.overdueDebtCount, "debt")}
          />
          <StatTile
            label="Due soon"
            minor={totals.dueSoonMinor}
            tone={totals.dueSoonDebtCount > 0 ? "warning" : "default"}
            caption={`Next ${DUE_SOON_WINDOW_DAYS} days`}
          />
        </div>

        {overdue.length > 0 ? (
          <Section title="Overdue">
            <ListCard>
              {overdue.map((debt) => (
                <DueDebtRow key={debt.id} debt={debt} />
              ))}
            </ListCard>
          </Section>
        ) : null}

        {dueSoon.length > 0 ? (
          <Section title="Due soon">
            <ListCard>
              {dueSoon.map((debt) => (
                <DueDebtRow key={debt.id} debt={debt} />
              ))}
            </ListCard>
          </Section>
        ) : null}

        <Section
          title="Recent activity"
          action={
            recent.length > 0 ? (
              <Link
                href="/activity"
                className="text-primary inline-flex items-center gap-0.5 text-xs font-medium hover:underline"
              >
                View all
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            ) : null
          }
        >
          {recent.length > 0 ? (
            <ListCard>
              {recent.map((entry) => (
                <ActivityItem key={entry.key} entry={entry} />
              ))}
            </ListCard>
          ) : (
            <div className="px-4">
              <EmptyState
                title="Nothing recorded yet."
                description="Borrowings and repayments will appear here as you add them."
              />
            </div>
          )}
        </Section>
      </div>
    </>
  );
}
