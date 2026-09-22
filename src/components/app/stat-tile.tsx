import { cn } from "cn";

import { Amount } from "@/components/app/amount";
import type { Minor } from "@/lib/money";

interface StatTileProps {
  label: string;
  minor: Minor;
  caption?: string;
  tone?: "default" | "positive" | "warning" | "danger";
  className?: string;
}

const TONES = {
  default: "text-foreground",
  positive: "text-money-positive",
  warning: "text-money-warning",
  danger: "text-money-danger",
} as const;

/** One figure from the dashboard, with the label always spelled out. */
export function StatTile({ label, minor, caption, tone = "default", className }: StatTileProps) {
  return (
    <div className={cn("bg-card border-border rounded-xl border p-3.5", className)}>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <Amount minor={minor} className={cn("mt-1 block text-lg font-semibold", TONES[tone])} />
      {caption ? <p className="text-muted-foreground mt-0.5 text-xs">{caption}</p> : null}
    </div>
  );
}
