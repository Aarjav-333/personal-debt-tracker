import "server-only";

import type { PostgrestError } from "@supabase/supabase-js";
import { z } from "zod";

import { fieldErrorsFrom } from "@/lib/validators";

/**
 * Server Actions never throw at the caller. They return a result the form can
 * render, so a failed write always produces a visible message instead of an
 * unhandled error boundary.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

export function failValidation(error: z.ZodError): ActionResult<never> {
  const fieldErrors = fieldErrorsFrom(error);
  const first = Object.values(fieldErrors)[0];
  return { ok: false, error: first ?? "Please check the form and try again.", fieldErrors };
}

/**
 * Translate a Postgres error into something a person can act on.
 *
 * The database is the last line of defence for financial integrity, so its
 * refusals are surfaced as plain sentences rather than swallowed.
 */
export function mapDbError(error: PostgrestError, fallback: string): ActionResult<never> {
  switch (error.code) {
    case "23505":
      if (error.message.includes("borrowers_user_name_key")) {
        return fail("You already have a borrower with that name. Pick them from the list instead.");
      }
      return fail("That record already exists.");

    case "23514":
      // Includes the over-repayment and debt-lowering guards, whose messages
      // are written to be read by a human.
      return fail(cleanDbMessage(error.message), undefined);

    case "23503":
      return fail("That record no longer exists. Refresh and try again.");

    case "42501":
      return fail("You do not have permission to change that record.");

    case "PGRST116":
      return fail("That record was not found.");

    default:
      return fail(error.message ? `${fallback} (${cleanDbMessage(error.message)})` : fallback);
  }
}

/** Strip Postgres' trailing zeros so "10000.00" reads as "10000". */
function cleanDbMessage(message: string): string {
  return message.replace(/(\d)\.00\b/g, "$1");
}

export const AUTH_REQUIRED = "Your session has expired. Sign in again to continue.";
