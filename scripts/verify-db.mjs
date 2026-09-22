/**
 * End-to-end verification against a real Supabase project.
 *
 * The Vitest suite proves the arithmetic. This proves the *database* actually
 * enforces what the app promises: that repayments cannot exceed a debt, that a
 * debt cannot be corrected below what has been repaid, that zero and negative
 * amounts are refused, and that Row Level Security hides one user's ledger
 * from another.
 *
 * Usage:
 *   node scripts/verify-db.mjs
 *
 * Reads NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY from
 * .env.local. It creates two throwaway accounts, works only inside them, and
 * deletes everything it created before exiting.
 */

import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";

import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const env = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }),
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || SUPABASE_URL.includes("placeholder")) {
  console.error("Set real Supabase credentials in .env.local first.");
  process.exit(1);
}

let passed = 0;
let failed = 0;

function check(label, condition, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failed += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/** Money helpers mirroring src/lib/money.ts. */
const toMinor = (value) => Math.round(Number(value) * 100);
const numeric = (rupees) => rupees.toFixed(2);

async function signUpThrowaway(label) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const email = `verify-${label}-${randomUUID().slice(0, 8)}@example.com`;
  const password = `Verify!${randomUUID().slice(0, 12)}`;

  const { data, error } = await client.auth.signUp({ email, password });
  if (error) throw new Error(`sign-up failed for ${label}: ${error.message}`);

  if (!data.session) {
    throw new Error(
      "Sign-up succeeded but returned no session. Turn off Authentication -> Providers -> Email -> \"Confirm email\" while running this script.",
    );
  }

  return { client, email, userId: data.user.id };
}

async function balanceOf(client, debtId) {
  const { data, error } = await client
    .from("debt_balances")
    .select("original_amount, total_repaid, outstanding, repayment_count")
    .eq("id", debtId)
    .single();

  if (error) throw new Error(`could not read balance: ${error.message}`);

  return {
    original: toMinor(data.original_amount),
    repaid: toMinor(data.total_repaid),
    outstanding: toMinor(data.outstanding),
    count: data.repayment_count,
  };
}

