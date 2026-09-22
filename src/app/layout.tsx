import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";

import { OfflineBanner } from "@/components/offline-banner";
import { ServiceWorkerRegistrar } from "@/components/service-worker-registrar";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { getSiteUrl } from "@/lib/env";

import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Debt Ledger",
    template: "%s · Debt Ledger",
  },
  description:
    "A personal ledger for money you have lent: who borrowed it, why, every repayment they have made, and exactly how much is still pending.",
  applicationName: "Debt Ledger",
  manifest: "/manifest.webmanifest",
  // Nothing here should ever be indexed - it is one person's financial records.
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
  appleWebApp: {
    capable: true,
    title: "Ledger",
    statusBarStyle: "default",
  },
  other: {
    // Next 16 emits only the standardised `mobile-web-app-capable`. Safari on
    // older iOS reads the legacy name, and it is what makes "Add to Home
    // Screen" open without browser chrome, so both are declared.
    "apple-mobile-web-app-capable": "yes",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Lets the layout run under the notch and home indicator so the safe-area
  // utilities in globals.css have something to work with.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} h-full`}>
      <body className="bg-background text-foreground flex min-h-full flex-col antialiased">
        <ThemeProvider>
          <OfflineBanner />
          {children}
          <Toaster position="top-center" richColors closeButton />
          <ServiceWorkerRegistrar />
        </ThemeProvider>
      </body>
    </html>
  );
}
