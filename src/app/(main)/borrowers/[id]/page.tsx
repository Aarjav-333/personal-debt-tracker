import { Phone, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Amount } from "@/components/app/amount";
import { BorrowerActions } from "@/components/app/borrower-actions";
import { DebtCard } from "@/components/app/debt-card";
import { EmptyState } from "@/components/app/empty-state";
import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { WhatsAppReminder } from "@/components/app/whatsapp-reminder";
import { Button } from "@/components/ui/button";
import { summariseBorrowers, toDebtViews } from "@/lib/aggregate";
import { getBorrower, getDebtsForBorrower, getRepaymentsForBorrower } from "@/server/queries";
import { getToday } from "@/server/today";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const borrower = await getBorrower(id);
  return { title: borrower?.name ?? "Borrower" };
}

export default async function BorrowerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const borrower = await getBorrower(id);
  if (!borrower) notFound();

  const [debtRows, repayments, today] = await Promise.all([
    getDebtsForBorrower(id),
    getRepaymentsForBorrower(id),
    getToday(),
  ]);

  const debts = toDebtViews(debtRows, today);
  const summary = summariseBorrowers([borrower], debts)[0];

  const active = debts.filter((debt) => debt.outstandingMinor > 0);
  const settled = debts.filter((debt) => debt.outstandingMinor <= 0);

  return (
    <>
      <PageHeader
        title={borrower.name}
        backHref="/borrowers"
        backLabel="Borrowers"
        subtitle={
          borrower.phone ? (
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5" aria-hidden />
              {borrower.phone}
            </span>
          ) : undefined
        }
        action={
          <BorrowerActions
            borrower={borrower}
            totals={{
              debtCount: debts.length,
              repaymentCount: repayments.length,
              outstandingMinor: summary.outstandingMinor,
            }}
          />
        }
      />

      <div className="mt-5 space-y-6">
        <div className="px-4">
          <div className="bg-card border-border rounded-2xl border p-5">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              Outstanding
            </p>
            <Amount
              minor={summary.outstandingMinor}
              className={`mt-1 block text-4xl font-semibold tracking-tight ${
                summary.outstandingMinor <= 0
                  ? "text-money-positive"
                  : summary.overdueDebtCount > 0
                    ? "text-money-danger"
                    : ""
              }`}
            />

            <dl className="border-border mt-4 grid grid-cols-2 gap-4 border-t pt-4">
              <div>
                <dt className="text-muted-foreground text-xs">Total borrowed</dt>
                <dd className="text-base font-semibold">
                  <Amount minor={summary.totalBorrowedMinor} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Total returned</dt>
                <dd className="text-money-positive text-base font-semibold">
                  <Amount minor={summary.totalRepaidMinor} />
                </dd>
              </div>
            </dl>

            {borrower.notes ? (
              <p className="text-muted-foreground border-border mt-4 border-t pt-4 text-sm whitespace-pre-line">
                {borrower.notes}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex gap-2 px-4">
          <Button asChild className="flex-1">
            <Link href={`/add?borrower=${borrower.id}`}>
              <Plus className="size-4" aria-hidden />
              Add borrowing
            </Link>
          </Button>
          {borrower.phone ? (
            <WhatsAppReminder
              phone={borrower.phone}
              borrowerName={borrower.name}
              outstandingMinor={summary.outstandingMinor}
              size="default"
            />
          ) : null}
        </div>

        {debts.length === 0 ? (
          <div className="px-4">
            <EmptyState
              title={`${borrower.name} hasn't borrowed anything yet.`}
              description="Record their first borrowing to start tracking it."
              action={
                <Button asChild>
                  <Link href={`/add?borrower=${borrower.id}`}>Add borrowing</Link>
                </Button>
              }
            />
          </div>
        ) : null}

        {active.length > 0 ? (
          <Section title={`Outstanding borrowings (${active.length})`}>
            <ul className="space-y-3 px-4">
              {active.map((debt) => (
                <li key={debt.id}>
                  <DebtCard debt={debt} />
                </li>
              ))}
            </ul>
          </Section>
        ) : null}

        {settled.length > 0 ? (
          <Section title={`Settled (${settled.length})`}>
            <ul className="space-y-3 px-4">
              {settled.map((debt) => (
                <li key={debt.id}>
                  <DebtCard debt={debt} />
                </li>
              ))}
            </ul>
          </Section>
        ) : null}
      </div>
    </>
  );
}
