import type { Metadata } from "next";
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import Link from "next/link";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { ClientWalletButton } from "@/components/ClientWalletButton";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "SOLPredict — Decentralized Prediction Markets",
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
      className={`${inter.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-space-deep text-text-primary">
        <WalletContextProvider>
          {/* Obsidian Navigation Glass Header */}
          <header className="sticky top-0 z-50 w-full border-b border-white/8 bg-[#050510]/60 backdrop-blur-md">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
              {/* Brand Logo */}
              <div className="flex items-center space-x-3">
                <Link href="/" className="flex items-center space-x-2">
                  <span className="text-xl font-bold tracking-tight font-display bg-gradient-to-r from-violet-400 to-cyan-400 bg-clip-text text-transparent">
                    🔮 SOLPredict
                  </span>
                </Link>
                <div className="hidden sm:flex items-center space-x-1 pl-6 border-l border-white/10">
                  <Link href="/" className="px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors">
                    Explorer
                  </Link>
                  <Link href="/portfolio" className="px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors">
                    Portfolio
                  </Link>
                  <Link href="/admin" className="px-3 py-2 text-sm font-medium text-text-muted hover:text-text-primary transition-colors">
                    Admin
                  </Link>
                </div>
              </div>

              {/* Wallet Integration Button & Ticker */}
              <div className="flex items-center space-x-4">
                <div className="hidden md:flex items-center space-x-2 bg-white/5 border border-white/10 px-3 py-1.5 rounded-full">
                  <span className="w-2 h-2 rounded-full bg-[#10E58C] animate-pulse"></span>
                  <span className="text-xs font-mono font-medium text-text-muted">SOL/USD: $267.12</span>
                </div>
                
                {/* Client-only Wallet Button wrapper */}
                <ClientWalletButton />
              </div>
            </div>
          </header>

          {/* Page Content Container */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col">
            {children}
          </main>

          {/* Glass Footer */}
          <footer className="w-full border-t border-white/8 bg-[#050510]/40 backdrop-blur-sm py-6 mt-auto">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-text-muted">
                &copy; 2026 SOLPredict. Built on Solana Devnet. All oracle calculations powered by Pyth Network.
              </p>
              <div className="flex items-center space-x-4 text-xs text-text-muted">
                <span>Oracle ID: rec5EK...5LtFJ</span>
              </div>
            </div>
          </footer>

          <Toaster theme="dark" position="bottom-right" richColors />
        </WalletContextProvider>
      </body>
    </html>
  );
}
