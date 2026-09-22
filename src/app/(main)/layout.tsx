import { redirect } from "next/navigation";

import { BottomNav } from "@/components/app/bottom-nav";
import { CurrencyProvider } from "@/components/app/currency-provider";
import { getCurrency } from "@/lib/currency";
import { getUser } from "@/lib/supabase/server";
import { getProfile } from "@/server/queries";

/**
 * Shell for every signed-in screen.
 *
 * The proxy already turns away anonymous requests; this second check means a
 * page can never render against a missing session if the proxy is ever
 * bypassed or its matcher changes.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");

  const profile = await getProfile();

  return (
    <CurrencyProvider currency={getCurrency(profile?.currency).code}>
      <div className="pb-nav mx-auto flex w-full max-w-lg flex-1 flex-col">{children}</div>
      <BottomNav />
    </CurrencyProvider>
  );
}
