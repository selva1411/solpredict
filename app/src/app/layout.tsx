import type { Metadata } from "next";
import { Archivo_Narrow, Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { ScrollProgress } from "@/components/ScrollProgress";
import { Navigation } from "@/components/Navigation";
import { ErrorBoundary } from "@/components/ErrorBoundary";

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
  metadataBase: new URL(process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : "http://localhost:3000"),
  title: "SOLPredict — Decentralized Prediction Board",
  description: "Predict the future and own the outcome. Trade YES/NO contracts on Solana, settled by trustless Pyth oracles.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
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
          <ErrorBoundary>
            <ScrollProgress />

            {/* Background layers */}
            <div className="dot-pattern" />
            <div className="grid-overlay" />
            <div className="ambient-glow ambient-glow-1" />
            <div className="ambient-glow ambient-glow-2" />
            <div className="ambient-glow ambient-glow-3" />
            <div className="noise-overlay" />
            <div className="scanline-overlay" />

            <Navigation />

            <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24 sm:pb-8 flex flex-col">
              {children}
            </main>

            <footer className="w-full border-t border-[#9e8e78]/20 bg-[#131313]/80 backdrop-blur-sm py-6 mt-auto text-xs text-[#d6c4ac] hidden sm:block">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono">
                <p className="text-[#d6c4ac]/60">
                  &copy; 2026 SOLPREDICT // DEVNET // PYTH ORACLES
                </p>
                <div className="flex items-center space-x-4 text-[#d6c4ac]/40">
                  <span>FEED rec5EK...5LtFJ</span>
                </div>
              </div>
            </footer>

            <Toaster theme="dark" position="bottom-right" richColors />
          </ErrorBoundary>
        </WalletContextProvider>
      </body>
    </html>
  );
}
