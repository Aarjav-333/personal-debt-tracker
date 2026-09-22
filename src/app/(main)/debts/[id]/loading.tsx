import { PageHeaderSkeleton, RowListSkeleton, SummaryCardSkeleton } from "@/components/app/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-5 space-y-6">
        <SummaryCardSkeleton />
        <RowListSkeleton count={3} />
      </div>
    </>
  );
}
