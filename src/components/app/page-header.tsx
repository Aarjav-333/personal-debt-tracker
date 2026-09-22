import { cn } from "cn";
import { ChevronLeft } from "lucide-react";
import Link from "next/link";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  /** Renders a back chevron pointing at this route. */
  backHref?: string;
  backLabel?: string;
  className?: string;
}

/** Screen title block, padded clear of the iPhone status bar and notch. */
export function PageHeader({ title, subtitle, action, backHref, backLabel, className }: PageHeaderProps) {
  return (
    <header className={cn("pt-safe px-4", className)}>
      {backHref ? (
        <Link
          href={backHref}
          className="text-muted-foreground hover:text-foreground tap-transparent -ml-1 mt-3 inline-flex items-center gap-0.5 text-sm font-medium transition-colors"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {backLabel ?? "Back"}
        </Link>
      ) : null}

      <div className={cn("flex items-start justify-between gap-3", backHref ? "mt-2" : "mt-4")}>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <div className="text-muted-foreground mt-0.5 text-sm">{subtitle}</div> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}
