import { Skeleton } from "@/components/ui/skeleton";

/**
 * Loading placeholders.
 *
 * Shaped like the content they stand in for, so the screen does not jump when
 * the real figures arrive.
 */

export function PageHeaderSkeleton() {
  return (
    <div className="pt-safe px-4">
      <div className="mt-4 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-56" />
      </div>
    </div>
  );
}

export function SummaryCardSkeleton() {
  return (
    <div className="px-4">
      <div className="border-border space-y-4 rounded-2xl border p-5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  );
}

export function StatGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 px-4">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="border-border space-y-2 rounded-xl border p-3.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  );
}

export function CardListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 px-4">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="border-border space-y-3 rounded-xl border p-4">
          <div className="flex items-center justify-between">
            <Skeleton className="h-5 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-3 w-40" />
          <div className="grid grid-cols-2 gap-3 pt-1">
            <Skeleton className="h-9" />
            <Skeleton className="h-9" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RowListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="border-border divide-border mx-4 divide-y rounded-xl border">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 px-4 py-3">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-4 w-16" />
        </div>
      ))}
    </div>
  );
}
