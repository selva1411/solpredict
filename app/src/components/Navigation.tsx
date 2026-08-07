"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { useUserRole } from "@/hooks/useUserRole";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { useProgram } from "@/hooks/useProgram";
import { useAppState } from "@/contexts/AppContext";
import { keys } from "@/lib/api/keys";
import { TrendingUp, Trophy, Settings, Star, Activity, Wallet, Zap, Bell, BookOpen } from "lucide-react";

import { Logo3D } from "@/components/Logo3D";
import { MobileNav } from "@/components/MobileNav";

const NAV_ITEMS = [
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/dashboard", label: "Dashboard", icon: Activity },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/docs/help", label: "Help", icon: BookOpen },
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
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-[var(--color-gray-800)] transition-colors cursor-pointer">
        <Bell className="w-4 h-4 text-[var(--color-gray-400)] hover:text-[var(--color-gray-100)]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--negative)] text-white text-[8px] font-bold flex items-center justify-center rounded-full">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--surface-1)] border border-[var(--color-gray-800)] rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-3 border-b border-[var(--color-gray-800)] flex items-center justify-between">
              <span className="text-xs font-bold text-[var(--color-gray-100)] uppercase tracking-wider">Notifications</span>
              <span className="text-[10px] text-[var(--color-gray-400)]">{notifications.length} total</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-[10px] text-[var(--color-gray-400)] font-mono">No notifications yet</div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div key={n.id} className={`px-3 py-2.5 border-b border-[var(--color-gray-800)] last:border-0 ${!n.read ? 'bg-[var(--accent)]/10' : ''}`}>
                    <div className="text-[11px] text-[var(--color-gray-100)] font-medium">{n.message}</div>
                    <div className="text-[9px] text-[var(--color-gray-400)] font-mono mt-0.5">{new Date(n.createdAt).toLocaleString()}</div>
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
      <header className="sticky top-4 z-50 w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto bg-[#1A1C22]/70 backdrop-blur-[60px] border border-white/5 rounded-2xl px-5 h-14 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Logo3D />
              </div>
              <span className="text-base font-bold text-[#F4F4F9] group-hover:text-[#FFA500] transition-colors">
                PREDICT-X
              </span>
            </Link>
            <nav className="hidden lg:flex items-center gap-1 pl-4 border-l border-white/5">
              {NAV_ITEMS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg ${
                    isActive(href)
                      ? "text-[#FFA500] bg-[#FFA500]/10 border border-[#FFA500]/20"
                      : "text-[#808495] hover:text-[#F4F4F9] hover:bg-white/5"
                  }`}
                >
                  {label}
                </Link>
              ))}
              {role === "admin" && (
                <Link
                  href="/admin"
                  className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider rounded-lg flex items-center gap-1.5 border ${
                    isActive("/admin")
                      ? "bg-[#FFA500]/20 text-[#FFA500] border-[#FFA500]/50"
                      : "text-[#FFA500] border-[#FFA500]/20 hover:bg-[#FFA500]/10"
                  }`}
                >
                  <Settings className="w-3 h-3" />
                  Admin
                </Link>
              )}
              {publicKey && (
                <Link
                  href="/portfolio"
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg ${
                    isActive("/portfolio")
                      ? "text-[#FFA500] bg-[#FFA500]/10 border border-[#FFA500]/20"
                      : "text-[#808495] hover:text-[#F4F4F9] hover:bg-white/5"
                  }`}
                >
                  Portfolio
                </Link>
              )}
              <Link
                href="/activity"
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg ${
                  isActive("/activity")
                    ? "text-[#FFA500] bg-[#FFA500]/10 border border-[#FFA500]/20"
                    : "text-[#808495] hover:text-[#F4F4F9] hover:bg-white/5"
                }`}
              >
                Activity
              </Link>
              <Link
                href="/watchlist"
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg flex items-center gap-1 ${
                  isActive("/watchlist")
                    ? "text-[#FFA500] bg-[#FFA500]/10 border border-[#FFA500]/20"
                    : "text-[#808495] hover:text-[#F4F4F9] hover:bg-white/5"
                }`}
              >
                <Star className="w-3 h-3 text-[#FFA500]" />
                Watchlist
                {watchlistCount > 0 && (
                  <span className="bg-[#FFA500] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full">
                    {watchlistCount}
                  </span>
                )}
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1 rounded-lg">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping bg-[#4CAF50]"></span>
                <span className="relative inline-flex w-2 h-2 rounded-full bg-[#4CAF50]"></span>
              </span>
              <span className="text-[10px] font-mono text-[#808495] uppercase">Online</span>
            </div>

            <NotificationBell />

            <div className="hidden sm:block">
              <ClientWalletButton />
            </div>
            <MobileNav />
          </div>
        </div>
      </header>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1A1C22]/80 backdrop-blur-[40px] border-t border-white/5 h-16 flex items-center justify-around px-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive(href) ? "text-[#FFA500]" : "text-[#808495] hover:text-[#F4F4F9]"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[8px] uppercase font-semibold tracking-wider">{label}</span>
            {isActive(href) && <span className="w-5 h-0.5 bg-[#FFA500] rounded-full" />}
          </Link>
        ))}
        {publicKey && (
          <Link
            href="/portfolio"
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive("/portfolio") ? "text-[#FFA500]" : "text-[#808495] hover:text-[#F4F4F9]"
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[8px] uppercase font-semibold tracking-wider">Portfolio</span>
            {isActive("/portfolio") && <span className="w-5 h-0.5 bg-[#FFA500] rounded-full" />}
          </Link>
        )}
        <Link
          href="/activity"
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
            isActive("/activity") ? "text-[#FFA500]" : "text-[#808495] hover:text-[#F4F4F9]"
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[8px] uppercase font-semibold tracking-wider">Activity</span>
          {isActive("/activity") && <span className="w-5 h-0.5 bg-[#FFA500] rounded-full" />}
        </Link>
        <Link
          href="/watchlist"
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
            isActive("/watchlist") ? "text-[#FFA500]" : "text-[#808495] hover:text-[#F4F4F9]"
          }`}
        >
          <Star className="w-5 h-5" />
          <span className="text-[8px] uppercase font-semibold tracking-wider">Watchlist</span>
          {isActive("/watchlist") && <span className="w-5 h-0.5 bg-[#FFA500] rounded-full" />}
        </Link>
        <div className="block sm:hidden">
          <ClientWalletButton />
        </div>
      </div>
    </>
  );
}
