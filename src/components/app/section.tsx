import { cn } from "cn";

/** A titled block on a screen, with an optional link on the right. */
export function Section({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between gap-3 px-4">
        <h2 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Bordered container for a list of rows, with hairlines between them. */
export function ListCard({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("bg-card border-border divide-border mx-4 divide-y overflow-hidden rounded-xl border", className)}>
      {children}
    </div>
  );
}
