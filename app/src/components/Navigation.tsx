"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { MobileNav } from "@/components/MobileNav";
import { useProgram } from "@/hooks/useProgram";
import { getWatchlist } from "@/lib/watchlist";
import { Activity, Briefcase, Trophy, Settings, Star, List } from "lucide-react";

const NAV_ITEMS = [
  { href: "/markets", label: "Explorer", icon: Activity },
  { href: "/dashboard", label: "Dashboard", icon: Briefcase },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

interface WindowSolana {
  solana?: { publicKey?: { toString(): string }; isPhantom?: boolean };
  phantom?: { solana?: { publicKey?: { toString(): string }; isPhantom?: boolean } };
}

export function Navigation() {
  const { role } = useUserRole();
  const { publicKey } = useWallet();
  const pathname = usePathname();
  const { connection } = useProgram();
  const [watchlistCount, setWatchlistCount] = useState(0);

  const [healthStatus, setHealthStatus] = useState<"checking" | "online" | "offline">("checking");

  useEffect(() => {
    setWatchlistCount(getWatchlist().length);
    const onStorage = () => setWatchlistCount(getWatchlist().length);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    let active = true;
    const checkConnection = async () => {
      try {
        await connection.getSlot();
        if (active) setHealthStatus("online");
      } catch {
        if (active) setHealthStatus("offline");
      }
    };

    checkConnection();
    const interval = setInterval(checkConnection, 12000);
    return () => { active = false; clearInterval(interval); };
  }, [connection]);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Desktop Navigation */}
      <header className="sticky top-0 z-50 w-full border-b border-[#9e8e78]/20 bg-[#131313]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand + Nav links */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2 group">
              <span className="text-xl font-bold tracking-wider font-display text-gradient-amber group-hover:opacity-90 transition-opacity">
                [■] SOLPREDICT
              </span>
            </Link>
            <nav className="hidden sm:flex items-center space-x-1 pl-6 border-l border-[#9e8e78]/30">
              {NAV_ITEMS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`nav-link px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display transition-colors duration-200 ${
                    isActive(href)
                      ? "text-[#ffd89c] nav-link-active"
                      : "text-[#d6c4ac] hover:text-[#e5e2e1]"
                  }`}
                >
                  {label}
                </Link>
              ))}
              {role === "admin" && (
                <Link
                  href="/admin"
                  className={`nav-link px-3 py-1.5 text-xs font-bold uppercase tracking-wider font-display rounded-md transition-all flex items-center gap-1.5 border ${
                    isActive("/admin")
                      ? "bg-[#ffd89c]/15 text-[#ffd89c] border-[#ffd89c]/50 shadow-[0_0_12px_rgba(255,216,156,0.15)]"
                      : "bg-[#0d0d0d] text-[#ffd89c] border-[#ffd89c]/30 hover:bg-[#ffd89c]/10"
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Admin</span>
                </Link>
              )}
              {publicKey && (
                <Link
                  href="/portfolio"
                  className={`nav-link px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display transition-colors duration-200 ${
                    isActive("/portfolio")
                      ? "text-[#ffd89c] nav-link-active"
                      : "text-[#d6c4ac] hover:text-[#e5e2e1]"
                  }`}
                >
                  Portfolio
                </Link>
              )}
              <Link
                href="/activity"
                className={`nav-link px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display transition-colors duration-200 ${
                  isActive("/activity")
                    ? "text-[#ffd89c] nav-link-active"
                    : "text-[#d6c4ac] hover:text-[#e5e2e1]"
                }`}
              >
                Activity
              </Link>
              <Link
                href="/watchlist"
                className={`nav-link px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display transition-colors duration-200 flex items-center gap-1 ${
                  isActive("/watchlist")
                    ? "text-[#ffd89c] nav-link-active"
                    : "text-[#d6c4ac] hover:text-[#e5e2e1]"
                }`}
              >
                <Star className="w-3 h-3" />
                Watchlist
                {watchlistCount > 0 && (
                  <span
                    style={{
                      background: "var(--color-primary)",
                      color: "#131313",
                      fontSize: "9px",
                      fontWeight: 700,
                      borderRadius: "8px",
                      padding: "1px 6px",
                      lineHeight: "14px",
                    }}
                  >
                    {watchlistCount}
                  </span>
                )}
              </Link>
            </nav>
          </div>

          {/* RPC Health + Wallet */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 bg-[#0d0d0d]/80 border border-[#9e8e78]/20 px-3 py-1.5 rounded-md">
              <span className={`relative flex w-2 h-2 ${
                healthStatus === "online" ? "" : ""
              }`}>
                <span className={`absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping ${
                  healthStatus === "online" ? "bg-[#a1d494]" : healthStatus === "offline" ? "bg-[#ffb4ab]" : "bg-[#ffd89c]"
                }`}></span>
                <span className={`relative inline-flex w-2 h-2 rounded-full ${
                  healthStatus === "online" ? "bg-[#a1d494]" : healthStatus === "offline" ? "bg-[#ffb4ab]" : "bg-[#ffd89c]"
                }`}></span>
              </span>
              <span className="text-[10px] font-mono font-medium text-[#d6c4ac] uppercase tracking-wider">
                RPC: {healthStatus}
              </span>
            </div>

            {/* Devnet/Localnet Airdrop Button */}
            <button
              onClick={async () => {
                const w = typeof window !== "undefined" ? (window as unknown as WindowSolana) : undefined;
                const walletAdapter = w?.solana || w?.phantom?.solana;
                const pubkey = walletAdapter?.publicKey ? new (await import('@solana/web3.js')).PublicKey(walletAdapter.publicKey.toString()) : null;
                if (!pubkey) {
                  (await import('sonner')).toast.error("Please connect your wallet first!");
                  return;
                }
                try {
                  const toastId = (await import('sonner')).toast.loading("Airdropping 5 SOL to wallet...");
                  const sig = await connection.requestAirdrop(pubkey, 5 * 1e9);
                  await connection.confirmTransaction(sig, "confirmed");
                  (await import('sonner')).toast.success("Airdropped 5 SOL to wallet!", { id: toastId });
                } catch (e: any) {
                  (await import('sonner')).toast.error(`Airdrop failed: ${e.message || String(e)}`);
                }
              }}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-[#ffd89c]/10 hover:bg-[#ffd89c]/20 border border-[#ffd89c]/40 rounded-md text-xs font-mono font-bold text-[#ffd89c] transition-all cursor-pointer"
            >
              <span>🪂 Airdrop 5 SOL</span>
            </button>

            <MobileNav />
            <ClientWalletButton />
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#131313]/95 backdrop-blur-md border-t border-[#9e8e78]/20 h-16 flex items-center justify-around px-4 safe-area-bottom">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center space-y-0.5 transition-colors duration-200 ${
              isActive(href) ? "text-[#ffd89c]" : "text-[#d6c4ac] hover:text-[#e5e2e1]"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[8px] uppercase font-display font-semibold tracking-wider">{label}</span>
            {isActive(href) && <span className="w-6 h-0.5 bg-[#ffd89c] rounded-full" />}
          </Link>
        ))}
        {role === "admin" && (
          <Link
            href="/admin"
            className={`flex flex-col items-center justify-center space-y-0.5 transition-colors duration-200 ${
              isActive("/admin") ? "text-[#ffd89c]" : "text-[#d6c4ac] hover:text-[#e5e2e1]"
            }`}
          >
            <Settings className="w-5 h-5" />
            <span className="text-[8px] uppercase font-display font-semibold tracking-wider">Admin</span>
            {isActive("/admin") && <span className="w-6 h-0.5 bg-[#ffd89c] rounded-full" />}
          </Link>
        )}
        {publicKey && (
          <Link
            href="/portfolio"
            className={`flex flex-col items-center justify-center space-y-0.5 transition-colors duration-200 ${
              isActive("/portfolio") ? "text-[#ffd89c]" : "text-[#d6c4ac] hover:text-[#e5e2e1]"
            }`}
          >
            <List className="w-5 h-5" />
            <span className="text-[8px] uppercase font-display font-semibold tracking-wider">Portfolio</span>
            {isActive("/portfolio") && <span className="w-6 h-0.5 bg-[#ffd89c] rounded-full" />}
          </Link>
        )}
        <Link
          href="/activity"
          className={`flex flex-col items-center justify-center space-y-0.5 transition-colors duration-200 ${
            isActive("/activity") ? "text-[#ffd89c]" : "text-[#d6c4ac] hover:text-[#e5e2e1]"
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[8px] uppercase font-display font-semibold tracking-wider">Activity</span>
          {isActive("/activity") && <span className="w-6 h-0.5 bg-[#ffd89c] rounded-full" />}
        </Link>
        <Link
          href="/watchlist"
          className={`flex flex-col items-center justify-center space-y-0.5 transition-colors duration-200 ${
            isActive("/watchlist") ? "text-[#ffd89c]" : "text-[#d6c4ac] hover:text-[#e5e2e1]"
          }`}
        >
          <Star className="w-5 h-5" />
          <span className="text-[8px] uppercase font-display font-semibold tracking-wider">Watchlist</span>
          {isActive("/watchlist") && <span className="w-6 h-0.5 bg-[#ffd89c] rounded-full" />}
        </Link>
      </div>
    </>
  );
}
