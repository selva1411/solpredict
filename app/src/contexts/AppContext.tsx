"use client";

import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { usePathname } from "next/navigation";
import { getWatchlist } from "@/lib/watchlist";
import { useOptimisticWatchlist } from "@/hooks/useOptimisticWatchlist";

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

async function syncWatchlist(key: string): Promise<boolean> {
  try {
    const wallet = typeof window !== "undefined" ? localStorage.getItem("solpredict-wallet") : null;
    const res = await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet, marketPubkey: key }),
    });
    const data = await res.json();
    if (data.ok) {
      const current = getWatchlist();
      const next = current.includes(key)
        ? current.filter(k => k !== key)
        : [...current, key];
      localStorage.setItem("solpredict-watchlist", JSON.stringify(next));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [initialKeys, setInitialKeys] = useState<string[]>([]);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    setInitialKeys(getWatchlist());
    const onStorage = () => setInitialKeys(getWatchlist());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const { watchlist, toggle } = useOptimisticWatchlist(initialKeys, syncWatchlist);

  const toggleWatchlistItem = useCallback((pubkey: string) => {
    toggle(pubkey);
  }, [toggle]);

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
