import { revalidateTag as nextRevalidateTag } from "next/cache";

const REVALIDATE_TAGS = ["markets", "trending", "leaderboard", "platform-stats", "admin-dashboard"] as const;
export type CacheTag = (typeof REVALIDATE_TAGS)[number];

let lastRevalidate: Record<string, number> = {};

export function revalidateTag(tag: CacheTag, throttleMs = 1000): void {
  const now = Date.now();
  if (lastRevalidate[tag] && now - lastRevalidate[tag] < throttleMs) return;
  lastRevalidate[tag] = now;
  try {
    nextRevalidateTag(tag, {});
  } catch {
    // not in a request context (e.g. worker) — safe to ignore
  }
}

export { REVALIDATE_TAGS };
