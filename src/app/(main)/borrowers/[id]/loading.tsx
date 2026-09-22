import { CardListSkeleton, PageHeaderSkeleton, SummaryCardSkeleton } from "@/components/app/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-5 space-y-6">
        <SummaryCardSkeleton />
        <CardListSkeleton count={2} />
      </div>
    </>
  );
}
