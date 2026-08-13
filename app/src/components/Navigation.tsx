"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { AirdropSolButton } from "@/components/AirdropSolButton";
import { useProgram } from "@/hooks/useProgram";
import { useAppState } from "@/contexts/AppContext";
import { keys } from "@/lib/api/keys";
import { Settings, Star, Wallet, Activity } from "lucide-react";

import { Logo3D } from "@/components/Logo3D";
import { MobileNav } from "@/components/MobileNav";

const NAV_ITEMS = [
  { href: "/markets", label: "Markets" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/activity", label: "Activity" },
  { href: "/watchlist", label: "Watchlist" },
];

function NotificationBell() {
  const { publicKey } = useWallet();
  const [open, setOpen] = useState(false);

  const walletStr = publicKey?.toBase58() ?? null;

  const { data: notifications = [] } = useQuery({
    queryKey: keys.user.notifications(walletStr ?? "none"),
    queryFn: async () => {
      const r = await fetch(`/api/user/notifications?wallet=${walletStr}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const data = await r.json();
      return (data.notifications ?? []) as Array<{ id: string; type: string; message: string; read: boolean; createdAt: string }>;
    },
    enabled: !!walletStr,
    refetchInterval: 30_000,
    staleTime: 15_000,
  });

  const unread = notifications.filter((n) => !n.read).length;

  if (!publicKey) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-[2px] hover:bg-ivory/5 transition-colors cursor-pointer">
        <span className="block w-3.5 h-3.5" aria-hidden />
        <svg className="absolute inset-2.5 w-3.5 h-3.5 text-ash" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 bg-bordeaux text-ivory text-[8px] font-bold flex items-center justify-center rounded-[2px]">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 surface z-50 overflow-hidden">
            <div className="p-3 border-b border-hairline flex items-center justify-between">
              <span className="label-lux">Notifications</span>
              <span className="text-[10px] text-ash-dim">{notifications.length} total</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-[10px] text-ash-dim font-mono">No notifications yet</div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div key={n.id} className={`px-3 py-2.5 border-b border-hairline last:border-0 ${!n.read ? "bg-gold/5" : ""}`}>
                    <div className="text-[11px] text-ivory font-medium">{n.message}</div>
                    <div className="text-[9px] text-ash-dim font-mono mt-0.5">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function Navigation() {
  const { role } = useUserRole();
  const { publicKey } = useWallet();
  const pathname = usePathname();
  const { connection } = useProgram();
  const { watchlist } = useAppState();
  const watchlistCount = watchlist.length;

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Desktop header — one row, 64px, bottom hairline, NOT sticky-blurred */}
      <header className="w-full border-b border-hairline bg-void">
        <div className="mx-auto w-full max-w-[1240px] px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-6 h-6 flex items-center justify-center">
                <Logo3D />
              </div>
              <span className="font-display text-[19px] tracking-[-0.02em] text-ivory group-hover:text-gold-lite transition-colors">
                SOLPREDICT
              </span>
            </Link>
            <nav className="hidden lg:flex items-center gap-6">
              {NAV_ITEMS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`relative font-mono text-[11px] uppercase tracking-[.16em] transition-colors ${
                    isActive(href)
                      ? "text-gold-lite after:absolute after:left-0 after:-bottom-[6px] after:h-px after:w-full after:bg-gold after:content-['']"
                      : "text-ash hover:text-ivory"
                  }`}
                >
                  {label}
                  {href === "/watchlist" && watchlistCount > 0 && (
                    <span className="ml-1.5 text-gold-deep font-bold">{watchlistCount}</span>
                  )}
                </Link>
              ))}
              {role === "admin" && (
                <Link
                  href="/admin"
                  className={`relative flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[.16em] transition-colors ${
                    isActive("/admin")
                      ? "text-gold-lite after:absolute after:left-0 after:-bottom-[6px] after:h-px after:w-full after:bg-gold after:content-['']"
                      : "text-gold hover:text-gold-lite"
                  }`}
                >
                  <Settings className="w-3 h-3" />
                  Admin
                </Link>
              )}
              <Link
                href="/docs/help"
                className={`relative font-mono text-[11px] uppercase tracking-[.16em] transition-colors ${
                  isActive("/docs/help")
                    ? "text-gold-lite after:absolute after:left-0 after:-bottom-[6px] after:h-px after:w-full after:bg-gold after:content-['']"
                    : "text-ash hover:text-ivory"
                }`}
              >
                Help
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-1.5 font-mono text-[10px] text-ash-dim uppercase tracking-[.16em]">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex w-full h-full rounded-[2px] opacity-75 animate-ping bg-verdigris"></span>
                <span className="relative inline-flex w-1.5 h-1.5 rounded-[2px] bg-verdigris"></span>
              </span>
              Live
            </span>

            <NotificationBell />

            <div className="hidden sm:flex items-center gap-2">
              <AirdropSolButton />
              <ClientWalletButton />
            </div>
            <MobileNav />
          </div>
        </div>
      </header>

      {/* Mobile bottom nav — hairline top, mono, no pills */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-void border-t border-hairline h-16 flex items-center justify-around px-4">
        {NAV_ITEMS.slice(0, 3).map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              isActive(href) ? "text-gold-lite" : "text-ash hover:text-ivory"
            }`}
          >
            <span className="font-mono text-[9px] uppercase tracking-[.14em]">{label}</span>
            {isActive(href) && <span className="w-4 h-px bg-gold" />}
          </Link>
        ))}
        {publicKey && (
          <Link
            href="/portfolio"
            className={`flex flex-col items-center justify-center gap-1 transition-colors ${
              isActive("/portfolio") ? "text-gold-lite" : "text-ash hover:text-ivory"
            }`}
          >
            <Wallet className="w-4 h-4" />
            <span className="font-mono text-[9px] uppercase tracking-[.14em]">Portfolio</span>
          </Link>
        )}
        <Link
          href="/activity"
          className={`flex flex-col items-center justify-center gap-1 transition-colors ${
            isActive("/activity") ? "text-gold-lite" : "text-ash hover:text-ivory"
          }`}
        >
          <Activity className="w-4 h-4" />
          <span className="font-mono text-[9px] uppercase tracking-[.14em]">Activity</span>
        </Link>
        <div className="block sm:hidden">
          <ClientWalletButton />
        </div>
      </div>
    </>
  );
}
