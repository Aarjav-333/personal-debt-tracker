import type { Metadata } from "next";

import { ActivityFeed } from "@/components/app/activity-feed";
import { PageHeader } from "@/components/app/page-header";
import { buildTimeline } from "@/lib/activity";
import { toDebtViews } from "@/lib/aggregate";
import { getActivity, getLedger } from "@/server/queries";
import { getToday } from "@/server/today";

export const metadata: Metadata = { title: "Activity" };

export default async function ActivityPage() {
  const [activityRows, { debts }, today] = await Promise.all([
    getActivity(300),
    getLedger(),
    getToday(),
  ]);

  // Debts are loaded alongside the feed so "became overdue" markers can be
  // derived - nothing is written to the database when a due date passes.
  const entries = buildTimeline(activityRows, toDebtViews(debts, today));

  return (
    <>
      <PageHeader title="Activity" subtitle="Every borrowing and repayment, newest first" />
      <div className="mt-5">
        <ActivityFeed entries={entries} />
      </div>
    </>
  );
}
