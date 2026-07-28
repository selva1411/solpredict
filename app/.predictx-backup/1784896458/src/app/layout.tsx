import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";
import { ScrollProgress } from "@/components/ScrollProgress";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { ToastProvider } from "@/components/NotificationToast";
import { ExtensionErrorSuppressor } from "@/components/ExtensionErrorSuppressor";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
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
  title: "SolPredict — The Future is Predictable",
  description: "Trade YES/NO contracts on Solana. Decentralized prediction markets settled by trustless Pyth oracles.",
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
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col font-sans bg-[#0a0a0a] text-[#e5e2e1]">
        <ExtensionErrorSuppressor />
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

            <ToastProvider>
              {children}
            </ToastProvider>

            <Toaster theme="dark" position="bottom-right" richColors />
          </ErrorBoundary>
        </WalletContextProvider>
      </body>
    </html>
  );
}