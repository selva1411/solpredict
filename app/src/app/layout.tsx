import type { Metadata } from "next";
import { IBM_Plex_Sans, Share_Tech, Space_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Link from "next/link";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { ScrollProgress } from "@/components/ScrollProgress";
import { MobileNav } from "@/components/MobileNav";
import { Activity, Briefcase, Trophy, Settings } from "lucide-react";

const ibmLangSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const shareTech = Share_Tech({
  variable: "--font-share-tech",
  subsets: ["latin"],
  weight: ["400"],
  display: "swap",
});

const spaceMono = Space_Mono({
  variable: "--font-space-mono",
  subsets: ["latin"],
  weight: ["400", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SOLPredict — Decentralized Prediction Board",
  description: "Predict the future and own the outcome. Trade YES/NO contracts on Solana, settled by trustless Pyth oracles.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${ibmLangSans.variable} ${shareTech.variable} ${spaceMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#15171E] text-[#F4F4F9]">
        <WalletContextProvider>
          {/* Scroll Progress Bar */}
          <ScrollProgress />

          {/* Grid Overlay */}
          <div className="grid-overlay" />

          {/* Cinematic Film Grain Overlay */}
          <div className="noise-overlay" />

          {/* Mechanical Navigation Header */}
          <header className="sticky top-0 z-50 w-full border-b-2 border-[#2D3142] bg-[#0C0D12]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              {/* Brand Logo */}
              <div className="flex items-center space-x-3">
                <Link href="/" className="flex items-center space-x-2">
                  <span className="text-xl font-bold tracking-wider font-display text-[#FFA500]">
                    [■] SOLPREDICT
                  </span>
                </Link>
                <div className="hidden sm:flex items-center space-x-1 pl-6 border-l border-[#2D3142]">
                  <Link href="/" className="px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display text-[#808495] hover:text-[#FFA500] transition-colors">
                    Explorer
                  </Link>
                  <Link href="/portfolio" className="px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display text-[#808495] hover:text-[#FFA500] transition-colors">
                    Portfolio
                  </Link>
                  <Link href="/leaderboard" className="px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display text-[#808495] hover:text-[#FFA500] transition-colors">
                    Leaderboard
                  </Link>
                  <Link href="/admin" className="px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display text-[#808495] hover:text-[#FFA500] transition-colors">
                    Admin
                  </Link>
                </div>
              </div>

              {/* Wallet Integration Button & Ticker */}
              <div className="flex items-center space-x-4">
                <div className="hidden md:flex items-center space-x-2 bg-[#050608] border border-[#2D3142] px-3 py-1.5 rounded">
                  <span className="w-2 h-2 rounded-full bg-[#FFA500] animate-pulse"></span>
                  <span className="text-xs font-mono font-medium text-[#808495]">SOL/USD: $267.12</span>
                </div>
                
                {/* Mobile Nav */}
                <MobileNav />

                {/* Client-only Wallet Button wrapper */}
                <ClientWalletButton />
              </div>
            </div>
          </header>

          {/* Page Content Container (with extra bottom padding for mobile bottom bar) */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 sm:pb-8 flex flex-col">
            {children}
          </main>

          {/* Mobile bottom navigation bar for one-handed reach */}
          <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0C0D12] border-t-2 border-[#2D3142] h-16 flex items-center justify-around px-4">
            <Link href="/" className="flex flex-col items-center justify-center space-y-0.5 text-[#808495] hover:text-[#FFA500]">
              <Activity className="w-5 h-5" />
              <span className="text-[9px] uppercase font-display font-semibold">Explorer</span>
            </Link>
            <Link href="/portfolio" className="flex flex-col items-center justify-center space-y-0.5 text-[#808495] hover:text-[#FFA500]">
              <Briefcase className="w-5 h-5" />
              <span className="text-[9px] uppercase font-display font-semibold">Portfolio</span>
            </Link>
            <Link href="/leaderboard" className="flex flex-col items-center justify-center space-y-0.5 text-[#808495] hover:text-[#FFA500]">
              <Trophy className="w-5 h-5" />
              <span className="text-[9px] uppercase font-display font-semibold">Rankings</span>
            </Link>
            <Link href="/admin" className="flex flex-col items-center justify-center space-y-0.5 text-[#808495] hover:text-[#FFA500]">
              <Settings className="w-5 h-5" />
              <span className="text-[9px] uppercase font-display font-semibold">Admin</span>
            </Link>
          </div>

          {/* Departure Board Footer */}
          <footer className="w-full border-t-2 border-[#2D3142] bg-[#0C0D12] py-6 mt-auto text-xs text-[#808495] hidden sm:block">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="font-mono">
                &copy; 2026 SOLPREDICT // SOLANA Devnet // PYTH NETWORK ORACLES
              </p>
              <div className="flex items-center space-x-4 font-mono">
                <span>FEED: rec5EK...5LtFJ</span>
              </div>
            </div>
          </footer>

          <Toaster theme="dark" position="bottom-right" richColors />
        </WalletContextProvider>
      </body>
    </html>
  );
}
