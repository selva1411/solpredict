import BN from "bn.js";

/**
 * Safely converts a BN (Big Number) to a JavaScript number.
 * BN objects come from Anchor for all u64 values.
 */
export function bnToNum(bn: BN | number | null | undefined): number {
  if (bn === null || bn === undefined) return 0;
  if (typeof bn === "number") return bn;
  if (BN.isBN(bn)) return bn.toNumber();
  return Number(bn);
}

export function lamportsToSol(bn: BN | number | null | undefined): number {
  return bnToNum(bn) / 1_000_000_000;
}

/**
 * Converts lamports (BN or number) to a formatted SOL string.
 * Example: 1_500_000_000 → "1.50 SOL"
 */
export function formatSol(lamports: BN | number | null | undefined, decimals = 4): string {
  return lamportsToSol(lamports).toFixed(decimals) + " SOL";
}

/**
 * Calculates YES percentage from market account data.
 * Returns a number 0-100.
 * Example: yes=2 SOL, no=1 SOL → 67
 */
export function calcYesPct(
  yesPool: BN | number | null | undefined,
  noPool: BN | number | null | undefined
): number {
  const yes = bnToNum(yesPool);
  const no = bnToNum(noPool);
  const total = yes + no;
  if (total === 0) return 50;
  return Math.round((yes / total) * 100);
}

/**
 * Formats a Unix timestamp (BN or number) to a human-readable date string.
 * Example: 1753920000 → "Jul 31, 2026"
 */
export function formatTs(ts: BN | number | null | undefined): string {
  const num = bnToNum(ts);
  if (!num) return "—";
  return new Date(num * 1000).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/**
 * Formats a Unix timestamp to a relative time string.
 * Example: "3 days left" or "Expired"
 */
export function formatTimeLeft(endTs: BN | number | null | undefined): string {
  const endNum = bnToNum(endTs);
  if (!endNum) return "—";
  const now = Math.floor(Date.now() / 1000);
  const diff = endNum - now;
  if (diff <= 0) return "Expired";
  const days = Math.floor(diff / 86400);
  const hours = Math.floor((diff % 86400) / 3600);
  const minutes = Math.floor((diff % 3600) / 60);
  if (days > 0) return `${days}d ${hours}h left`;
  if (hours > 0) return `${hours}h ${minutes}m left`;
  return `${minutes}m left`;
}

/**
 * Converts a display amount (e.g. "1.5") to lamports as a BN.
 * Example: "1.5" → BN(1_500_000_000)
 */
export function solToLamports(solAmount: string | number): BN {
  const num = typeof solAmount === "string" ? parseFloat(solAmount) : solAmount;
  return new BN(Math.floor(num * 1_000_000_000));
}

/**
 * Formats large numbers with commas.
 * Example: 1500000 → "1,500,000"
 */
export function formatNumber(n: BN | number | null | undefined): string {
  return bnToNum(n).toLocaleString("en-IN");
}

/**
 * Shortens a base58 address for display.
 * Example: "AbCdEfGhIjKlMnOpQrStUvWxYz1234567890" → "AbCd...7890"
 */
export function shortAddr(addr: string): string {
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}
