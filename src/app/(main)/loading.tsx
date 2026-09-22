import {
  PageHeaderSkeleton,
  RowListSkeleton,
  StatGridSkeleton,
  SummaryCardSkeleton,
} from "@/components/app/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-4 space-y-6">
        <SummaryCardSkeleton />
        <StatGridSkeleton />
        <RowListSkeleton />
      </div>
    </>
  );
}
