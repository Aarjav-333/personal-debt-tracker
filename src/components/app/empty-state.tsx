import { cn } from "cn";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

/**
 * Shown wherever there is nothing to list yet.
 *
 * Always says what the screen is for and offers the next step, rather than
 * leaving an empty table behind.
 */
export function EmptyState({ icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "border-border/70 flex flex-col items-center rounded-xl border border-dashed px-6 py-12 text-center",
        className,
      )}
    >
      {icon ? (
        <div className="bg-muted text-muted-foreground mb-4 flex size-12 items-center justify-center rounded-full">
          {icon}
        </div>
      ) : null}
      <p className="text-base font-semibold text-balance">{title}</p>
      {description ? (
        <p className="text-muted-foreground mt-1.5 max-w-xs text-sm text-balance">{description}</p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
