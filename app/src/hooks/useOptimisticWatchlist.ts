"use client";

import { useOptimistic, useTransition, useCallback } from "react";

interface WatchlistState {
  keys: string[];
  pendingKey: string | null;
}

export function useOptimisticWatchlist(
  initialKeys: string[],
  syncFn: (key: string) => Promise<boolean>,
) {
  const [, startTransition] = useTransition();

  const [optimistic, setOptimistic] = useOptimistic<WatchlistState, string>(
    { keys: initialKeys, pendingKey: null },
    (state, key) => {
      const exists = state.keys.includes(key);
      return {
        keys: exists ? state.keys.filter(k => k !== key) : [...state.keys, key],
        pendingKey: key,
      };
    },
  );

  const toggle = useCallback((key: string) => {
    startTransition(async () => {
      setOptimistic(key);
      await syncFn(key);
    });
  }, [setOptimistic, syncFn]);

  return {
    watchlist: optimistic.keys,
    pendingKey: optimistic.pendingKey,
    toggle,
  };
}
