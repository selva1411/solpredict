"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Settings, LayoutGrid, Activity, CirclePlus, Briefcase, Trophy } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";
import { useWallet } from "@solana/wallet-adapter-react";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { role } = useUserRole();

  const tabs = [
    { href: "/markets", label: "Markets" },
    { href: "/activity", label: "Activity" },
    { href: "/create", label: "Create" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/leaderboard", label: "Leaderboard" },
    { href: "/watchlist", label: "Watchlist" },
  ];

  return (
    <div className="lg:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-[2px] border border-hairline bg-panel hover:bg-ivory/5 transition-colors duration-150 cursor-pointer focus-visible:ring-2 focus-visible:ring-gold focus-visible:ring-offset-2 focus-visible:ring-offset-void focus-visible:outline-none"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X className="w-5 h-5 text-ivory" /> : <Menu className="w-5 h-5 text-ivory" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div className="fixed inset-0 z-30 bg-void/60 backdrop-blur-sm" onClick={() => setIsOpen(false)} />
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 0.61, 0.36, 1] }}
              className="absolute top-16 left-0 right-0 z-40 overflow-hidden border-b border-hairline bg-obsidian"
            >
              <nav className="flex flex-col px-4 py-4 space-y-1">
                {tabs.map((tab, i) => (
                  <motion.div
                    key={tab.href}
                    initial={{ x: -14, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Link
                      href={tab.href}
                      onClick={() => setIsOpen(false)}
                      className="flex items-center justify-between px-4 py-3 font-mono text-[11px] uppercase tracking-[.14em] text-ash hover:text-ivory hover:bg-panel rounded-[2px] transition-colors duration-150"
                    >
                      {tab.label}
                      <span className="text-gold-deep">→</span>
                    </Link>
                  </motion.div>
                ))}
                {role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setIsOpen(false)}
                    className="flex items-center justify-between px-4 py-3 font-mono text-[11px] uppercase tracking-[.14em] text-gold hover:bg-gold/5 rounded-[2px] transition-colors duration-150"
                  >
                    <span className="flex items-center gap-2">
                      <Settings className="w-3 h-3" /> Admin
                    </span>
                    <span>→</span>
                  </Link>
                )}
              </nav>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

const BOTTOM_ICONS = {
  markets: LayoutGrid,
  activity: Activity,
  create: CirclePlus,
  portfolio: Briefcase,
} as const;

/**
 * The single mobile bottom rail (rendered once from the root layout).
 * Profile lives inside Portfolio — a wallet-scoped route (/profile/[wallet])
 * cannot be linked without knowing the key up front.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/markets", label: "Markets", icon: BOTTOM_ICONS.markets },
    { href: "/activity", label: "Tape", icon: BOTTOM_ICONS.activity },
    { href: "/create", label: "Propose", icon: BOTTOM_ICONS.create },
    { href: "/portfolio", label: "Holdings", icon: BOTTOM_ICONS.portfolio },
    { href: "/leaderboard", label: "Ranks", icon: Trophy },
  ];

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-void/92 backdrop-blur-xl border-t border-hairline pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 items-stretch h-16">
        {tabs.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`relative flex flex-col items-center justify-center gap-1 transition-colors duration-150 ${
              isActive(href) ? "text-ivory" : "text-ash-dim hover:text-ash"
            }`}
          >
            <Icon className="w-[18px] h-[18px]" strokeWidth={isActive(href) ? 2.2 : 1.7} />
            <span className="font-mono text-[8px] uppercase tracking-[.12em]">{label}</span>
            {isActive(href) && (
              <motion.span
                layoutId="mobile-nav-active"
                className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-[2px] bg-gold"
                style={{ boxShadow: "0 0 10px rgba(34,211,238,.7)" }}
              />
            )}
          </Link>
        ))}
      </div>
    </nav>
  );
}
