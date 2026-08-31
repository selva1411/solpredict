"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { useUserRole } from "@/hooks/useUserRole";
import { useWallet } from "@solana/wallet-adapter-react";
import { ClientWalletButton } from "@/components/ClientWalletButton";
import { AirdropSolButton } from "@/components/AirdropSolButton";
import { useProgram } from "@/hooks/useProgram";
import { useAppState } from "@/contexts/AppContext";
import { keys } from "@/lib/api/keys";
import { signUserProof, userFetch } from "@/lib/user-client";
import { Settings } from "lucide-react";

import { Logo3D } from "@/components/Logo3D";
import { MobileNav } from "@/components/MobileNav";

const NAV_ITEMS = [
  { href: "/markets", label: "Markets" },
  { href: "/create", label: "Propose" },
  { href: "/portfolio", label: "Portfolio" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/activity", label: "Activity" },
  { href: "/watchlist", label: "Watchlist" },
];

function NotificationBell() {
  const { publicKey, signMessage } = useWallet();
  const [open, setOpen] = useState(false);

  const walletStr = publicKey?.toBase58() ?? null;

  const { data: notifications = [] } = useQuery({
    queryKey: keys.user.notifications(walletStr ?? "none"),
    queryFn: async () => {
      const auth = await signUserProof({ publicKey, signMessage }, signMessage);
      const headers: Record<string, string> = {};
      if (auth) {
        headers["x-wallet"] = auth.wallet;
        headers["x-message"] = auth.message;
        headers["x-signature"] = auth.signature;
      }
      const r = await userFetch(`/api/user/notifications?wallet=${walletStr}`, { headers });
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
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded hover:bg-ivory/5 transition-colors cursor-pointer edge-glow" aria-label="Notifications">
        <span className="block w-4 h-4" aria-hidden />
        <svg className="absolute inset-2 w-4 h-4 text-ash" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: [1, 1.18, 1] }}
            transition={{ repeat: Infinity, repeatDelay: 2.4, duration: 0.5 }}
            className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 bg-bordeaux text-ivory text-[8px] font-bold flex items-center justify-center rounded"
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="absolute right-0 top-full mt-2 w-80 surface z-50 overflow-hidden shadow-[0_24px_60px_-20px_rgba(0,0,0,.7)]"
          >
            <div className="p-3 border-b border-hairline flex items-center justify-between">
              <span className="label-lux">Notifications</span>
              <span className="text-[10px] text-ash-dim tnum">{notifications.length} total</span>
            </div>
            <div className="max-h-64 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-[10px] text-ash-dim font-mono">No notifications yet</div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div key={n.id} className={`px-3 py-2.5 border-b border-hairline last:border-0 ${!n.read ? "bg-gold/5 border-l-2 border-l-gold/60" : ""}`}>
                    <div className="text-[11px] text-ivory font-medium">{n.message}</div>
                    <div className="text-[9px] text-ash-dim font-mono mt-0.5">{new Date(n.createdAt).toLocaleString()}</div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}

export function Navigation() {
  const { role } = useUserRole();
  const pathname = usePathname();
  const { watchlist } = useAppState();
  const watchlistCount = watchlist.length;

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  return (
    <>
      {/* Desktop header — instrument rail, sticky */}
      <header className="seam-leaf sticky top-0 z-50 border-b border-hairline bg-void/85 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-[1240px] px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-9">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-7 h-7 flex items-center justify-center transition-transform duration-300 group-hover:rotate-[18deg] group-hover:scale-110">
                <Logo3D />
              </div>
              <span className="font-display font-bold text-[19px] tracking-[0.02em] text-ivory">
                SOL<span className="text-gold">PREDICT</span>
              </span>
            </Link>
            <nav className="hidden lg:flex items-center gap-7">
              {NAV_ITEMS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className={`relative font-mono text-[11px] uppercase tracking-[.14em] py-1.5 transition-colors duration-150 ease-[cubic-bezier(.22,.61,.36,1)] focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none ${
                    isActive(href) ? "text-ivory" : "text-ash hover:text-ivory"
                  }`}
                >
                  {label}
                  {href === "/watchlist" && watchlistCount > 0 && (
                    <span className="num ml-1 text-gold font-bold">{watchlistCount}</span>
                  )}
                  {isActive(href) && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute left-0 -bottom-[21px] h-[2px] w-full bg-gold"
                      style={{ boxShadow: "0 0 12px rgba(34,211,238,.55)" }}
                    />
                  )}
                </Link>
              ))}
              {role === "admin" && (
                <Link
                  href="/admin"
                  className={`relative flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[.14em] py-1.5 transition-colors duration-150 ${
                    isActive("/admin") ? "text-ivory" : "text-gold hover:text-gold-lite"
                  }`}
                >
                  <Settings className="w-3 h-3" />
                  Admin
                  {isActive("/admin") && (
                    <motion.span
                      layoutId="nav-active"
                      className="absolute left-0 -bottom-[21px] h-[2px] w-full bg-gold"
                      style={{ boxShadow: "0 0 12px rgba(34,211,238,.55)" }}
                    />
                  )}
                </Link>
              )}
              <Link
                href="/docs/help"
                className={`relative font-mono text-[11px] uppercase tracking-[.14em] py-1.5 transition-colors duration-150 ${
                  isActive("/docs/help") ? "text-ivory" : "text-ash hover:text-ivory"
                }`}
              >
                Help
                {isActive("/docs/help") && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute left-0 -bottom-[21px] h-[2px] w-full bg-gold"
                    style={{ boxShadow: "0 0 12px rgba(34,211,238,.55)" }}
                  />
                )}
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center gap-2 font-mono text-[10px] text-ash-dim uppercase tracking-[.14em] border border-hairline bg-obsidian/60 px-2.5 py-1.5 rounded-[2px]">
              <span className="live-dot" />
              Live on Solana
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
    </>
  );
}
