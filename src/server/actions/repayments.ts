"use server";

import { formatMinor, minorToNumericString, toMinor } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { createRepaymentSchema, settleDebtSchema, updateRepaymentSchema } from "@/lib/validators";
import { AUTH_REQUIRED, fail, failValidation, mapDbError, ok, type ActionResult } from "@/server/action-result";
import { getProfileCurrency } from "@/server/queries";
import { revalidateLedger } from "@/server/revalidate";

/**
 * Repayments.
 *
 * Nothing here ever touches `debts.original_amount`. Money coming back is
 * always a new row, so the amount originally lent stays in the record forever
 * and the outstanding balance is recomputed from the repayment history.
 */

interface BalanceSnapshot {
  borrowerId: string;
  originalMinor: number;
  repaidMinor: number;
  outstandingMinor: number;
}

/** Read a debt's current balance straight from the derived view. */
async function readBalance(
  supabase: Awaited<ReturnType<typeof createClient>>,
  debtId: string,
): Promise<BalanceSnapshot | null> {
  const { data } = await supabase
    .from("debt_balances")
    .select("borrower_id, original_amount, total_repaid")
    .eq("id", debtId)
    .maybeSingle();

  if (!data) return null;

  const originalMinor = toMinor(data.original_amount);
  const repaidMinor = toMinor(data.total_repaid);
  return {
    borrowerId: data.borrower_id,
    originalMinor,
    repaidMinor,
    outstandingMinor: originalMinor - repaidMinor,
  };
}

export async function createRepayment(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createRepaymentSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(AUTH_REQUIRED);

  const { debtId, amount, repaymentDate, method, notes } = parsed.data;

  const balance = await readBalance(supabase, debtId);
  if (!balance) return fail("That debt was not found.");

  // Checked here so the message can name the actual outstanding figure. The
  // database enforces the same rule under a row lock, which is what makes it
  // safe against two repayments being recorded at the same moment.
  if (amount > balance.outstandingMinor) {
    const currency = await getProfileCurrency();
    return fail(
      `That is more than the ${formatMinor(balance.outstandingMinor, { currency })} still outstanding on this debt.`,
      { amount: `Outstanding is ${formatMinor(balance.outstandingMinor, { currency })}` },
    );
  }

  const { data, error } = await supabase
    .from("repayments")
    .insert({
      user_id: user.id,
      debt_id: debtId,
      // Re-derived from the debt by a BEFORE trigger, so this can never end up
      // pointing at the wrong person even if the client sent something else.
      borrower_id: balance.borrowerId,
      amount: minorToNumericString(amount),
      repayment_date: repaymentDate,
      method,
      notes,
    })
    .select("id")
    .single();

  if (error) return mapDbError(error, "Could not record this repayment.");

  revalidateLedger();
  return ok({ id: data.id });
}

/**
 * Correct a repayment that was recorded with the wrong amount, date or note.
 * Outstanding balances follow automatically because they are always derived.
 */
export async function updateRepayment(input: unknown): Promise<ActionResult> {
  const parsed = updateRepaymentSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(AUTH_REQUIRED);

  const { id, amount, repaymentDate, method, notes } = parsed.data;

  const { data: existing } = await supabase
    .from("repayments")
    .select("debt_id, amount")
    .eq("id", id)
    .maybeSingle();

  if (!existing) return fail("That repayment was not found.");

  const balance = await readBalance(supabase, existing.debt_id);
  if (!balance) return fail("That debt was not found.");

  // Everything repaid against this debt *except* the row being edited.
  const otherRepaymentsMinor = balance.repaidMinor - toMinor(existing.amount);
  const headroomMinor = balance.originalMinor - otherRepaymentsMinor;

  if (amount > headroomMinor) {
    const currency = await getProfileCurrency();
    return fail(
      `That would push the total repaid past the ${formatMinor(balance.originalMinor, { currency })} originally borrowed.`,
      { amount: `At most ${formatMinor(headroomMinor, { currency })} can be recorded here` },
    );
  }

  const { error, count } = await supabase
    .from("repayments")
    .update(
      {
        amount: minorToNumericString(amount),
        repayment_date: repaymentDate,
        method,
        notes,
      },
      { count: "exact" },
    )
    .eq("id", id);

  if (error) return mapDbError(error, "Could not save this repayment.");
  if (count === 0) return fail("That repayment was not found.");

  revalidateLedger();
  return ok();
}

/** Removes a repayment. The outstanding balance goes back up by that amount. */
export async function deleteRepayment(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(AUTH_REQUIRED);

  const { error, count } = await supabase.from("repayments").delete({ count: "exact" }).eq("id", id);

  if (error) return mapDbError(error, "Could not delete this repayment.");
  if (count === 0) return fail("That repayment was not found.");

  revalidateLedger();
  return ok();
}

/**
 * "Mark fully paid".
 *
 * Settling a debt still has to say where the money went, so this records a
 * real repayment for exactly the outstanding balance rather than flipping a
 * status flag. The database measures the remainder under a row lock, so the
 * amount written is the true one even if another repayment lands first.
 */
export async function settleDebt(input: unknown): Promise<ActionResult<{ amountMinor: number }>> {
  const parsed = settleDebtSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(AUTH_REQUIRED);

  const { debtId, repaymentDate, method, notes } = parsed.data;

  const { data, error } = await supabase.rpc("settle_debt", {
    p_debt_id: debtId,
    p_repayment_date: repaymentDate,
    p_method: method,
    p_notes: notes,
  });

  if (error) return mapDbError(error, "Could not settle this debt.");
  if (!data) return fail("That debt was not found.");

  revalidateLedger();
  return ok({ amountMinor: toMinor(data.amount) });
}
