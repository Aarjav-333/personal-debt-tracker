"use server";

import { minorToNumericString } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { createDebtSchema, updateDebtSchema } from "@/lib/validators";
import { AUTH_REQUIRED, fail, failValidation, mapDbError, ok, type ActionResult } from "@/server/action-result";
import { revalidateLedger } from "@/server/revalidate";

/** `%` and `_` are wildcards in ILIKE, so a name containing them must be escaped. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

/**
 * Record a new borrowing occasion.
 *
 * A borrower who already exists is reused, never duplicated: lending to the
 * same person a second time adds a debt to their file.
 */
export async function createDebt(
  input: unknown,
): Promise<ActionResult<{ debtId: string; borrowerId: string }>> {
  const parsed = createDebtSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(AUTH_REQUIRED);

  const { borrowerId, borrowerName, borrowerPhone, amount, reason, borrowedDate, expectedReturnDate, notes } =
    parsed.data;

  let resolvedBorrowerId = borrowerId;
  // Tracked so a failed debt insert does not strand a half-created borrower.
  let createdBorrowerId: string | null = null;

  if (!resolvedBorrowerId) {
    const name = borrowerName.trim();

    const { data: existing, error: lookupError } = await supabase
      .from("borrowers")
      .select("id, phone")
      .ilike("name", escapeLike(name))
      .limit(1)
      .maybeSingle();

    if (lookupError) return mapDbError(lookupError, "Could not look up this borrower.");

    if (existing) {
      resolvedBorrowerId = existing.id;
      // Fill in a phone number we did not have before, but never overwrite one.
      if (borrowerPhone && !existing.phone) {
        await supabase.from("borrowers").update({ phone: borrowerPhone }).eq("id", existing.id);
      }
    } else {
      const { data: created, error: createError } = await supabase
        .from("borrowers")
        .insert({ user_id: user.id, name, phone: borrowerPhone, notes: null })
        .select("id")
        .single();

      if (createError) return mapDbError(createError, "Could not add this borrower.");
      resolvedBorrowerId = created.id;
      createdBorrowerId = created.id;
    }
  }

  const { data: debt, error } = await supabase
    .from("debts")
    .insert({
      user_id: user.id,
      borrower_id: resolvedBorrowerId,
      original_amount: minorToNumericString(amount),
      reason,
      borrowed_date: borrowedDate,
      expected_return_date: expectedReturnDate,
      notes,
    })
    .select("id")
    .single();

  if (error) {
    if (createdBorrowerId) {
      await supabase.from("borrowers").delete().eq("id", createdBorrowerId);
    }
    return mapDbError(error, "Could not record this debt.");
  }

  revalidateLedger();
  return ok({ debtId: debt.id, borrowerId: resolvedBorrowerId });
}

/**
 * Correct a debt that was entered incorrectly.
 *
 * This is *not* how repayments are recorded - money coming back is always a
 * separate repayment row. The database refuses to lower a debt below what has
 * already been repaid against it.
 */
export async function updateDebt(input: unknown): Promise<ActionResult> {
  const parsed = updateDebtSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(AUTH_REQUIRED);

  const { id, amount, reason, borrowedDate, expectedReturnDate, notes } = parsed.data;

  const { error, count } = await supabase
    .from("debts")
    .update(
      {
        original_amount: minorToNumericString(amount),
        reason,
        borrowed_date: borrowedDate,
        expected_return_date: expectedReturnDate,
        notes,
      },
      { count: "exact" },
    )
    .eq("id", id);

  if (error) return mapDbError(error, "Could not save this debt.");
  if (count === 0) return fail("That debt was not found.");

  revalidateLedger();
  return ok();
}

/** Deletes the debt and every repayment recorded against it. */
export async function deleteDebt(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(AUTH_REQUIRED);

  const { error, count } = await supabase.from("debts").delete({ count: "exact" }).eq("id", id);

  if (error) return mapDbError(error, "Could not delete this debt.");
  if (count === 0) return fail("That debt was not found.");

  revalidateLedger();
  return ok();
}
