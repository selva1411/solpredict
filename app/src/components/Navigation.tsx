"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { useProgram } from "@/hooks/useProgram";
import { getWatchlist } from "@/lib/watchlist";
import dynamic from "next/dynamic";
import { TrendingUp, Trophy, Settings, Star, Activity, Wallet, Zap, Bell } from "lucide-react";

const Logo3D = dynamic(() => import("@/components/Logo3D").then(m => ({ default: m.Logo3D })), { ssr: false });
import { MobileNav } from "@/components/MobileNav";

const NAV_ITEMS = [
  { href: "/markets", label: "Markets", icon: TrendingUp },
  { href: "/dashboard", label: "Dashboard", icon: Activity },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
];

function NotificationBell() {
  const { publicKey } = useWallet();
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: string; type: string; message: string; read: boolean; createdAt: string }>>([]);

  useEffect(() => {
    if (!publicKey) return;
    fetch(`/api/user/notifications?wallet=${publicKey.toBase58()}`)
      .then(r => r.json())
      .then(data => {
        if (data.notifications) {
          setNotifications(data.notifications);
          setUnread(data.notifications.filter((n: { read: boolean }) => !n.read).length);
        }
      })
      .catch(() => {});
    const interval = setInterval(() => {
      fetch(`/api/user/notifications?wallet=${publicKey.toBase58()}`)
        .then(r => r.json())
        .then(data => {
          if (data.notifications) {
            setNotifications(data.notifications);
            setUnread(data.notifications.filter((n: { read: boolean }) => !n.read).length);
          }
        })
        .catch(() => {});
    }, 30000);
    return () => clearInterval(interval);
  }, [publicKey]);

  if (!publicKey) return null;

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-white/5 transition-colors cursor-pointer">
        <Bell className="w-4 h-4 text-[#A5A8B8] hover:text-[#F4F5FA]" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[#FF4D6D] text-white text-[8px] font-bold flex items-center justify-center rounded-full">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-80 bg-[#0A0B12] border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-3 border-b border-white/5 flex items-center justify-between">
              <span className="text-xs font-bold text-[#F4F5FA] uppercase tracking-wider">Notifications</span>
              <span className="text-[10px] text-[#A5A8B8]">{notifications.length} total</span>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-[10px] text-[#A5A8B8] font-mono">No notifications yet</div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div key={n.id} className={`px-3 py-2.5 border-b border-white/5 last:border-0 ${!n.read ? 'bg-[#7B3FE4]/5' : ''}`}>
                    <div className="text-[11px] text-[#F4F5FA] font-medium">{n.message}</div>
                    <div className="text-[9px] text-[#A5A8B8] font-mono mt-0.5">{new Date(n.createdAt).toLocaleString()}</div>
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
  const [watchlistCount, setWatchlistCount] = useState(0);

  useEffect(() => {
    setWatchlistCount(getWatchlist().length);
    const onStorage = () => setWatchlistCount(getWatchlist().length);
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const isActive = (href: string) => pathname === href;

  return (
    <>
      <header className="sticky top-4 z-50 w-full px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto bg-[#0A0B12]/70 backdrop-blur-[60px] border border-white/5 rounded-2xl px-5 h-14 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-4">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 flex items-center justify-center group-hover:scale-105 transition-transform">
                <Logo3D />
              </div>
              <span className="text-base font-bold text-[#F4F5FA] group-hover:text-[#00E5FF] transition-colors">
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
                      ? "text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/20"
                      : "text-[#A5A8B8] hover:text-[#F4F5FA] hover:bg-white/5"
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
                      ? "bg-[#7B3FE4]/20 text-[#7B3FE4] border-[#7B3FE4]/50"
                      : "text-[#7B3FE4] border-[#7B3FE4]/20 hover:bg-[#7B3FE4]/10"
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
                      ? "text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/20"
                      : "text-[#A5A8B8] hover:text-[#F4F5FA] hover:bg-white/5"
                  }`}
                >
                  Portfolio
                </Link>
              )}
              <Link
                href="/activity"
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg ${
                  isActive("/activity")
                    ? "text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/20"
                    : "text-[#A5A8B8] hover:text-[#F4F5FA] hover:bg-white/5"
                }`}
              >
                Activity
              </Link>
              <Link
                href="/watchlist"
                className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-all rounded-lg flex items-center gap-1 ${
                  isActive("/watchlist")
                    ? "text-[#00E5FF] bg-[#00E5FF]/10 border border-[#00E5FF]/20"
                    : "text-[#A5A8B8] hover:text-[#F4F5FA] hover:bg-white/5"
                }`}
              >
                <Star className="w-3 h-3 text-[#00E5FF]" />
                Watchlist
                {watchlistCount > 0 && (
                  <span className="bg-[#7B3FE4] text-white text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-full">
                    {watchlistCount}
                  </span>
                )}
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/5 border border-white/5 px-3 py-1 rounded-lg">
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full opacity-75 animate-ping bg-[#C8FF00]"></span>
                <span className="relative inline-flex w-2 h-2 rounded-full bg-[#C8FF00]"></span>
              </span>
              <span className="text-[10px] font-mono text-[#A5A8B8] uppercase">Online</span>
            </div>

            <NotificationBell />

            <div className="hidden sm:block">
              <ClientWalletButton />
            </div>
            <MobileNav />
          </div>
        </div>
      </header>

      <div className="sm:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0A0B12]/80 backdrop-blur-[40px] border-t border-white/5 h-16 flex items-center justify-around px-4">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive(href) ? "text-[#00E5FF]" : "text-[#A5A8B8] hover:text-[#F4F5FA]"
            }`}
          >
            <Icon className="w-5 h-5" />
            <span className="text-[8px] uppercase font-semibold tracking-wider">{label}</span>
            {isActive(href) && <span className="w-5 h-0.5 bg-[#7B3FE4] rounded-full" />}
          </Link>
        ))}
        {publicKey && (
          <Link
            href="/portfolio"
            className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
              isActive("/portfolio") ? "text-[#00E5FF]" : "text-[#A5A8B8] hover:text-[#F4F5FA]"
            }`}
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[8px] uppercase font-semibold tracking-wider">Portfolio</span>
            {isActive("/portfolio") && <span className="w-5 h-0.5 bg-[#7B3FE4] rounded-full" />}
          </Link>
        )}
        <Link
          href="/activity"
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
            isActive("/activity") ? "text-[#00E5FF]" : "text-[#A5A8B8] hover:text-[#F4F5FA]"
          }`}
        >
          <Activity className="w-5 h-5" />
          <span className="text-[8px] uppercase font-semibold tracking-wider">Activity</span>
          {isActive("/activity") && <span className="w-5 h-0.5 bg-[#7B3FE4] rounded-full" />}
        </Link>
        <Link
          href="/watchlist"
          className={`flex flex-col items-center justify-center gap-0.5 transition-colors ${
            isActive("/watchlist") ? "text-[#00E5FF]" : "text-[#A5A8B8] hover:text-[#F4F5FA]"
          }`}
        >
          <Star className="w-5 h-5" />
          <span className="text-[8px] uppercase font-semibold tracking-wider">Watchlist</span>
          {isActive("/watchlist") && <span className="w-5 h-0.5 bg-[#7B3FE4] rounded-full" />}
        </Link>
        <div className="block sm:hidden">
          <ClientWalletButton />
        </div>
      </div>
    </>
  );
}
