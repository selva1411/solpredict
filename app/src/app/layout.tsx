import type { Metadata } from "next";
import { IBM_Plex_Sans, Share_Tech, Space_Mono, Orbitron, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { Navigation } from "@/components/Navigation";
import { MobileBottomNav } from "@/components/MobileNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { WebVitals } from "@/components/WebVitals";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { validateEnv } from "@/lib/env-validate";

if (typeof globalThis !== "undefined") {
  try { validateEnv(); } catch {}
}

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const shareTech = Share_Tech({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

const spaceMono = Space_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  weight: ["600", "700", "800", "900"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "PREDICT-X — Predict the Future. Win the Future.",
  description: "Solana's premier prediction market. Trade YES/NO on any outcome with sub-second settlement, CPMM pricing, and Pyth oracle resolution.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "PREDICT-X",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${ibmPlexSans.variable} ${shareTech.variable} ${spaceMono.variable} ${orbitron.variable} ${jetBrainsMono.variable} antialiased pb-16 md:pb-0`}
        style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
      >
        <WalletContextProvider>
          <ErrorBoundary>
            <Navigation />
            <main className="animate-fade-in">
              {children}
            </main>
          </ErrorBoundary>
          <MobileBottomNav />
        </WalletContextProvider>
        <Toaster />
        <WebVitals />
        <ServiceWorkerRegister />
        <ScrollToTop />
      </body>
    </html>
  );
}
