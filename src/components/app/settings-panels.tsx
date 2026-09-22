"use client";

import { Download, Loader2, LogOut } from "lucide-react";
import { useState, useTransition } from "react";

import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { runAction } from "@/lib/client-actions";
import { CURRENCY_OPTIONS, type CurrencyCode } from "@/lib/currency";
import { fieldErrorsFrom, profileSettingsSchema } from "@/lib/validators";
import { signOut } from "@/server/actions/auth";
import { updateProfileSettings } from "@/server/actions/profile";

/** Display name and default currency. */
export function ProfileSettings({
  displayName: initialName,
  currency: initialCurrency,
}: {
  displayName: string | null;
  currency: CurrencyCode;
}) {
  const [displayName, setDisplayName] = useState(initialName ?? "");
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  const dirty = displayName !== (initialName ?? "") || currency !== initialCurrency;

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = { displayName, currency };
    const parsed = profileSettingsSchema.safeParse(payload);
    if (!parsed.success) {
      setFieldErrors(fieldErrorsFrom(parsed.error));
      return;
    }
    setFieldErrors({});

    startTransition(async () => {
      const result = await runAction(() => updateProfileSettings(payload), {
        success: "Settings saved",
      });
      if (result && !result.ok) setFieldErrors(result.fieldErrors ?? {});
    });
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="display-name">Your name</Label>
        <Input
          id="display-name"
          maxLength={80}
          placeholder="Optional"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          aria-invalid={Boolean(fieldErrors.displayName)}
        />
        {fieldErrors.displayName ? (
          <p className="text-destructive text-sm">{fieldErrors.displayName}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="currency">Default currency</Label>
        <Select value={currency} onValueChange={(value) => setCurrency(value as CurrencyCode)}>
          <SelectTrigger id="currency" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CURRENCY_OPTIONS.map((option) => (
              <SelectItem key={option.code} value={option.code}>
                {option.symbol} {option.label} ({option.code})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Changes how amounts are displayed. Existing records keep their stored values.
        </p>
      </div>

      <Button type="submit" disabled={pending || !dirty} className="w-full">
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        Save settings
      </Button>
    </form>
  );
}

const EXPORTS = [
  { type: "ledger", label: "Full ledger", hint: "Date, borrower, type, amount, running balance" },
  { type: "borrowers", label: "Borrowers", hint: "One row per person, with their totals" },
  { type: "debts", label: "Debts", hint: "One row per borrowing occasion" },
  { type: "repayments", label: "Repayments", hint: "Every installment received" },
] as const;

/**
 * CSV downloads.
 *
 * Plain links rather than fetch-and-blob: the browser handles the download
 * natively, which is what iOS Safari expects in an installed PWA.
 */
export function ExportPanel() {
  return (
    <ul className="divide-border divide-y">
      {EXPORTS.map((item) => (
        <li key={item.type}>
          <a
            href={`/api/export?type=${item.type}`}
            download
            className="tap-transparent hover:bg-muted/40 flex items-center gap-3 px-4 py-3 transition-colors"
          >
            <Download className="text-muted-foreground size-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium">{item.label}</span>
              <span className="text-muted-foreground block text-xs">{item.hint}</span>
            </span>
            <span className="text-muted-foreground text-xs">CSV</span>
          </a>
        </li>
      ))}
    </ul>
  );
}

/**
 * Asks the service worker to drop its cached pages and waits for the reply.
 * Resolves regardless of outcome - a stuck worker must not block signing out.
 */
async function clearCachedPages(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;

  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    const worker = registration?.active;
    if (!worker) return;

    await new Promise<void>((resolve) => {
      const channel = new MessageChannel();
      const done = () => resolve();
      channel.port1.onmessage = done;
      setTimeout(done, 1500);
      worker.postMessage({ type: "CLEAR_PRIVATE_CACHES" }, [channel.port2]);
    });
  } catch {
    // Best effort: the session still ends either way.
  }
}

export function SignOutButton() {
  return (
    <ConfirmDialog
      title="Sign out?"
      confirmLabel="Sign out"
      description={
        <p>
          Your ledger stays safe on the server. You will need your email and password to get back
          in.
        </p>
      }
      onConfirm={async () => {
        // Drop cached screens before the session goes, so the next person to
        // open this device cannot browse back through the ledger. Waits for the
        // worker to confirm: navigator.serviceWorker.controller is null until
        // it has claimed the page, so firing and forgetting would silently skip
        // the clear on the very first load after registration.
        await clearCachedPages();
        await signOut();
      }}
      trigger={
        <Button variant="outline" className="w-full">
          <LogOut className="size-4" aria-hidden />
          Sign out
        </Button>
      }
    />
  );
}
