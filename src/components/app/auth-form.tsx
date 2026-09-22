"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { guardOnline } from "@/lib/client-actions";
import { credentialsSchema, fieldErrorsFrom } from "@/lib/validators";
import { signIn, signUp } from "@/server/actions/auth";

type Mode = "signin" | "signup";

/**
 * Email + password, for both signing in and signing up.
 *
 * Validated locally first so a typo never costs a round trip, then validated
 * again on the server where it actually counts.
 */
export function AuthForm({
  mode,
  next,
  initialError,
}: {
  mode: Mode;
  next?: string;
  /** Message handed over by the auth callback, e.g. an expired email link. */
  initialError?: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmationSent, setConfirmationSent] = useState(false);
  const [pending, startTransition] = useTransition();

  const isSignUp = mode === "signup";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }

    if (!guardOnline()) {
      setError("You're offline. Connect to the internet to sign in.");
      return;
    }

    startTransition(async () => {
      try {
        if (isSignUp) {
          const result = await signUp(parsed.data);
          if (!result.ok) {
            setError(result.error);
            setFieldErrors(result.fieldErrors ?? {});
            return;
          }
          if (result.data.needsEmailConfirmation) {
            setConfirmationSent(true);
            return;
          }
          router.replace("/");
          router.refresh();
          return;
        }

        // On success this never returns: the action redirects, so the next
        // request already carries the session cookie.
        const result = await signIn(parsed.data, next);
        if (result && !result.ok) {
          setError(result.error);
          setFieldErrors(result.fieldErrors ?? {});
        }
      } catch {
        setError("Could not reach the server. Check your connection and try again.");
      }
    });
  }

  if (confirmationSent) {
    return (
      <div className="bg-card border-border rounded-xl border p-6 text-center">
        <span className="bg-money-positive/12 text-money-positive mx-auto mb-4 flex size-12 items-center justify-center rounded-full">
          <CheckCircle2 className="size-6" aria-hidden />
        </span>
        <h2 className="font-semibold">Confirm your email</h2>
        <p className="text-muted-foreground mt-1.5 text-sm text-balance">
          We sent a link to <span className="text-foreground font-medium">{email}</span>. Open it to
          activate your ledger, then sign in.
        </p>
        <Button asChild variant="outline" className="mt-5 w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          autoCorrect="off"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
        {fieldErrors.email ? (
          <p id="email-error" className="text-destructive text-sm">
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete={isSignUp ? "new-password" : "current-password"}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-invalid={Boolean(fieldErrors.password)}
          aria-describedby={fieldErrors.password ? "password-error" : undefined}
        />
        {fieldErrors.password ? (
          <p id="password-error" className="text-destructive text-sm">
            {fieldErrors.password}
          </p>
        ) : isSignUp ? (
          <p className="text-muted-foreground text-xs">At least 8 characters.</p>
        ) : null}
      </div>

      {error ? (
        <p role="alert" className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {isSignUp ? "Create ledger" : "Sign in"}
      </Button>

      <p className="text-muted-foreground text-center text-sm">
        {isSignUp ? (
          <>
            Already have a ledger?{" "}
            <Link href="/login" className="text-primary font-medium hover:underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            First time here?{" "}
            <Link href="/signup" className="text-primary font-medium hover:underline">
              Create your ledger
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
