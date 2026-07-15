import type { Metadata } from "next";
import { IBM_Plex_Sans, Share_Tech, Space_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Link from "next/link";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Navigation } from "@/components/Navigation";

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

          {/* Mechanical Navigation & Routing */}
          <Navigation />

          {/* Page Content Container (with extra bottom padding for mobile bottom bar) */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 sm:pb-8 flex flex-col">
            {children}
          </main>

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
