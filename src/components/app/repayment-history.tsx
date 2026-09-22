"use client";

import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Amount } from "@/components/app/amount";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { EmptyState } from "@/components/app/empty-state";
import {
  EditRepaymentDrawer,
  type ExistingRepayment,
  type RepaymentDebtSummary,
} from "@/components/app/repayment-drawer";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { runAction } from "@/lib/client-actions";
import { formatDayMonth } from "@/lib/dates";
import { deleteRepayment } from "@/server/actions/repayments";

export interface RepaymentEntry extends ExistingRepayment {
  createdAt: string;
}

/**
 * Chronological repayment history for one debt, newest first.
 *
 * Every installment keeps its own row permanently - this list is the record of
 * what actually came back and when.
 */
export function RepaymentHistory({
  debt,
  repayments,
}: {
  debt: RepaymentDebtSummary;
  repayments: RepaymentEntry[];
}) {
  if (repayments.length === 0) {
    return (
      <div className="px-4">
        <EmptyState
          title="No repayments recorded yet."
          description="Nothing has come back against this debt so far. Recording one will not change the original amount borrowed."
        />
      </div>
    );
  }

  return (
    <ul className="bg-card border-border divide-border mx-4 divide-y overflow-hidden rounded-xl border">
      {repayments.map((repayment) => (
        <RepaymentRow key={repayment.id} debt={debt} repayment={repayment} />
      ))}
    </ul>
  );
}

function RepaymentRow({
  debt,
  repayment,
}: {
  debt: RepaymentDebtSummary;
  repayment: RepaymentEntry;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Removing this installment puts its amount straight back on the balance.
  const outstandingAfterDelete = debt.outstandingMinor + repayment.amountMinor;

  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <Amount minor={repayment.amountMinor} className="text-money-positive font-semibold" />
          <span className="text-muted-foreground text-xs">{formatDayMonth(repayment.repaymentDate)}</span>
        </div>
        {repayment.method || repayment.notes ? (
          <p className="text-muted-foreground mt-0.5 truncate text-xs">
            {[repayment.method, repayment.notes].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="shrink-0" aria-label="Repayment actions">
            <MoreHorizontal className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden />
            Edit repayment
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 className="size-4" aria-hidden />
            Delete repayment
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Rendered outside the menu so closing the menu cannot unmount them. */}
      <EditRepaymentDrawer
        debt={debt}
        repayment={repayment}
        open={editing}
        onOpenChange={setEditing}
      />

      <ConfirmDialog
        destructive
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this repayment?"
        confirmLabel="Delete repayment"
        description={
          <>
            <p>
              Removing this repayment will increase the outstanding balance from{" "}
              <Amount minor={debt.outstandingMinor} className="text-foreground font-medium" /> to{" "}
              <Amount minor={outstandingAfterDelete} className="text-foreground font-medium" />.
            </p>
            <p className="text-muted-foreground">
              The <Amount minor={repayment.amountMinor} /> recorded on{" "}
              {formatDayMonth(repayment.repaymentDate)} will be removed permanently.
            </p>
          </>
        }
        onConfirm={async () => {
          const result = await runAction(() => deleteRepayment(repayment.id), {
            success: "Repayment deleted",
          });
          if (result?.ok) router.refresh();
          return result;
        }}
      />
    </li>
  );
}
