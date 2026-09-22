import { cn } from "cn";

import { STATUS_META, type DebtStatus } from "@/lib/debt-status";

/**
 * Status pill.
 *
 * The written label is always present: colour reinforces the state, it never
 * carries it on its own.
 */
export function StatusBadge({ status, className }: { status: DebtStatus; className?: string }) {
  const meta = STATUS_META[status];

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium",
        meta.badgeClass,
        className,
      )}
    >
      <span className={cn("size-1.5 shrink-0 rounded-full", meta.dotClass)} aria-hidden />
      {meta.label}
    </span>
  );
}
