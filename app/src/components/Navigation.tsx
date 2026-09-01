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
      <button onClick={() => setOpen(!open)} className="relative p-2 rounded-lg hover:bg-panel-2 transition-colors cursor-pointer" aria-label="Notifications">
        <svg className="w-4 h-4 text-ash" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.7 21a2 2 0 0 1-3.4 0" />
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-0.5 bg-bordeaux text-white text-[8px] font-bold flex items-center justify-center rounded">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-2 w-80 surface z-50 overflow-hidden"
          >
            <div className="p-3 border-b border-hairline flex items-center justify-between">
              <span className="label-lux">Notifications</span>
              <span className="text-[10px] text-ash-dim">{notifications.length} total</span>
            </div>
            <div className="max-h-64 overflow-y-auto scrollbar-thin">
              {notifications.length === 0 ? (
                <div className="p-6 text-center text-[11px] text-ash-dim">No notifications yet</div>
              ) : (
                notifications.slice(0, 20).map((n) => (
                  <div key={n.id} className={`px-3 py-2.5 border-b border-hairline last:border-0 ${!n.read ? "bg-gold/5 border-l-2 border-l-gold" : ""}`}>
                    <div className="text-[12px] text-ivory">{n.message}</div>
                    <div className="text-[10px] text-ash-dim mt-0.5">{new Date(n.createdAt).toLocaleString()}</div>
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
    <header className="fixed top-0 inset-x-0 z-50 bg-void/95 backdrop-blur-sm border-b border-hairline">
      <div className="mx-auto max-w-[1240px] flex items-center justify-between h-14 px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-panel border border-hairline transition-colors group-hover:border-gold">
              <Logo3D />
            </div>
            <span className="font-display font-bold text-[16px] tracking-tight text-ivory">
              SOL<span className="text-gold-lite">PREDICT</span>
            </span>
          </Link>
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors ${
                  isActive(href)
                    ? "text-ivory bg-panel-2"
                    : "text-ash hover:text-ivory hover:bg-panel"
                }`}
              >
                {label}
                {href === "/watchlist" && watchlistCount > 0 && (
                  <span className="ml-1 text-gold text-[10px]">{watchlistCount}</span>
                )}
              </Link>
            ))}
            {role === "admin" && (
              <Link
                href="/admin"
                className={`px-3 py-1.5 rounded text-[12px] font-medium transition-colors flex items-center gap-1 ${
                  isActive("/admin")
                    ? "text-ivory bg-panel-2"
                    : "text-gold hover:text-gold-lite hover:bg-panel"
                }`}
              >
                <Settings className="w-3 h-3" />
                Admin
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <NotificationBell />
          <AirdropSolButton />
          <ClientWalletButton />
          <MobileNav />
        </div>
      </div>
    </header>
  );
}
