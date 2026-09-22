"use client";

import { MessageCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrency } from "@/components/app/currency-provider";
import { formatMinor, type Minor } from "@/lib/money";

/**
 * Turns a stored phone number into the digits wa.me expects.
 *
 * A number saved with a leading "+" already carries its country code. A bare
 * 10-digit number is assumed to be Indian, matching the app's default
 * currency; anything else is passed through untouched.
 */
function toWhatsAppNumber(phone: string): string | null {
  const explicitCountryCode = phone.trim().startsWith("+");
  const digits = phone.replace(/\D/g, "");

  if (digits.length < 8) return null;
  if (explicitCountryCode) return digits;
  return digits.length === 10 ? `91${digits}` : digits;
}

/**
 * Opens WhatsApp with a reminder already written out.
 *
 * It never sends anything: the message lands in the chat box for review, and
 * pressing send stays a deliberate act.
 */
export function WhatsAppReminder({
  phone,
  borrowerName,
  outstandingMinor,
  className,
  variant = "outline",
  size = "sm",
}: {
  phone: string;
  borrowerName: string;
  outstandingMinor: Minor;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const currency = useCurrency();
  const number = toWhatsAppNumber(phone);

  if (!number || outstandingMinor <= 0) return null;

  const firstName = borrowerName.trim().split(/\s+/)[0] ?? borrowerName;
  const message = `Hi ${firstName}, just a reminder that ${formatMinor(outstandingMinor, { currency })} is still pending.`;
  const href = `https://wa.me/${number}?text=${encodeURIComponent(message)}`;

  return (
    <Button asChild variant={variant} size={size} className={className}>
      <a href={href} target="_blank" rel="noopener noreferrer">
        <MessageCircle className="size-4" aria-hidden />
        Remind via WhatsApp
      </a>
    </Button>
  );
}
