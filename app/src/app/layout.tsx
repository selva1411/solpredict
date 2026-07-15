import type { Metadata } from "next";
import { Archivo_Narrow, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Navigation } from "@/components/Navigation";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const archivoNarrow = Archivo_Narrow({
  variable: "--font-archivo-narrow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
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
      className={`${inter.variable} ${archivoNarrow.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#131313] text-[#e5e2e1]">
        <WalletContextProvider>
          {/* Scroll Progress Bar */}
          <ScrollProgress />

          {/* Grid Overlay */}
          <div className="grid-overlay" />

          {/* Cinematic Film Grain Overlay */}
          <div className="noise-overlay" />

          {/* Scanline CRT Overlay */}
          <div className="scanline-overlay" />

          {/* Mechanical Navigation & Routing */}
          <Navigation />

          {/* Page Content Container */}
          <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 sm:pb-8 flex flex-col">
            {children}
          </main>

          {/* Departure Board Footer */}
          <footer className="w-full border-t border-[#9e8e78]/30 bg-[#131313] py-6 mt-auto text-xs text-[#d6c4ac] hidden sm:block">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
              <p>
                &copy; 2026 SOLPREDICT // SOLANA Localnet/Devnet // PYTH NETWORK ORACLES
              </p>
              <div className="flex items-center space-x-4">
                <span>FEED ID: rec5EK...5LtFJ</span>
              </div>
            </div>
          </footer>

          <Toaster theme="dark" position="bottom-right" richColors />
        </WalletContextProvider>
      </body>
    </html>
  );
}
