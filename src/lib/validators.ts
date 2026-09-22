import { z } from "zod";

import { parseAmountInput } from "@/lib/money";

/**
 * Validation shared by the forms and the Server Actions.
 *
 * The client runs these to give immediate feedback; the server runs them again
 * because client-side validation is a convenience, never a control.
 */

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Rejects dates in the future.
 *
 * The browser sends a local calendar day while the server usually runs on UTC,
 * so a user in IST can legitimately be up to a day "ahead". One day of slack
 * absorbs that without letting real future dates through.
 */
function isNotFuture(value: string): boolean {
  const limit = new Date();
  limit.setUTCDate(limit.getUTCDate() + 1);
  return value <= limit.toISOString().slice(0, 10);
}

/** A money field: free text in, integer minor units (paise) out. */
export const amountSchema = z
  .string()
  .transform((value, ctx) => {
    const parsed = parseAmountInput(value ?? "");
    if (!parsed.ok) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: parsed.error });
      return z.NEVER;
    }
    return parsed.minor;
  });

export const pastDateSchema = z
  .string()
  .regex(DATE_ONLY, "Enter a valid date")
  .refine(isNotFuture, "That date is in the future");

export const anyDateSchema = z.string().regex(DATE_ONLY, "Enter a valid date");

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} must be ${max} characters or fewer`)
    .transform((value) => (value.length ? value : null))
    .nullable()
    .default(null);

export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => (value.length ? value : null))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || /^[+]?[\d\s()-]{4,24}$/.test(value),
    "Enter a valid phone number",
  );

export const borrowerNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a name")
  .max(120, "Name must be 120 characters or fewer");

// ---------------------------------------------------------------------------
// Borrowers
// ---------------------------------------------------------------------------

export const borrowerInputSchema = z.object({
  name: borrowerNameSchema,
  phone: phoneSchema,
  notes: optionalText(2000, "Notes"),
});

export type BorrowerInput = z.input<typeof borrowerInputSchema>;

export const updateBorrowerSchema = borrowerInputSchema.extend({
  id: z.string().uuid("Unknown borrower"),
});

// ---------------------------------------------------------------------------
// Debts
// ---------------------------------------------------------------------------

const debtFields = {
  amount: amountSchema,
  reason: optionalText(200, "Reason"),
  borrowedDate: pastDateSchema,
  expectedReturnDate: z
    .string()
    .trim()
    .transform((value) => (value.length ? value : null))
    .nullable()
    .default(null)
    .refine((value) => value === null || DATE_ONLY.test(value), "Enter a valid date"),
  notes: optionalText(2000, "Notes"),
};

/**
 * A new debt either attaches to an existing borrower or names a new one.
 * Exactly one of `borrowerId` / `borrowerName` must be supplied.
 */
export const createDebtSchema = z
  .object({
    borrowerId: z.string().uuid().nullable().default(null),
    borrowerName: z.string().trim().max(120).default(""),
    borrowerPhone: phoneSchema,
    ...debtFields,
  })
  .superRefine((value, ctx) => {
    if (!value.borrowerId && !value.borrowerName) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["borrowerName"], message: "Choose or name a borrower" });
    }
    if (
      value.expectedReturnDate &&
      value.expectedReturnDate < value.borrowedDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expectedReturnDate"],
        message: "The return date cannot be before the borrowed date",
      });
    }
  });

export type CreateDebtInput = z.input<typeof createDebtSchema>;

export const updateDebtSchema = z
  .object({
    id: z.string().uuid("Unknown debt"),
    ...debtFields,
  })
  .superRefine((value, ctx) => {
    if (value.expectedReturnDate && value.expectedReturnDate < value.borrowedDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expectedReturnDate"],
        message: "The return date cannot be before the borrowed date",
      });
    }
  });

export type UpdateDebtInput = z.input<typeof updateDebtSchema>;

// ---------------------------------------------------------------------------
// Repayments
// ---------------------------------------------------------------------------

export const createRepaymentSchema = z.object({
  debtId: z.string().uuid("Unknown debt"),
  amount: amountSchema,
  repaymentDate: pastDateSchema,
  method: optionalText(40, "Method"),
  notes: optionalText(2000, "Note"),
});

export type CreateRepaymentInput = z.input<typeof createRepaymentSchema>;

export const updateRepaymentSchema = z.object({
  id: z.string().uuid("Unknown repayment"),
  amount: amountSchema,
  repaymentDate: pastDateSchema,
  method: optionalText(40, "Method"),
  notes: optionalText(2000, "Note"),
});

export type UpdateRepaymentInput = z.input<typeof updateRepaymentSchema>;

export const settleDebtSchema = z.object({
  debtId: z.string().uuid("Unknown debt"),
  repaymentDate: pastDateSchema,
  method: optionalText(40, "Method"),
  notes: optionalText(2000, "Note"),
});

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const credentialsSchema = z.object({
  email: z.string().trim().min(1, "Enter your email").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password is too long"),
});

export type Credentials = z.infer<typeof credentialsSchema>;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export const profileSettingsSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(80, "Name must be 80 characters or fewer")
    .transform((value) => (value.length ? value : null))
    .nullable()
    .default(null),
  currency: z.enum(["INR", "USD", "EUR", "GBP", "AED"]),
});

export type ProfileSettingsInput = z.input<typeof profileSettingsSchema>;

// ---------------------------------------------------------------------------
// Turning Zod errors into per-field messages the forms can show
// ---------------------------------------------------------------------------

export function fieldErrorsFrom(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form";
    result[key] ??= issue.message;
  }
  return result;
}
