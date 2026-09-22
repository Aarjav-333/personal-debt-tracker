import { Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { BorrowersBrowser } from "@/components/app/borrowers-browser";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { summariseBorrowers, toDebtViews } from "@/lib/aggregate";
import { getLedger } from "@/server/queries";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Borrowers" };

export default async function BorrowersPage() {
  const [{ borrowers, debts }, today] = await Promise.all([getLedger(), getToday()]);
  const summaries = summariseBorrowers(borrowers, toDebtViews(debts, today));

  const owing = summaries.filter((borrower) => borrower.outstandingMinor > 0).length;

  return (
    <>
      <PageHeader
        title="Borrowers"
        subtitle={
          summaries.length > 0
            ? `${owing} of ${summaries.length} still owe you money`
            : "Everyone you have lent to"
        }
        action={
          <Button asChild size="sm" variant="outline">
            <Link href="/add">
              <Plus className="size-4" aria-hidden />
              Add
            </Link>
          </Button>
        }
      />

      <div className="mt-5">
        <BorrowersBrowser borrowers={summaries} />
      </div>
    </>
  );
}
