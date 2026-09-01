import type { Metadata } from "next";
import { Unbounded, Sora, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { Navigation } from "@/components/Navigation";
import { GlobalPriceTicker } from "@/components/GlobalPriceTicker";
import { MobileBottomNav } from "@/components/MobileNav";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";
import { WebVitals } from "@/components/WebVitals";
import { ScrollToTop } from "@/components/ScrollToTop";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { validateEnv } from "@/lib/env-validate";

if (typeof globalThis !== "undefined") {
  try { validateEnv(); } catch {}
}

const unbounded = Unbounded({
  variable: "--font-unbounded",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
});

const sora = Sora({
  variable: "--font-sora",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ??
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000"),
  ),
  title: "SOLPREDICT — Trade the Future on Solana",
  description:
    "The fastest prediction market on Solana. Trade YES/NO positions with CPMM pricing, Pyth oracle resolution and instant on-chain settlement — lower fees, deeper liquidity, faster markets than anywhere else.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "SOLPREDICT",
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
      className={`${unbounded.variable} ${sora.variable} ${jetBrainsMono.variable} min-h-screen text-ivory antialiased pt-14 pb-16 md:pb-0`}
    >
        <div className="relative z-10">
          <WalletContextProvider>
            <ErrorBoundary>
              <Navigation />
              <GlobalPriceTicker />
              <main className="rise">
                {children}
              </main>
            </ErrorBoundary>
            <MobileBottomNav />
          </WalletContextProvider>
        </div>
        <Toaster />
        <WebVitals />
        <ServiceWorkerRegister />
        <ScrollToTop />
      </body>
    </html>
  );
}
