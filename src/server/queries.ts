import "server-only";

import { cache } from "react";

import { getCurrency, type CurrencyCode } from "@/lib/currency";
import { createClient } from "@/lib/supabase/server";
import type {
  ActivityRow,
  BorrowerRow,
  DebtBalanceRow,
  ProfileRow,
  RepaymentRow,
} from "@/lib/types/database";

/**
 * Read side of the app.
 *
 * Every query runs with the signed-in user's session, so Row Level Security -
 * not a WHERE clause written here - is what keeps one user's ledger out of
 * another's. `cache()` de-duplicates repeated calls inside a single render.
 */

export interface Ledger {
  borrowers: BorrowerRow[];
  /** Every debt with its repaid total and outstanding balance already derived. */
  debts: DebtBalanceRow[];
}

/**
 * The whole ledger in two queries.
 *
 * A personal ledger is small, and loading it whole means the dashboard, the
 * borrowers list and every summary are computed from exactly the same rows.
 */
export const getLedger = cache(async (): Promise<Ledger> => {
  const supabase = await createClient();

  const [borrowersResult, debtsResult] = await Promise.all([
    supabase.from("borrowers").select("*").order("name", { ascending: true }),
    supabase.from("debt_balances").select("*").order("borrowed_date", { ascending: false }),
  ]);

  if (borrowersResult.error) throw new Error(borrowersResult.error.message);
  if (debtsResult.error) throw new Error(debtsResult.error.message);

  return {
    borrowers: borrowersResult.data ?? [],
    debts: debtsResult.data ?? [],
  };
});

export const getBorrower = cache(async (id: string): Promise<BorrowerRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("borrowers").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

export const getDebtBalance = cache(async (id: string): Promise<DebtBalanceRow | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("debt_balances").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data;
});

/** A borrower's debts, newest borrowing first. */
export const getDebtsForBorrower = cache(async (borrowerId: string): Promise<DebtBalanceRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("debt_balances")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("borrowed_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

/** Repayment history for one debt, newest first. */
export const getRepayments = cache(async (debtId: string): Promise<RepaymentRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repayments")
    .select("*")
    .eq("debt_id", debtId)
    .order("repayment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

/** Every repayment for a borrower across all of their debts, newest first. */
export const getRepaymentsForBorrower = cache(async (borrowerId: string): Promise<RepaymentRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repayments")
    .select("*")
    .eq("borrower_id", borrowerId)
    .order("repayment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getActivity = cache(async (limit = 200): Promise<ActivityRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("activity_feed")
    .select("*")
    .order("event_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getProfile = cache(async (): Promise<ProfileRow | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (error) throw new Error(error.message);

  // Falls back to a synthetic profile so Settings still renders for an account
  // created before the profile trigger existed.
  return (
    data ?? {
      id: user.id,
      email: user.email ?? "",
      display_name: null,
      currency: "INR",
      created_at: user.created_at,
      updated_at: user.created_at,
    }
  );
});

export const getAllRepayments = cache(async (): Promise<RepaymentRow[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("repayments")
    .select("*")
    .order("repayment_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
});

/** The chosen currency, so Server Actions can phrase money in the same units the UI shows. */
export const getProfileCurrency = cache(async (): Promise<CurrencyCode> => {
  const profile = await getProfile();
  return getCurrency(profile?.currency).code;
});
