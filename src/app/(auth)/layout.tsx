import { Wallet } from "lucide-react";

/** Centred, single-column shell for the signed-out screens. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-safe pb-safe flex flex-1 flex-col justify-center px-6 py-10">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <span className="bg-primary text-primary-foreground mb-4 flex size-12 items-center justify-center rounded-2xl">
            <Wallet className="size-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-semibold tracking-tight">Debt Ledger</h1>
          <p className="text-muted-foreground mt-1 text-sm text-balance">
            Track what you have lent, every repayment, and exactly what is still pending.
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
