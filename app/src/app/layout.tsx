import type { Metadata } from "next";
import { IBM_Plex_Sans, Share_Tech, Space_Mono, Orbitron, JetBrains_Mono } from "next/font/google";
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
  title: "SOLPREDICT — Institutional Solana Prediction Markets",
  description: "Conviction, priced. Solana's premier prediction terminal — trade YES/NO on any outcome with CPMM pricing and Pyth oracle resolution, settled on-chain.",
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
        className={`${ibmPlexSans.variable} ${shareTech.variable} ${spaceMono.variable} ${orbitron.variable} ${jetBrainsMono.variable} min-h-screen bg-void text-ivory antialiased pb-16 md:pb-0`}
      >
        <div className="lux-bloom" aria-hidden />
        <div className="lux-grain" aria-hidden />
        {/* keep all existing providers here, unchanged */}
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
