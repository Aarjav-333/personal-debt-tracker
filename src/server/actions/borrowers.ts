"use server";

import { createClient } from "@/lib/supabase/server";
import { borrowerInputSchema, updateBorrowerSchema } from "@/lib/validators";
import { AUTH_REQUIRED, fail, failValidation, mapDbError, ok, type ActionResult } from "@/server/action-result";
import { revalidateLedger } from "@/server/revalidate";

export async function createBorrower(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = borrowerInputSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(AUTH_REQUIRED);

  const { data, error } = await supabase
    .from("borrowers")
    .insert({
      user_id: user.id,
      name: parsed.data.name,
      phone: parsed.data.phone,
      notes: parsed.data.notes,
    })
    .select("id")
    .single();

  if (error) return mapDbError(error, "Could not add this borrower.");

  revalidateLedger();
  return ok({ id: data.id });
}

export async function updateBorrower(input: unknown): Promise<ActionResult> {
  const parsed = updateBorrowerSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(AUTH_REQUIRED);

  const { error, count } = await supabase
    .from("borrowers")
    .update(
      {
        name: parsed.data.name,
        phone: parsed.data.phone,
        notes: parsed.data.notes,
      },
      { count: "exact" },
    )
    .eq("id", parsed.data.id);

  if (error) return mapDbError(error, "Could not save this borrower.");
  if (count === 0) return fail("That borrower was not found.");

  revalidateLedger();
  return ok();
}

/**
 * Deletes the borrower and, through the ON DELETE CASCADE chain, every debt
 * and repayment recorded against them. The UI spells this out before calling.
 */
export async function deleteBorrower(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail(AUTH_REQUIRED);

  const { error, count } = await supabase.from("borrowers").delete({ count: "exact" }).eq("id", id);

  if (error) return mapDbError(error, "Could not delete this borrower.");
  if (count === 0) return fail("That borrower was not found.");

  revalidateLedger();
  return ok();
}
