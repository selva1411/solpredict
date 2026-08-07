"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, TrendingUp, Activity, PlusCircle, Wallet, User, Settings, Shield } from "lucide-react";
import { useUserRole } from "@/hooks/useUserRole";

export function MobileNav() {
  const [isOpen, setIsOpen] = useState(false);
  const { role } = useUserRole();

  const tabs = [
    { href: "/markets", icon: TrendingUp, label: "Markets" },
    { href: "/activity", icon: Activity, label: "Activity" },
    { href: "/create", icon: PlusCircle, label: "Create" },
    { href: "/portfolio", icon: Wallet, label: "Portfolio" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  return (
    <div className="md:hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-2 rounded bg-[#1A1C22] border border-white/10 hover:bg-[#15171E] transition-colors cursor-pointer"
        aria-label={isOpen ? "Close menu" : "Open menu"}
      >
        {isOpen ? <X className="w-5 h-5 text-[#F4F4F9]" /> : <Menu className="w-5 h-5 text-[#F4F4F9]" />}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="absolute top-16 left-0 right-0 z-40 overflow-hidden border-b border-white/10 bg-[#1A1C22]/95 backdrop-blur-xl"
          >
            <nav className="flex flex-col px-4 py-4 space-y-1">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <Link
                    key={tab.href}
                    href={tab.href}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#808495] hover:text-[#F4F4F9] hover:bg-white/5 rounded-lg transition-colors"
                  >
                    <Icon className="w-5 h-5" />
                    {tab.label}
                  </Link>
                );
              })}
              {role === "admin" && (
                <Link
                  href="/admin"
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm font-medium text-[#FFA500] hover:bg-[#FFA500]/10 rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5" />
                  Admin
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
    { href: "/markets", icon: TrendingUp, label: "Markets" },
    { href: "/activity", icon: Activity, label: "Activity" },
    { href: "/create", icon: PlusCircle, label: "Create" },
    { href: "/portfolio", icon: Wallet, label: "Portfolio" },
    { href: "/profile", icon: User, label: "Profile" },
  ];

  const allTabs = role === "admin"
    ? [...tabs, { href: "/admin", icon: Shield, label: "Admin" }]
    : tabs;

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#1A1C22]/90 backdrop-blur-xl border-t border-white/10">
      <div className="flex items-center justify-around py-2">
        {allTabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="flex flex-col items-center gap-0.5 px-3 py-1 text-[10px] font-medium text-[#808495] hover:text-[#FFA500] transition-colors"
            >
              <Icon className="w-5 h-5" />
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
