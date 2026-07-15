export function getWatchlist(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const saved = localStorage.getItem("solpredict-watchlist");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
}

export function toggleWatchlist(key: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const current = getWatchlist();
    const set = new Set(current);
    if (set.has(key)) {
      set.delete(key);
    } else {
      set.add(key);
    }
    const next = Array.from(set);
    localStorage.setItem("solpredict-watchlist", JSON.stringify(next));
    return next;
  } catch {
    return [];
  }
}

export function isWatchlisted(key: string): boolean {
  return getWatchlist().includes(key);
}
