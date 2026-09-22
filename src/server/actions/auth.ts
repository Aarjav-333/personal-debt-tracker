"use server";

import { redirect } from "next/navigation";

import { getSiteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { credentialsSchema } from "@/lib/validators";
import { fail, failValidation, ok, type ActionResult } from "@/server/action-result";
import { revalidateLedger } from "@/server/revalidate";

/** Only allow redirects back into this app, never to an attacker-supplied origin. */
function safeNext(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

export async function signIn(input: unknown, next?: string): Promise<ActionResult> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    // Supabase deliberately does not say which half was wrong, and neither do we.
    if (error.message.toLowerCase().includes("email not confirmed")) {
      return fail("Confirm your email address first - check your inbox for the link.");
    }
    return fail("That email and password do not match an account.");
  }

  revalidateLedger();
  // Redirecting from the action means the next request already carries the
  // refreshed session cookie, so the app never renders a half-signed-in state.
  redirect(safeNext(next));
}

export async function signUp(input: unknown): Promise<ActionResult<{ needsEmailConfirmation: boolean }>> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return failValidation(parsed.error);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${getSiteUrl()}/auth/callback` },
  });

  if (error) {
    if (error.message.toLowerCase().includes("already registered")) {
      return fail("An account already exists for that email. Sign in instead.");
    }
    return fail(error.message || "Could not create your account.");
  }

  if (data.session) {
    revalidateLedger();
    return ok({ needsEmailConfirmation: false });
  }

  return ok({ needsEmailConfirmation: true });
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidateLedger();
  redirect("/login");
}
