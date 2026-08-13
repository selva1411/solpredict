"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Settings } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { role } = useUserRole();

  const tabs = [
    { href: "/markets", label: "Markets" },
    { href: "/activity", label: "Activity" },
    { href: "/create", label: "Create" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/leaderboard", label: "Leaderboard" },
  ];

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded-[2px] border border-hairline bg-panel hover:bg-ivory/5 transition-colors cursor-pointer"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X className="w-5 h-5 text-ivory" /> : <Menu className="w-5 h-5 text-ivory" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="absolute top-16 left-0 right-0 z-40 overflow-hidden border-b border-hairline bg-void"
          >
            <nav className="flex flex-col px-4 py-4 space-y-1">
              {tabs.map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-4 py-3 font-mono text-[11px] uppercase tracking-[.16em] text-ash hover:text-ivory hover:bg-panel transition-colors"
                >
                  {tab.label}
                </Link>
              ))}
              {role === "admin" && (
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center justify-between px-4 py-3 font-mono text-[11px] uppercase tracking-[.16em] text-gold hover:bg-gold/5 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Settings className="w-3 h-3" /> Admin
                  </span>
                </Link>
              )}
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function MobileBottomNav() {
  const { role } = useUserRole();
  const tabs = [
    { href: "/markets", label: "Markets" },
    { href: "/activity", label: "Activity" },
    { href: "/create", label: "Create" },
    { href: "/portfolio", label: "Portfolio" },
    { href: "/profile", label: "Profile" },
  ];

  const allTabs = role === "admin"
    ? [...tabs, { href: "/admin", label: "Admin" }]
    : tabs;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-void border-t border-hairline">
      <div className="flex items-center justify-around py-2.5">
        {allTabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className="flex flex-col items-center gap-1 px-3 font-mono text-[9px] uppercase tracking-[.14em] text-ash hover:text-gold-lite transition-colors"
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
