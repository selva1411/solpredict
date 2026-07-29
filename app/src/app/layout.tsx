import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
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
import ParticleBg from "@/components/ParticleBackgroundWrapper";

if (typeof globalThis !== "undefined") {
  try { validateEnv(); } catch {}
}

const inter = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} antialiased pb-16 md:pb-0`}
        style={{ fontFamily: "var(--font-geist-sans), system-ui, sans-serif" }}
      >
        <ParticleBg />
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
