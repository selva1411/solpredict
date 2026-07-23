import BN from "bn.js";

// ─── SOL FORMATTING ──────────────────────────────────────────

/** Convert BN lamports → human SOL string. e.g. BN(1000000000) → "1.000" */
export function formatSol(lamports: BN | number | null | undefined, decimals = 3): string {
  if (lamports == null) return "0.000";
  const n = lamports instanceof BN ? lamports.toNumber() : lamports;
  return (n / 1_000_000_000).toFixed(decimals);
}

/** Convert BN lamports → number (SOL). Safe for math. */
export function lamportsToSol(lamports: BN | number | null | undefined): number {
  if (lamports == null) return 0;
  const n = lamports instanceof BN ? lamports.toNumber() : lamports;
  return n / 1_000_000_000;
}

export function bnToSol(lamports: BN | number | null | undefined): number {
  return lamportsToSol(lamports);
}

/** Convert BN → plain JS number */
export function bnToNum(value: BN | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (BN.isBN(value)) return value.toNumber();
  return Number(value);
}

/** Format large numbers with commas: 1234567 → "1,234,567" */
export function formatNumber(n: BN | number | null | undefined): string {
  return bnToNum(n).toLocaleString("en-US");
}

/** Converts display SOL amount (e.g. 1.5) to lamports BN */
export function solToLamports(solAmount: string | number): BN {
  const num = typeof solAmount === "string" ? parseFloat(solAmount) : solAmount;
  return new BN(Math.floor(num * 1_000_000_000));
}

/** Shortens a base58 address for display */
export function shortAddr(addr: string): string {
  if (!addr) return "";
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

// ─── PROBABILITY ─────────────────────────────────────────────

/**
 * Calculate YES percentage from pool sizes
 * Returns 50 if both pools empty (fair start)
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

/** Returns NO percentage */
export function calcNoPct(yesPool: BN | number | null | undefined, noPool: BN | number | null | undefined): number {
  return 100 - calcYesPct(yesPool, noPool);
}

// ─── TIMESTAMPS ──────────────────────────────────────────────

/** BN unix timestamp → readable string "Jul 23, 2026 14:30" */
export function formatTs(ts: BN | number | null | undefined): string {
  const t = bnToNum(ts);
  if (t === 0) return "—";
  return new Date(t * 1000).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Returns time remaining until unix timestamp */
export function timeUntil(ts: BN | number | null | undefined): string {
  const target = bnToNum(ts) * 1000;
  if (!target) return "—";
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) return "Ended";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  return `${mins}m`;
}

export function formatTimeLeft(endTs: BN | number | null | undefined): string {
  return timeUntil(endTs);
}

/** Is timestamp in the future? */
export function isActive(ts: BN | number | null | undefined): boolean {
  return bnToNum(ts) * 1000 > Date.now();
}

// ─── MARKET HELPERS ───────────────────────────────────────────

/** Get category name from category number */
export function categoryName(cat: number): string {
  return ["Crypto", "Sports", "Politics", "Tech", "Other"][cat] ?? "Other";
}

/** Get CSS color variable for category */
export function categoryColor(cat: number): string {
  return [
    "var(--color-crypto)",
    "var(--color-sports)",
    "var(--color-politics)",
    "var(--color-tech)",
    "var(--color-other)",
  ][cat] ?? "var(--color-other)";
}

/** Status label from number */
export function statusLabel(status: number): string {
  return ["Open", "Settled", "Cancelled"][status] ?? "Unknown";
}

/** Winning outcome label */
export function outcomeLabel(outcome: number): string {
  return ["—", "YES ✓", "NO ✓"][outcome] ?? "—";
}

// ─── PAYOUT CALCULATOR ────────────────────────────────────────

/**
 * Calculates expected payout for a buy
 */
export function calcExpectedPayout(
  lamportsToBet: number,
  sharePrice: number,
  userWouldBet: "yes" | "no",
  currentYesPool: number,
  currentNoPool: number,
  feeBps: number
): {
  tokens: number;
  yesPct: number;
  noPct: number;
  estimatedPayout: number;
  roi: number;
} {
  const tokens = Math.floor(lamportsToBet / (sharePrice || 10_000_000));

  const newYesPool =
    userWouldBet === "yes"
      ? currentYesPool + lamportsToBet
      : currentYesPool;
  const newNoPool =
    userWouldBet === "no"
      ? currentNoPool + lamportsToBet
      : currentNoPool;

  const total = newYesPool + newNoPool;
  const yesPct = total === 0 ? 50 : Math.round((newYesPool / total) * 100);
  const noPct = 100 - yesPct;

  const losingPool =
    userWouldBet === "yes" ? newNoPool : newYesPool;
  const fee = Math.floor((losingPool * feeBps) / 10_000);
  const totalPayout = total - fee;
  const winningSupply =
    userWouldBet === "yes"
      ? Math.floor(newYesPool / (sharePrice || 10_000_000))
      : Math.floor(newNoPool / (sharePrice || 10_000_000));

  const userTokensAfter = tokens;
  const estimatedPayout =
    winningSupply === 0
      ? 0
      : Math.floor((userTokensAfter / winningSupply) * totalPayout);

  const roi =
    lamportsToBet === 0
      ? 0
      : ((estimatedPayout - lamportsToBet) / lamportsToBet) * 100;

  return { tokens, yesPct, noPct, estimatedPayout, roi };
}
