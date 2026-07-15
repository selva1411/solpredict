"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { MobileNav } from "@/components/MobileNav";
import { Activity, Briefcase, Trophy, Settings } from "lucide-react";

export function Navigation() {
  const { role } = useUserRole();
  const pathname = usePathname();

  return (
    <>
      {/* Mechanical Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-[#9e8e78]/30 bg-[#131313]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Brand Logo */}
          <div className="flex items-center space-x-3">
            <Link href="/" className="flex items-center space-x-2">
              <span className="text-xl font-bold tracking-wider font-display text-[#ffd89c]">
                [■] SOLPREDICT
              </span>
            </Link>
            <div className="hidden sm:flex items-center space-x-1 pl-6 border-l border-[#9e8e78]/30">
              <Link href="/markets" className={`px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display transition-colors hover:text-[#ffd89c] ${pathname === "/markets" ? "text-[#ffd89c]" : "text-[#d6c4ac]"}`}>
                Explorer
              </Link>
              <Link href="/dashboard" className={`px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display transition-colors hover:text-[#ffd89c] ${pathname === "/dashboard" ? "text-[#ffd89c]" : "text-[#d6c4ac]"}`}>
                Dashboard
              </Link>
              <Link href="/leaderboard" className={`px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display transition-colors hover:text-[#ffd89c] ${pathname === "/leaderboard" ? "text-[#ffd89c]" : "text-[#d6c4ac]"}`}>
                Leaderboard
              </Link>
              {role === "admin" && (
                <Link href="/admin" className={`px-3 py-2 text-sm font-semibold uppercase tracking-wider font-display transition-colors hover:text-[#ffd89c] ${pathname === "/admin" ? "text-[#ffd89c]" : "text-[#d6c4ac]"}`}>
                  Admin
                </Link>
              )}
            </div>
          </div>

          {/* Wallet Integration Button & Ticker */}
          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-2 bg-[#0d0d0d] border border-[#9e8e78]/30 px-3 py-1.5 rounded">
              <span className="w-2 h-2 rounded-full bg-[#ffd89c] animate-pulse"></span>
              <span className="text-xs font-mono font-medium text-[#d6c4ac]">SOL/USD: $267.12</span>
            </div>
            
            {/* Mobile Nav */}
            <MobileNav />

            {/* Client-only Wallet Button wrapper */}
            <ClientWalletButton />
          </div>
        </div>
      </header>

      {/* Mobile bottom navigation bar */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#131313] border-t border-[#9e8e78]/30 h-16 flex items-center justify-around px-4">
        <Link href="/markets" className={`flex flex-col items-center justify-center space-y-0.5 hover:text-[#ffd89c] ${pathname === "/markets" ? "text-[#ffd89c]" : "text-[#d6c4ac]"}`}>
          <Activity className="w-5 h-5" />
          <span className="text-[9px] uppercase font-display font-semibold">Explorer</span>
        </Link>
        <Link href="/dashboard" className={`flex flex-col items-center justify-center space-y-0.5 hover:text-[#ffd89c] ${pathname === "/dashboard" ? "text-[#ffd89c]" : "text-[#d6c4ac]"}`}>
          <Briefcase className="w-5 h-5" />
          <span className="text-[9px] uppercase font-display font-semibold">Dashboard</span>
        </Link>
        <Link href="/leaderboard" className={`flex flex-col items-center justify-center space-y-0.5 hover:text-[#ffd89c] ${pathname === "/leaderboard" ? "text-[#ffd89c]" : "text-[#d6c4ac]"}`}>
          <Trophy className="w-5 h-5" />
          <span className="text-[9px] uppercase font-display font-semibold">Rankings</span>
        </Link>
        {role === "admin" && (
          <Link href="/admin" className={`flex flex-col items-center justify-center space-y-0.5 hover:text-[#ffd89c] ${pathname === "/admin" ? "text-[#ffd89c]" : "text-[#d6c4ac]"}`}>
            <Settings className="w-5 h-5" />
            <span className="text-[9px] uppercase font-display font-semibold">Admin</span>
          </Link>
        )}
      </div>
    </>
  );
}
