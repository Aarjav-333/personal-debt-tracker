import { CardListSkeleton, PageHeaderSkeleton } from "@/components/app/skeletons";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <>
      <PageHeaderSkeleton />
      <div className="mt-5 space-y-4">
        <div className="px-4">
          <Skeleton className="h-9 w-full" />
        </div>
        <div className="flex gap-2 px-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-8 w-20 rounded-full" />
          ))}
        </div>
        <CardListSkeleton />
      </div>
    </>
  );
}