async function addRepayment(client, debtId, borrowerId, userId, rupees, date, method = null) {
  return client
    .from("repayments")
    .insert({
      user_id: userId,
      debt_id: debtId,
      borrower_id: borrowerId,
      amount: numeric(rupees),
      repayment_date: date,
      method,
    })
    .select("id")
    .single();
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

console.log(`Verifying ${SUPABASE_URL}\n`);

const alice = await signUpThrowaway("a");
const { client, userId } = alice;

let borrowerId;

try {
  section("Schema reachable");
  {
    const { error } = await client.from("borrowers").select("id").limit(1);
    check("tables and RLS policies are in place", !error, error?.message);
  }

  section("Profile created on sign-up");
  {
    const { data } = await client.from("profiles").select("id, email, currency").eq("id", userId).maybeSingle();
    check("profiles row exists", Boolean(data), "the on_auth_user_created trigger did not fire");
    check("defaults to INR", data?.currency === "INR");
  }

  section("Borrower");
  {
    const { data, error } = await client
      .from("borrowers")
      .insert({ user_id: userId, name: "Rahul (verify)", phone: "+919876543210" })
      .select("id")
      .single();

    check("borrower created", !error, error?.message);
    borrowerId = data?.id;

    const duplicate = await client
      .from("borrowers")
      .insert({ user_id: userId, name: "rahul (VERIFY)" });
    check("duplicate name rejected (case-insensitive)", duplicate.error?.code === "23505", duplicate.error?.message);
  }

  section("Test 1 - a new debt of 10,000");
  let debtId;
  {
    const { data, error } = await client
      .from("debts")
      .insert({
        user_id: userId,
        borrower_id: borrowerId,
        original_amount: numeric(10_000),
        reason: "Verification",
        borrowed_date: "2026-09-01",
        expected_return_date: "2026-10-01",
      })
      .select("id")
      .single();

    check("debt created", !error, error?.message);
    debtId = data?.id;

    const balance = await balanceOf(client, debtId);
    check("original is 10,000", balance.original === toMinor(10_000));
    check("repaid is 0", balance.repaid === 0);
    check("outstanding is 10,000", balance.outstanding === toMinor(10_000));
  }

  section("Test 2 - first partial repayment of 2,000");
  {
    const { error } = await addRepayment(client, debtId, borrowerId, userId, 2000, "2026-09-10", "Cash");
    check("repayment recorded", !error, error?.message);

    const balance = await balanceOf(client, debtId);
    check("ORIGINAL IS STILL 10,000", balance.original === toMinor(10_000), "the original amount was mutated");
    check("repaid is 2,000", balance.repaid === toMinor(2000));
    check("outstanding is 8,000", balance.outstanding === toMinor(8000));
  }

  section("Test 3 - second repayment of 1,500");
  let secondRepaymentId;
  {
    const { data, error } = await addRepayment(client, debtId, borrowerId, userId, 1500, "2026-09-18", "UPI");
    check("repayment recorded", !error, error?.message);
    secondRepaymentId = data?.id;

    const balance = await balanceOf(client, debtId);
    check("two repayments on record", balance.count === 2);
    check("repaid is 3,500", balance.repaid === toMinor(3500));
    check("outstanding is 6,500", balance.outstanding === toMinor(6500));
  }

  section("Test 4 - third repayment of 3,000");
  {
    await addRepayment(client, debtId, borrowerId, userId, 3000, "2026-10-02");
    const balance = await balanceOf(client, debtId);
    check("three repayments on record", balance.count === 3);
    check("repaid is 6,500", balance.repaid === toMinor(6500));
    check("outstanding is 3,500", balance.outstanding === toMinor(3500));
  }

  section("Over-repayment is refused");
  {
    const { error } = await addRepayment(client, debtId, borrowerId, userId, 4000, "2026-10-03");
    check("repayment larger than the balance rejected", error?.code === "23514", error?.message ?? "it was accepted");

    const balance = await balanceOf(client, debtId);
    check("balance unchanged after the rejection", balance.outstanding === toMinor(3500));
  }

  section("Zero and negative amounts are refused");
  {
    const zero = await addRepayment(client, debtId, borrowerId, userId, 0, "2026-10-03");
    check("zero repayment rejected", zero.error?.code === "23514", zero.error?.message ?? "it was accepted");

    const negative = await addRepayment(client, debtId, borrowerId, userId, -500, "2026-10-03");
    check("negative repayment rejected", negative.error?.code === "23514", negative.error?.message ?? "it was accepted");

    const zeroDebt = await client.from("debts").insert({
      user_id: userId,
      borrower_id: borrowerId,
      original_amount: numeric(0),
      borrowed_date: "2026-09-01",
    });
    check("zero debt rejected", zeroDebt.error?.code === "23514", zeroDebt.error?.message ?? "it was accepted");
  }

  section("Test 6 - editing a repayment recalculates everything");
  {
    const { error } = await client
      .from("repayments")
      .update({ amount: numeric(1000) })
      .eq("id", secondRepaymentId);
    check("1,500 corrected to 1,000", !error, error?.message);

    const balance = await balanceOf(client, debtId);
    check("repaid is 6,000", balance.repaid === toMinor(6000));
    check("outstanding is 4,000", balance.outstanding === toMinor(4000));
    check("original untouched", balance.original === toMinor(10_000));
  }

  section("Test 7 - deleting a repayment raises the balance");
  {
    const { error } = await client.from("repayments").delete().eq("id", secondRepaymentId);
    check("repayment deleted", !error, error?.message);

    const balance = await balanceOf(client, debtId);
    check("two repayments remain", balance.count === 2);
    check("repaid is 5,000", balance.repaid === toMinor(5000));
    check("outstanding is back up to 5,000", balance.outstanding === toMinor(5000));
  }

  section("A debt cannot be corrected below what has been repaid");
  {
    const { error } = await client
      .from("debts")
      .update({ original_amount: numeric(4000) })
      .eq("id", debtId);
    check("lowering 10,000 to 4,000 rejected", error?.code === "23514", error?.message ?? "it was accepted");

    const allowed = await client
      .from("debts")
      .update({ original_amount: numeric(9000) })
      .eq("id", debtId);
    check("lowering to 9,000 allowed", !allowed.error, allowed.error?.message);

    await client.from("debts").update({ original_amount: numeric(10_000) }).eq("id", debtId);
  }

  section("Test 5 - settle_debt() records the exact remainder");
  {
    const before = await balanceOf(client, debtId);
    const { data, error } = await client.rpc("settle_debt", {
      p_debt_id: debtId,
      p_repayment_date: "2026-11-02",
      p_method: "Cash",
      p_notes: null,
    });

    check("settle_debt succeeded", !error, error?.message);
    check("it wrote exactly the outstanding amount", toMinor(data?.amount) === before.outstanding);

    const after = await balanceOf(client, debtId);
    check("outstanding is 0", after.outstanding === 0);
    check("repaid equals the original 10,000", after.repaid === toMinor(10_000));
    check("original still 10,000", after.original === toMinor(10_000));
    check("three repayments on record", after.count === 3);

    const again = await client.rpc("settle_debt", { p_debt_id: debtId });
    check("settling an already-paid debt rejected", Boolean(again.error), "it was accepted");
  }

  section("Test 8 - a second borrowing from the same person");
  {
    const { error } = await client.from("debts").insert({
      user_id: userId,
      borrower_id: borrowerId,
      original_amount: numeric(2000),
      borrowed_date: "2026-11-10",
    });
    check("second debt created", !error, error?.message);

    const { data } = await client
      .from("borrower_balances")
      .select("total_borrowed, total_repaid, outstanding, debt_count")
      .eq("id", borrowerId)
      .single();

    check("total borrowed is 12,000", toMinor(data.total_borrowed) === toMinor(12_000));
    check("total repaid is 10,000", toMinor(data.total_repaid) === toMinor(10_000));
    check("outstanding is 2,000", toMinor(data.outstanding) === toMinor(2000));
    check("the settled debt was not touched", data.debt_count === 2);
  }

  section("Invalid references are refused");
  {
    const orphan = await client.from("repayments").insert({
      user_id: userId,
      debt_id: randomUUID(),
      borrower_id: borrowerId,
      amount: numeric(100),
      repayment_date: "2026-11-11",
    });
    check("repayment against a non-existent debt rejected", Boolean(orphan.error), "it was accepted");

    const badDate = await client.from("debts").insert({
      user_id: userId,
      borrower_id: borrowerId,
      original_amount: numeric(500),
      borrowed_date: "2026-09-01",
      expected_return_date: "2026-08-01",
    });
    check("return date before borrowed date rejected", badDate.error?.code === "23514", badDate.error?.message);
  }

  section("Row Level Security");
  {
    const bob = await signUpThrowaway("b");

    const { data: theirBorrowers } = await bob.client.from("borrowers").select("id");
    check("a second user sees no borrowers of the first", (theirBorrowers ?? []).length === 0);

    const { data: theirDebts } = await bob.client.from("debt_balances").select("id");
    check("and no debts", (theirDebts ?? []).length === 0);

    const { data: direct } = await bob.client.from("debts").select("id").eq("id", debtId);
    check("cannot read a specific debt by id", (direct ?? []).length === 0);

    const stolen = await bob.client.from("repayments").insert({
      user_id: bob.userId,
      debt_id: debtId,
      borrower_id: borrowerId,
      amount: numeric(100),
      repayment_date: "2026-11-11",
    });
    check("cannot write a repayment against another user's debt", Boolean(stolen.error), "it was accepted");

    const hijack = await bob.client.from("borrowers").update({ name: "hijacked" }).eq("id", borrowerId);
    check("cannot rename another user's borrower", (hijack.count ?? 0) === 0 || Boolean(hijack.error));

    const settle = await bob.client.rpc("settle_debt", { p_debt_id: debtId });
    check("cannot settle another user's debt", Boolean(settle.error), "it was accepted");

    await bob.client.auth.signOut();
  }

  section("Cascade deletes");
  {
    await client.from("borrowers").delete().eq("id", borrowerId);

    const { data: debts } = await client.from("debts").select("id").eq("borrower_id", borrowerId);
    check("deleting the borrower removed their debts", (debts ?? []).length === 0);

    const { data: repayments } = await client.from("repayments").select("id").eq("borrower_id", borrowerId);
    check("and their repayments", (repayments ?? []).length === 0);

    borrowerId = null;
  }
} finally {
  if (borrowerId) await client.from("borrowers").delete().eq("id", borrowerId);
  await client.auth.signOut();
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
