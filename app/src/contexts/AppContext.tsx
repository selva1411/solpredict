"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { getWatchlist } from "@/lib/watchlist";

interface AppState {
  mobileMenuOpen: boolean;
  setMobileMenuOpen: (open: boolean) => void;
  watchlist: string[];
  toggleWatchlistItem: (pubkey: string) => void;
  isWatched: (pubkey: string) => boolean;
  sidebarCollapsed: boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { publicKey } = useWallet();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [watchlist, setWatchlist] = useState<string[]>([]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const walletPubkey = publicKey?.toBase58() ?? null;

  // Persist the connected wallet so reads elsewhere stay consistent.
  useEffect(() => {
    if (walletPubkey) {
      localStorage.setItem("solpredict-wallet", walletPubkey);
    }
  }, [walletPubkey]);

  // Initialize from localStorage and react to cross-tab changes.
  useEffect(() => {
    setWatchlist(getWatchlist());
    const onStorage = () => setWatchlist(getWatchlist());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Load the wallet's watchlist from the DB whenever the wallet changes.
  useEffect(() => {
    if (!walletPubkey) return;
    fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/watchlist?wallet=${walletPubkey}`)
      .then(r => r.json().catch(() => null))
      .then((data) => {
        if (data && data.ok && Array.isArray(data.keys)) {
          localStorage.setItem("solpredict-watchlist", JSON.stringify(data.keys));
          setWatchlist(data.keys);
        }
      })
      .catch(() => {});
  }, [walletPubkey]);

  const toggleWatchlistItem = useCallback((pubkey: string) => {
    const current = getWatchlist();
    const next = current.includes(pubkey)
      ? current.filter(k => k !== pubkey)
      : [...current, pubkey];
    localStorage.setItem("solpredict-watchlist", JSON.stringify(next));
    setWatchlist(next);

    // Sync directly with NeonDB in the background.
    const wallet = walletPubkey ?? localStorage.getItem("solpredict-wallet");
    if (wallet) {
      fetch("/api/watchlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet, marketPubkey: pubkey }),
      }).catch(() => {});
    }
  }, [walletPubkey]);

  const isWatched = useCallback((pubkey: string) => {
    return watchlist.includes(pubkey);
  }, [watchlist]);

  return (
    <AppContext.Provider value={{
      mobileMenuOpen,
      setMobileMenuOpen,
      watchlist,
      toggleWatchlistItem,
      isWatched,
      sidebarCollapsed,
      setSidebarCollapsed,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppState(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useAppState must be used within AppProvider");
  return ctx;
}
