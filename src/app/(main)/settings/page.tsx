import { Share } from "lucide-react";
import type { Metadata } from "next";

import { PageHeader } from "@/components/app/page-header";
import { Section } from "@/components/app/section";
import { ExportPanel, ProfileSettings, SignOutButton } from "@/components/app/settings-panels";
import { ThemeSwitcher } from "@/components/app/theme-switcher";
import { getCurrency } from "@/lib/currency";
import { formatFullDate } from "@/lib/dates";
import { getProfile } from "@/server/queries";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const profile = await getProfile();
  const currency = getCurrency(profile?.currency);

  return (
    <>
      <PageHeader title="Settings" />

      <div className="mt-5 space-y-6">
        <Section title="Account">
          <div className="bg-card border-border mx-4 rounded-xl border p-4">
            <p className="text-sm font-medium break-all">{profile?.email}</p>
            {profile?.created_at ? (
              <p className="text-muted-foreground mt-0.5 text-xs">
                Ledger started {formatFullDate(profile.created_at.slice(0, 10))}
              </p>
            ) : null}
          </div>
        </Section>

        <Section title="Preferences">
          <div className="bg-card border-border mx-4 space-y-5 rounded-xl border p-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Theme</p>
              <ThemeSwitcher />
            </div>

            <ProfileSettings
              displayName={profile?.display_name ?? null}
              currency={currency.code}
            />
          </div>
        </Section>

        <Section title="Export data">
          <div className="bg-card border-border mx-4 overflow-hidden rounded-xl border">
            <ExportPanel />
          </div>
          <p className="text-muted-foreground px-4 text-xs">
            Keep a copy somewhere outside this app. The full ledger export can reconstruct every
            balance on its own.
          </p>
        </Section>

        <Section title="Install on your iPhone">
          <div className="bg-card border-border text-muted-foreground mx-4 rounded-xl border p-4 text-sm">
            <p className="flex items-start gap-2">
              <Share className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                In Safari, tap <span className="text-foreground font-medium">Share</span> then{" "}
                <span className="text-foreground font-medium">Add to Home Screen</span>. The app
                then opens full screen, without the browser chrome.
              </span>
            </p>
          </div>
        </Section>

        <div className="px-4 pt-2">
          <SignOutButton />
        </div>
      </div>
    </>
  );
}
