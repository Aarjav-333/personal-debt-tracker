"use client";

import { cn } from "cn";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";

import { Amount } from "@/components/app/amount";
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
  DrawerTrigger,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { runAction } from "@/lib/client-actions";
import { todayDateOnly } from "@/lib/dates";
import { formatMinor, fromMinor, parseAmountInput } from "@/lib/money";
import { createRepayment, settleDebt, updateRepayment } from "@/server/actions/repayments";

export interface RepaymentDebtSummary {
  id: string;
  borrowerName: string;
  originalMinor: number;
  repaidMinor: number;
  outstandingMinor: number;
}

export interface ExistingRepayment {
  id: string;
  amountMinor: number;
  repaymentDate: string;
  method: string | null;
  notes: string | null;
}

const METHODS = ["Cash", "UPI", "Bank", "Cheque"] as const;

type Step = "choose" | "form" | "confirm";

// ---------------------------------------------------------------------------
// Add a repayment
// ---------------------------------------------------------------------------

/**
 * Records money coming back against a debt.
 *
 * Three deliberate steps: offer the full balance as one tap, take a partial
 * amount if that is not it, then show the before/after balances before
 * anything is written. Money entry is easy to fat-finger on a phone, so the
 * confirmation is not optional.
 */
export function AddRepaymentDrawer({
  debt,
  trigger,
}: {
  debt: RepaymentDebtSummary;
  trigger: React.ReactNode;
}) {
  const currency = useCurrency();
  const money = (minor: number) => formatMinor(minor, { currency });

  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("choose");
  const [settlingInFull, setSettlingInFull] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [date, setDate] = useState(todayDateOnly);
  const [method, setMethod] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Reset to a clean slate whenever the drawer is dismissed.
  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setStep("choose");
      setSettlingInFull(false);
      setAmountText("");
      setDate(todayDateOnly());
      setMethod(null);
      setNotes("");
      setError(null);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open]);

  const parsed = parseAmountInput(amountText);
  const amountMinor = parsed.ok ? parsed.minor : 0;
  const newOutstanding = debt.outstandingMinor - amountMinor;

  function goToConfirm() {
    const result = parseAmountInput(amountText);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.minor > debt.outstandingMinor) {
      setError(`That is more than the ${money(debt.outstandingMinor)} still outstanding.`);
      return;
    }
    setError(null);
    setStep("confirm");
  }

  function handleFullPayment() {
    setSettlingInFull(true);
    setAmountText(String(fromMinor(debt.outstandingMinor)));
    setError(null);
    setStep("confirm");
  }

  /**
   * Leaves the settle-in-full path.
   *
   * The flag must be cleared on every route back to the form, or a partial
   * amount entered afterwards would still be submitted as a full settlement.
   */
  function goToPartialForm() {
    setSettlingInFull(false);
    setError(null);
    setStep("form");
  }

  function submit() {
    // Belt and braces: only settle when the amount on the confirmation screen
    // really is the whole outstanding balance, whatever the flag says.
    const settleInFull = settlingInFull && amountMinor === debt.outstandingMinor;

    startTransition(async () => {
      // Settling goes through settle_debt(), which measures the exact remainder
      // under a row lock rather than trusting the figure on screen.
      const result = settleInFull
        ? await runAction(() => settleDebt({ debtId: debt.id, repaymentDate: date, method, notes }), {
            success: `${debt.borrowerName}'s debt is fully repaid`,
          })
        : await runAction(
            () => createRepayment({ debtId: debt.id, amount: amountText, repaymentDate: date, method, notes }),
            { success: `Recorded ${money(amountMinor)} from ${debt.borrowerName}` },
          );

      if (result?.ok) setOpen(false);
      else if (result && !result.ok) {
        setError(result.error);
        setSettlingInFull(false);
        setStep("form");
      }
    });
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent className="mx-auto max-w-lg">
        <div className="overflow-y-auto">
          {step === "choose" ? (
            <>
              <DrawerHeader>
                <DrawerTitle>Add repayment</DrawerTitle>
                <DrawerDescription>From {debt.borrowerName}</DrawerDescription>
              </DrawerHeader>

              <div className="px-4">
                <OutstandingPanel outstandingMinor={debt.outstandingMinor} />
              </div>

              <DrawerFooter>
                <Button size="lg" onClick={handleFullPayment}>
                  Pay {money(debt.outstandingMinor)} in full
                </Button>
                <Button size="lg" variant="outline" onClick={goToPartialForm}>
                  Enter partial amount
                </Button>
                <DrawerClose asChild>
                  <Button size="lg" variant="ghost">
                    Cancel
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </>
          ) : null}

          {step === "form" ? (
            <>
              <DrawerHeader>
                <DrawerTitle>How much came back?</DrawerTitle>
                <DrawerDescription>From {debt.borrowerName}</DrawerDescription>
              </DrawerHeader>

              <div className="space-y-4 px-4">
                <OutstandingPanel outstandingMinor={debt.outstandingMinor} />

                <RepaymentFields
                  amountText={amountText}
                  onAmountChange={(value) => {
                    setAmountText(value);
                    setError(null);
                  }}
                  date={date}
                  onDateChange={setDate}
                  method={method}
                  onMethodChange={setMethod}
                  notes={notes}
                  onNotesChange={setNotes}
                  error={error}
                  autoFocus
                />
              </div>

              <DrawerFooter>
                <Button size="lg" onClick={goToConfirm} disabled={!amountText.trim()}>
                  Continue
                </Button>
                <Button size="lg" variant="ghost" onClick={() => setStep("choose")}>
                  <ArrowLeft className="size-4" aria-hidden />
                  Back
                </Button>
              </DrawerFooter>
            </>
          ) : null}

          {step === "confirm" ? (
            <>
              <DrawerHeader>
                <DrawerTitle>
                  {settlingInFull
                    ? `Mark the remaining ${money(debt.outstandingMinor)} as received?`
                    : `Record ${money(amountMinor)} repayment from ${debt.borrowerName}?`}
                </DrawerTitle>
                <DrawerDescription>
                  This adds a repayment to the history. The original{" "}
                  {money(debt.originalMinor)} borrowed stays on record.
                </DrawerDescription>
              </DrawerHeader>

              <div className="px-4">
                <BalanceBreakdown
                  previousMinor={debt.outstandingMinor}
                  repaymentMinor={amountMinor}
                  nextMinor={newOutstanding}
                />
                {error ? <p className="text-destructive mt-3 text-sm">{error}</p> : null}
              </div>

              <DrawerFooter>
                <Button size="lg" onClick={submit} disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Confirm repayment
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => {
                    setSettlingInFull(false);
                    setStep(settlingInFull ? "choose" : "form");
                  }}
                >
                  Cancel
                </Button>
              </DrawerFooter>
            </>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Edit an existing repayment
// ---------------------------------------------------------------------------

/**
 * Corrects a repayment that was recorded wrongly.
 *
 * The ceiling is the debt's original amount minus every *other* repayment, so
 * an entry can be revised upwards as well as down.
 */
export function EditRepaymentDrawer({
  debt,
  repayment,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  debt: RepaymentDebtSummary;
  repayment: ExistingRepayment;
  /** Omit when driving the drawer from a menu item via `open`/`onOpenChange`. */
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const currency = useCurrency();
  const money = (minor: number) => formatMinor(minor, { currency });

  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;
  const setOpen = isControlled ? (next: boolean) => onOpenChange?.(next) : setUncontrolledOpen;

  const [confirming, setConfirming] = useState(false);
  const [amountText, setAmountText] = useState(String(fromMinor(repayment.amountMinor)));
  const [date, setDate] = useState(repayment.repaymentDate);
  const [method, setMethod] = useState<string | null>(repayment.method);
  const [notes, setNotes] = useState(repayment.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) return;
    const timer = window.setTimeout(() => {
      setConfirming(false);
      setAmountText(String(fromMinor(repayment.amountMinor)));
      setDate(repayment.repaymentDate);
      setMethod(repayment.method);
      setNotes(repayment.notes ?? "");
      setError(null);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [open, repayment]);

  const otherRepaymentsMinor = debt.repaidMinor - repayment.amountMinor;
  const maxAllowedMinor = debt.originalMinor - otherRepaymentsMinor;

  const parsed = parseAmountInput(amountText);
  const amountMinor = parsed.ok ? parsed.minor : 0;
  const nextOutstanding = debt.originalMinor - otherRepaymentsMinor - amountMinor;

  function goToConfirm() {
    const result = parseAmountInput(amountText);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.minor > maxAllowedMinor) {
      setError(
        `At most ${money(maxAllowedMinor)} can be recorded here without exceeding the ${money(debt.originalMinor)} borrowed.`,
      );
      return;
    }
    setError(null);
    setConfirming(true);
  }

  function submit() {
    startTransition(async () => {
      const result = await runAction(
        () =>
          updateRepayment({
            id: repayment.id,
            amount: amountText,
            repaymentDate: date,
            method,
            notes,
          }),
        { success: "Repayment updated" },
      );

      if (result?.ok) setOpen(false);
      else if (result && !result.ok) {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  return (
    <Drawer open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      {trigger ? <DrawerTrigger asChild>{trigger}</DrawerTrigger> : null}
      <DrawerContent className="mx-auto max-w-lg">
        <div className="overflow-y-auto">
          <DrawerHeader>
            <DrawerTitle>{confirming ? "Save this correction?" : "Edit repayment"}</DrawerTitle>
            <DrawerDescription>
              {confirming
                ? "Balances recalculate automatically."
                : `From ${debt.borrowerName}. Correct the amount only if it was recorded wrongly.`}
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-4">
            {confirming ? (
              <EditBreakdown
                previousAmountMinor={repayment.amountMinor}
                nextAmountMinor={amountMinor}
                previousOutstandingMinor={debt.outstandingMinor}
                nextOutstandingMinor={nextOutstanding}
              />
            ) : (
              <RepaymentFields
                amountText={amountText}
                onAmountChange={(value) => {
                  setAmountText(value);
                  setError(null);
                }}
                date={date}
                onDateChange={setDate}
                method={method}
                onMethodChange={setMethod}
                notes={notes}
                onNotesChange={setNotes}
                error={error}
              />
            )}
            {confirming && error ? <p className="text-destructive text-sm">{error}</p> : null}
          </div>

          <DrawerFooter>
            {confirming ? (
              <>
                <Button size="lg" onClick={submit} disabled={pending}>
                  {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
                  Save changes
                </Button>
                <Button size="lg" variant="ghost" disabled={pending} onClick={() => setConfirming(false)}>
                  Back
                </Button>
              </>
            ) : (
              <>
                <Button size="lg" onClick={goToConfirm} disabled={!amountText.trim()}>
                  Continue
                </Button>
                <DrawerClose asChild>
                  <Button size="lg" variant="ghost">
                    Cancel
                  </Button>
                </DrawerClose>
              </>
            )}
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Shared pieces
// ---------------------------------------------------------------------------

function OutstandingPanel({ outstandingMinor }: { outstandingMinor: number }) {
  return (
    <div className="bg-muted/60 rounded-xl px-4 py-3 text-center">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">Outstanding</p>
      <Amount minor={outstandingMinor} className="mt-0.5 block text-3xl font-semibold" />
    </div>
  );
}

function BreakdownRow({
  label,
  children,
  emphasis = false,
}: {
  label: string;
  children: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-3",
        emphasis && "bg-muted/40 rounded-b-xl",
      )}
    >
      <dt className={emphasis ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/** Before and after for a new repayment. */
function BalanceBreakdown({
  previousMinor,
  repaymentMinor,
  nextMinor,
}: {
  previousMinor: number;
  repaymentMinor: number;
  nextMinor: number;
}) {
  return (
    <dl className="border-border divide-border divide-y rounded-xl border text-sm">
      <BreakdownRow label="Previous outstanding">
        <Amount minor={previousMinor} className="font-medium" />
      </BreakdownRow>
      <BreakdownRow label="Repayment">
        <span className="text-money-positive font-medium">
          {"−"}
          <Amount minor={repaymentMinor} />
        </span>
      </BreakdownRow>
      <BreakdownRow label="New outstanding" emphasis>
        <Amount minor={nextMinor} className="text-base font-semibold" />
      </BreakdownRow>
    </dl>
  );
}

/**
 * Before and after for a *correction*.
 *
 * Shown as old-amount vs new-amount rather than as a signed delta, because
 * "you recorded 2,000, it should be 1,500" is the question actually being
 * answered - the change in outstanding follows from it.
 */
function EditBreakdown({
  previousAmountMinor,
  nextAmountMinor,
  previousOutstandingMinor,
  nextOutstandingMinor,
}: {
  previousAmountMinor: number;
  nextAmountMinor: number;
  previousOutstandingMinor: number;
  nextOutstandingMinor: number;
}) {
  return (
    <dl className="border-border divide-border divide-y rounded-xl border text-sm">
      <BreakdownRow label="Recorded before">
        <Amount minor={previousAmountMinor} className="text-muted-foreground font-medium line-through" />
      </BreakdownRow>
      <BreakdownRow label="Corrected to">
        <Amount minor={nextAmountMinor} className="font-medium" />
      </BreakdownRow>
      <BreakdownRow label="Outstanding">
        <span className="flex items-center gap-2">
          <Amount minor={previousOutstandingMinor} className="text-muted-foreground" />
          <span className="text-muted-foreground" aria-hidden>
            {"→"}
          </span>
          <Amount
            minor={nextOutstandingMinor}
            className={cn(
              "text-base font-semibold",
              nextOutstandingMinor > previousOutstandingMinor && "text-money-warning",
            )}
          />
        </span>
      </BreakdownRow>
    </dl>
  );
}

function RepaymentFields({
  amountText,
  onAmountChange,
  date,
  onDateChange,
  method,
  onMethodChange,
  notes,
  onNotesChange,
  error,
  autoFocus = false,
}: {
  amountText: string;
  onAmountChange: (value: string) => void;
  date: string;
  onDateChange: (value: string) => void;
  method: string | null;
  onMethodChange: (value: string | null) => void;
  notes: string;
  onNotesChange: (value: string) => void;
  error: string | null;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-4 pb-2">
      <div className="space-y-1.5">
        <Label htmlFor="repayment-amount">Amount returned</Label>
        <Input
          id="repayment-amount"
          // `decimal` gives iOS the number pad with a decimal point.
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amountText}
          autoFocus={autoFocus}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? "repayment-amount-error" : undefined}
          onChange={(event) => onAmountChange(event.target.value)}
          className="amount h-14 text-2xl font-semibold"
        />
        {error ? (
          <p id="repayment-amount-error" className="text-destructive text-sm">
            {error}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="repayment-date">Repayment date</Label>
        <Input
          id="repayment-date"
          type="date"
          value={date}
          max={todayDateOnly()}
          onChange={(event) => onDateChange(event.target.value)}
        />
      </div>

      <div className="space-y-1.5">
        <span className="text-sm font-medium">How did it come back?</span>
        <div className="flex flex-wrap gap-2">
          {METHODS.map((option) => {
            const selected = method === option;
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                onClick={() => onMethodChange(selected ? null : option)}
                className={cn(
                  "tap-transparent rounded-full border px-3.5 py-2 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border hover:bg-muted",
                )}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="repayment-notes">Note (optional)</Label>
        <Textarea
          id="repayment-notes"
          rows={2}
          maxLength={2000}
          value={notes}
          placeholder="Anything worth remembering about this payment"
          onChange={(event) => onNotesChange(event.target.value)}
        />
      </div>
    </div>
  );
}
