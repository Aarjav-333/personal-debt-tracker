import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Amount } from "@/components/app/amount";
import { DebtActions } from "@/components/app/debt-actions";
import { PageHeader } from "@/components/app/page-header";
import { AddRepaymentDrawer } from "@/components/app/repayment-drawer";
import { RepaymentHistory, type RepaymentEntry } from "@/components/app/repayment-history";
import { RepaymentProgress } from "@/components/app/repayment-progress";
import { Section } from "@/components/app/section";
import { StatusBadge } from "@/components/app/status-badge";
import { WhatsAppReminder } from "@/components/app/whatsapp-reminder";
import { Button } from "@/components/ui/button";
import { toDebtView } from "@/lib/aggregate";
import { formatFullDate, formatRelativeDueDate } from "@/lib/dates";
import { toMinor } from "@/lib/money";
import { getDebtBalance, getRepayments } from "@/server/queries";
import { getToday } from "@/server/today";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const debt = await getDebtBalance(id);
  return { title: debt ? `${debt.borrower_name}'s borrowing` : "Debt" };
}

export default async function DebtDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const row = await getDebtBalance(id);
  if (!row) notFound();

  const [today, repaymentRows] = await Promise.all([getToday(), getRepayments(id)]);
  const debt = toDebtView(row, today);

  const repayments: RepaymentEntry[] = repaymentRows.map((repayment) => ({
    id: repayment.id,
    amountMinor: toMinor(repayment.amount),
    repaymentDate: repayment.repayment_date,
    method: repayment.method,
    notes: repayment.notes,
    createdAt: repayment.created_at,
  }));

  const summary = {
    id: debt.id,
    borrowerName: debt.borrowerName,
    originalMinor: debt.originalMinor,
    repaidMinor: debt.repaidMinor,
    outstandingMinor: debt.outstandingMinor,
  };

  const settled = debt.outstandingMinor <= 0;
  const dueLabel = formatRelativeDueDate(debt.expectedReturnDate);

  return (
    <>
      <PageHeader
        title={debt.borrowerName}
        backHref={`/borrowers/${debt.borrowerId}`}
        backLabel="Back"
        subtitle={`Borrowed ${formatFullDate(debt.borrowedDate)}`}
        action={<DebtActions debt={debt} repaymentCount={repayments.length} />}
      />

      <div className="mt-5 space-y-6">
        <div className="px-4">
          <div className="bg-card border-border rounded-2xl border p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                  Outstanding
                </p>
                <Amount
                  minor={debt.outstandingMinor}
                  className={`mt-1 block text-4xl font-semibold tracking-tight ${
                    settled ? "text-money-positive" : debt.status === "overdue" ? "text-money-danger" : ""
                  }`}
                />
              </div>
              <StatusBadge status={debt.status} className="mt-1" />
            </div>

            <dl className="border-border mt-4 grid grid-cols-2 gap-4 border-t pt-4">
              <div>
                <dt className="text-muted-foreground text-xs">Originally borrowed</dt>
                <dd className="text-base font-semibold">
                  <Amount minor={debt.originalMinor} />
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground text-xs">Repaid so far</dt>
                <dd className="text-money-positive text-base font-semibold">
                  <Amount minor={debt.repaidMinor} />
                </dd>
              </div>
            </dl>

            <RepaymentProgress
              className="mt-4"
              repaidMinor={debt.repaidMinor}
              originalMinor={debt.originalMinor}
              outstandingMinor={debt.outstandingMinor}
              percent={debt.progressPercent}
            />
          </div>
        </div>

        {!settled ? (
          <div className="flex gap-2 px-4">
            <AddRepaymentDrawer
              debt={summary}
              trigger={
                <Button size="lg" className="flex-1">
                  Add repayment
                </Button>
              }
            />
            {debt.borrowerPhone ? (
              <WhatsAppReminder
                phone={debt.borrowerPhone}
                borrowerName={debt.borrowerName}
                outstandingMinor={debt.outstandingMinor}
                size="lg"
              />
            ) : null}
          </div>
        ) : null}

        <Section title="Details">
          <dl className="bg-card border-border divide-border mx-4 divide-y overflow-hidden rounded-xl border text-sm">
            <Detail label="Reason" value={debt.reason ?? "Not recorded"} muted={!debt.reason} />
            <Detail label="Borrowed on" value={formatFullDate(debt.borrowedDate)} />
            <Detail
              label="Expected back"
              value={
                debt.expectedReturnDate
                  ? `${formatFullDate(debt.expectedReturnDate)}${!settled && dueLabel ? ` · ${dueLabel}` : ""}`
                  : "No date agreed"
              }
              muted={!debt.expectedReturnDate}
            />
            {debt.notes ? <Detail label="Notes" value={debt.notes} /> : null}
          </dl>
        </Section>

        <Section
          title={`Repayment history${repayments.length > 0 ? ` (${repayments.length})` : ""}`}
          action={
            repayments.length > 0 ? (
              <span className="text-muted-foreground text-xs">
                <Amount minor={debt.repaidMinor} className="text-money-positive font-medium" /> repaid
              </span>
            ) : null
          }
        >
          <RepaymentHistory debt={summary} repayments={repayments} />
        </Section>
      </div>
    </>
  );
}

function Detail({ label, value, muted = false }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className={`text-right ${muted ? "text-muted-foreground" : "font-medium"} whitespace-pre-line`}>
        {value}
      </dd>
    </div>
  );
}
