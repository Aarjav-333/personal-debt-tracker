import { PageHeaderSkeleton, RowListSkeleton } from "@/components/app/skeletons";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-5 space-y-6">
        <RowListSkeleton count={4} />
      </div>
    </>
  );
}
