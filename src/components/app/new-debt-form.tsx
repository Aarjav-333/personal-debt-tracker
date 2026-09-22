"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { BorrowerPicker, type PickableBorrower } from "@/components/app/borrower-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { runAction } from "@/lib/client-actions";
import { todayDateOnly } from "@/lib/dates";
import { createDebtSchema, fieldErrorsFrom } from "@/lib/validators";
import { createDebt } from "@/server/actions/debts";

/**
 * Records a new borrowing.
 *
 * Only the borrower and the amount are required - everything else can be
 * filled in later, because a debt that never gets written down is worse than
 * one recorded without a reason.
 */
export function NewDebtForm({
  borrowers,
  defaultBorrowerId,
}: {
  borrowers: PickableBorrower[];
  defaultBorrowerId?: string;
}) {
  const router = useRouter();
  const preselected = borrowers.find((borrower) => borrower.id === defaultBorrowerId) ?? null;

  const [borrowerId, setBorrowerId] = useState<string | null>(preselected?.id ?? null);
  const [borrowerName, setBorrowerName] = useState(preselected?.name ?? "");
  const [borrowerPhone, setBorrowerPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [borrowedDate, setBorrowedDate] = useState(todayDateOnly);
  const [expectedReturnDate, setExpectedReturnDate] = useState("");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      borrowerId,
      borrowerName: borrowerId ? "" : borrowerName,
      borrowerPhone,
      amount,
      reason,
      borrowedDate,
      expectedReturnDate,
      notes,
    };

    const parsed = createDebtSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = await runAction(() => createDebt(payload), { success: "Borrowing recorded" });

      if (result?.ok) {
        router.replace(`/borrowers/${result.data.borrowerId}`);
        router.refresh();
      } else if (result && !result.ok) {
        setFieldErrors(result.fieldErrors ?? {});
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      <BorrowerPicker
        borrowers={borrowers}
        selectedId={borrowerId}
        name={borrowerName}
        onSelect={(borrower) => setBorrowerId(borrower?.id ?? null)}
        onNameChange={setBorrowerName}
        error={fieldErrors.borrowerName}
      />

      <div className="space-y-1.5">
        <Label htmlFor="amount">Amount</Label>
        <Input
          id="amount"
          inputMode="decimal"
          autoComplete="off"
          placeholder="0"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          aria-invalid={Boolean(fieldErrors.amount)}
          aria-describedby={fieldErrors.amount ? "amount-error" : undefined}
          className="amount h-14 text-2xl font-semibold"
        />
        {fieldErrors.amount ? (
          <p id="amount-error" className="text-destructive text-sm">
            {fieldErrors.amount}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="borrowed-date">Borrowed on</Label>
        <Input
          id="borrowed-date"
          type="date"
          value={borrowedDate}
          max={todayDateOnly()}
          onChange={(event) => setBorrowedDate(event.target.value)}
          aria-invalid={Boolean(fieldErrors.borrowedDate)}
        />
        {fieldErrors.borrowedDate ? (
          <p className="text-destructive text-sm">{fieldErrors.borrowedDate}</p>
        ) : null}
      </div>

      <fieldset className="space-y-5">
        <legend className="text-muted-foreground mb-1 text-xs font-semibold tracking-wide uppercase">
          Optional
        </legend>

        <div className="space-y-1.5">
          <Label htmlFor="reason">Reason</Label>
          <Input
            id="reason"
            maxLength={200}
            placeholder="Emergency, rent, medical&hellip;"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="expected-return">Expected return date</Label>
          <Input
            id="expected-return"
            type="date"
            min={borrowedDate}
            value={expectedReturnDate}
            onChange={(event) => setExpectedReturnDate(event.target.value)}
            aria-invalid={Boolean(fieldErrors.expectedReturnDate)}
          />
          {fieldErrors.expectedReturnDate ? (
            <p className="text-destructive text-sm">{fieldErrors.expectedReturnDate}</p>
          ) : (
            <p className="text-muted-foreground text-xs">
              Leave empty if there is no agreed date. The debt stays Active.
            </p>
          )}
        </div>

        {/* Only relevant while creating a borrower - an existing one already has theirs. */}
        {!borrowerId ? (
          <div className="space-y-1.5">
            <Label htmlFor="borrower-phone">Phone number</Label>
            <Input
              id="borrower-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="+91 98765 43210"
              value={borrowerPhone}
              onChange={(event) => setBorrowerPhone(event.target.value)}
              aria-invalid={Boolean(fieldErrors.borrowerPhone)}
            />
            {fieldErrors.borrowerPhone ? (
              <p className="text-destructive text-sm">{fieldErrors.borrowerPhone}</p>
            ) : (
              <p className="text-muted-foreground text-xs">Enables the WhatsApp reminder shortcut.</p>
            )}
          </div>
        ) : null}

        <div className="space-y-1.5">
          <Label htmlFor="notes">Notes</Label>
          <Textarea
            id="notes"
            rows={3}
            maxLength={2000}
            placeholder="Anything worth remembering about this borrowing"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </fieldset>

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Record borrowing
      </Button>
    </form>
  );
}
