import type { Metadata } from "next";

import { NewDebtForm } from "@/components/app/new-debt-form";
import { PageHeader } from "@/components/app/page-header";
import { toDateOnly } from "@/lib/dates";
import { getLedger } from "@/server/queries";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Add a borrowing" };

export default async function AddPage({
  searchParams,
}: {
  searchParams: Promise<{ borrower?: string }>;
}) {
  const [{ borrowers }, { borrower }, today] = await Promise.all([
    getLedger(),
    searchParams,
    getToday(),
  ]);

  return (
    <>
      <PageHeader
        title="Add a borrowing"
        subtitle="Record money you have just lent out"
        backHref="/"
        backLabel="Overview"
      />
      <div className="mt-6 px-4">
        <NewDebtForm
          borrowers={borrowers.map(({ id, name, phone }) => ({ id, name, phone }))}
          defaultBorrowerId={borrower}
          today={toDateOnly(today)}
        />
      </div>
    </>
  );
}
