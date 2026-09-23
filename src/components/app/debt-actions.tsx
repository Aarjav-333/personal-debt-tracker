"use client";

import { CheckCheck, Loader2, MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Amount } from "@/components/app/amount";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { useCurrency } from "@/components/app/currency-provider";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useResetOnClose } from "@/hooks/use-reset-on-close";
import type { DebtView } from "@/lib/aggregate";
import { runAction } from "@/lib/client-actions";
import { formatDayMonth, todayDateOnly } from "@/lib/dates";
import { formatMinor, fromMinor } from "@/lib/money";
import { fieldErrorsFrom, updateDebtSchema } from "@/lib/validators";
import { deleteDebt, updateDebt } from "@/server/actions/debts";
import { settleDebt } from "@/server/actions/repayments";

/**
 * Debt-level actions: correct the record, settle it, or remove it.
 *
 * "Mark fully paid" deliberately writes a repayment for the whole remaining
 * balance rather than flipping a status - the money still has to be accounted
 * for somewhere.
 */
export function DebtActions({ debt, repaymentCount }: { debt: DebtView; repaymentCount: number }) {
  const router = useRouter();
  const currency = useCurrency();
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [settling, setSettling] = useState(false);

  const settled = debt.outstandingMinor <= 0;
  const remaining = formatMinor(debt.outstandingMinor, { currency });

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Debt actions">
            <MoreHorizontal className="size-5" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        {/* Dialogs live outside the menu: Radix unmounts menu contents on close,
            which would tear down anything rendered inside it. */}
        <DropdownMenuContent align="end">
          {!settled ? (
            <DropdownMenuItem onSelect={() => setSettling(true)}>
              <CheckCheck className="size-4" aria-hidden />
              Mark fully paid
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil className="size-4" aria-hidden />
            Edit original debt
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setDeleting(true)}>
            <Trash2 className="size-4" aria-hidden />
            Delete debt
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditDebtDrawer debt={debt} open={editing} onOpenChange={setEditing} />

      <ConfirmDialog
        open={settling}
        onOpenChange={setSettling}
        title={`Mark the remaining ${remaining} as received today?`}
        confirmLabel="Record full repayment"
        description={
          <>
            <p>
              A repayment of <Amount minor={debt.outstandingMinor} /> dated today will be added to{" "}
              {debt.borrowerName}&rsquo;s history.
            </p>
            <p className="text-muted-foreground">
              The <Amount minor={debt.originalMinor} /> originally borrowed stays on record, and the
              debt becomes Paid.
            </p>
          </>
        }
        onConfirm={async () => {
          const result = await runAction(
            () => settleDebt({ debtId: debt.id, repaymentDate: todayDateOnly(), method: null, notes: null }),
            { success: `${debt.borrowerName}'s debt is fully repaid` },
          );
          if (result?.ok) router.refresh();
          return result;
        }}
      />

      <ConfirmDialog
        destructive
        open={deleting}
        onOpenChange={setDeleting}
        title="Delete this debt?"
        confirmLabel="Delete debt"
        description={
          <>
            <p>This will permanently delete this debt and its repayment history.</p>
            <p className="text-muted-foreground">
              The <Amount minor={debt.originalMinor} /> borrowed on{" "}
              {formatDayMonth(debt.borrowedDate)}
              {repaymentCount > 0 ? (
                <>
                  {" "}
                  and {repaymentCount} repayment{repaymentCount === 1 ? "" : "s"} totalling{" "}
                  <Amount minor={debt.repaidMinor} />
                </>
              ) : null}{" "}
              will be removed. This cannot be undone.
            </p>
          </>
        }
        onConfirm={async () => {
          const result = await runAction(() => deleteDebt(debt.id), { success: "Debt deleted" });
          if (result?.ok) {
            router.replace(`/borrowers/${debt.borrowerId}`);
            router.refresh();
          }
          return result;
        }}
      />
    </>
  );
}

/**
 * Corrects what was originally lent.
 *
 * Kept visibly distinct from recording a repayment, and the database refuses
 * to take the amount below what has already come back.
 */
function EditDebtDrawer({
  debt,
  open,
  onOpenChange,
}: {
  debt: DebtView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [amount, setAmount] = useState(String(fromMinor(debt.originalMinor)));
  const [reason, setReason] = useState(debt.reason ?? "");
  const [borrowedDate, setBorrowedDate] = useState(debt.borrowedDate);
  const [expectedReturnDate, setExpectedReturnDate] = useState(debt.expectedReturnDate ?? "");
  const [notes, setNotes] = useState(debt.notes ?? "");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  useResetOnClose(open, () => {
    setAmount(String(fromMinor(debt.originalMinor)));
    setReason(debt.reason ?? "");
    setBorrowedDate(debt.borrowedDate);
    setExpectedReturnDate(debt.expectedReturnDate ?? "");
    setNotes(debt.notes ?? "");
    setFieldErrors({});
  });

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = { id: debt.id, amount, reason, borrowedDate, expectedReturnDate, notes };
    const parsed = updateDebtSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = await runAction(() => updateDebt(payload), { success: "Debt updated" });
      if (result?.ok) onOpenChange(false);
      else if (result && !result.ok) setFieldErrors(result.fieldErrors ?? {});
    });
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
      <DrawerContent className="mx-auto max-w-lg">
        <form onSubmit={submit} noValidate className="overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>Edit the original debt</DrawerTitle>
            <DrawerDescription>
              Only for correcting what was originally lent. To record money coming back, add a
              repayment instead.
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-debt-amount">Original amount borrowed</Label>
              <Input
                id="edit-debt-amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                aria-invalid={Boolean(fieldErrors.amount)}
                className="amount h-14 text-2xl font-semibold"
              />
              {fieldErrors.amount ? (
                <p className="text-destructive text-sm">{fieldErrors.amount}</p>
              ) : debt.repaidMinor > 0 ? (
                <p className="text-muted-foreground text-xs">
                  Cannot be lowered below the <Amount minor={debt.repaidMinor} /> already repaid.
                </p>
              ) : null}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-debt-reason">Reason</Label>
              <Input
                id="edit-debt-reason"
                maxLength={200}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="edit-debt-borrowed">Borrowed on</Label>
                <Input
                  id="edit-debt-borrowed"
                  type="date"
                  value={borrowedDate}
                  max={todayDateOnly()}
                  onChange={(event) => setBorrowedDate(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.borrowedDate)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-debt-expected">Expected back</Label>
                <Input
                  id="edit-debt-expected"
                  type="date"
                  min={borrowedDate}
                  value={expectedReturnDate}
                  onChange={(event) => setExpectedReturnDate(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.expectedReturnDate)}
                />
              </div>
            </div>

            {fieldErrors.borrowedDate ? (
              <p className="text-destructive text-sm">{fieldErrors.borrowedDate}</p>
            ) : null}
            {fieldErrors.expectedReturnDate ? (
              <p className="text-destructive text-sm">{fieldErrors.expectedReturnDate}</p>
            ) : null}

            <div className="space-y-1.5">
              <Label htmlFor="edit-debt-notes">Notes</Label>
              <Textarea
                id="edit-debt-notes"
                rows={3}
                maxLength={2000}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
          </div>

          <DrawerFooter>
            <Button type="submit" size="lg" disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
              Save changes
            </Button>
            <DrawerClose asChild>
              <Button type="button" size="lg" variant="ghost">
                Cancel
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
