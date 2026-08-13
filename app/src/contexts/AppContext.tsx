"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { fetchWatchlistFromDb, getWatchlist, toggleWatchlist } from "@/lib/watchlist";

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
    let cancelled = false;
    fetchWatchlistFromDb(walletPubkey)
      .then((keys) => {
        if (!cancelled) setWatchlist(keys);
      })
      .catch((err) => {
        if (!cancelled) setWatchlist(getWatchlist());
        console.warn("[AppContext] failed to load watchlist from DB", err);
      });
    return () => { cancelled = true; };
  }, [walletPubkey]);

  const toggleWatchlistItem = useCallback((pubkey: string) => {
    const wallet = walletPubkey ?? localStorage.getItem("solpredict-wallet") ?? undefined;
    const next = toggleWatchlist(pubkey, wallet);
    setWatchlist(next);
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
