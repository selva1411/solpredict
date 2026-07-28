// Mock data for the PREDICT-X demo
// In production these would come from on-chain accounts + Postgres cache

export interface Market {
  id: string;
  question: string;
  description: string;
  category: "Crypto" | "Sports" | "Politics" | "Tech" | "Other";
  endDate: string; // ISO
  yesPool: number;  // in USDC
  noPool: number;   // in USDC
  yesPrice: number; // 0-1
  noPrice: number;  // 0-1
  volume24h: number;
  liquidity: number;
  traders: number;
  icon: string;     // emoji or short text
  sparkline: number[]; // last 24h yesPrice samples
  trending?: boolean;
  hot?: boolean;
}

export const MARKETS: Market[] = [
  {
    id: "sol-250-eod",
    question: "Will SOL close above $250 by end of week?",
    description: "Resolves YES if the SOL/USD price on Pyth Network is strictly greater than $250.00 at 17:00 UTC Friday. Resolution source: Pyth SOL/USD feed (feed_id: 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f97ed1a2fcbced12f1d4f8d8e0f).",
    category: "Crypto",
    endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 184320,
    noPool: 98240,
    yesPrice: 0.652,
    noPrice: 0.348,
    volume24h: 421000,
    liquidity: 282560,
    traders: 1284,
    icon: "◎",
    sparkline: [0.48, 0.50, 0.52, 0.55, 0.58, 0.60, 0.59, 0.62, 0.64, 0.65, 0.63, 0.65, 0.66, 0.65],
    trending: true,
    hot: true,
  },
  {
    id: "btc-100k-2025",
    question: "Will Bitcoin reach $100,000 before 2026?",
    description: "Resolves YES if BTC/USD price on Pyth reaches $100,000.00 at any point before January 1, 2026 00:00 UTC. Resolution source: Pyth BTC/USD feed.",
    category: "Crypto",
    endDate: new Date(Date.now() + 161 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 412800,
    noPool: 287200,
    yesPrice: 0.589,
    noPrice: 0.411,
    volume24h: 892000,
    liquidity: 700000,
    traders: 4892,
    icon: "₿",
    sparkline: [0.55, 0.56, 0.57, 0.58, 0.59, 0.58, 0.57, 0.58, 0.59, 0.60, 0.59, 0.58, 0.59, 0.59],
    trending: true,
    hot: true,
  },
  {
    id: "eth-merge-2",
    question: "Will Ethereum flip Bitcoin by market cap in 2025?",
    description: "Resolves YES if ETH market cap exceeds BTC market cap at any point during 2025. Data from CoinGecko.",
    category: "Crypto",
    endDate: new Date(Date.now() + 89 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 78400,
    noPool: 245600,
    yesPrice: 0.242,
    noPrice: 0.758,
    volume24h: 124000,
    liquidity: 324000,
    traders: 842,
    icon: "Ξ",
    sparkline: [0.22, 0.23, 0.22, 0.24, 0.25, 0.24, 0.23, 0.24, 0.25, 0.24, 0.23, 0.24, 0.24, 0.24],
    trending: false,
    hot: false,
  },
  {
    id: "us-election-2028",
    question: "Will a Democrat win the 2028 US Presidential election?",
    description: "Resolves YES if the Democratic nominee wins the 2028 US presidential election. Resolution per official election results certified by Congress.",
    category: "Politics",
    endDate: new Date(Date.now() + 412 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 198400,
    noPool: 198400,
    yesPrice: 0.50,
    noPrice: 0.50,
    volume24h: 312000,
    liquidity: 396800,
    traders: 2941,
    icon: "🗳",
    sparkline: [0.52, 0.51, 0.50, 0.49, 0.50, 0.51, 0.50, 0.49, 0.50, 0.51, 0.50, 0.50, 0.50, 0.50],
    trending: false,
    hot: false,
  },
  {
    id: "fed-rate-cut",
    question: "Will the Fed cut rates at the next FOMC meeting?",
    description: "Resolves YES if the Federal Open Market Committee votes to lower the federal funds rate at the next scheduled meeting. Per official FOMC statement.",
    category: "Politics",
    endDate: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 312000,
    noPool: 98000,
    yesPrice: 0.761,
    noPrice: 0.239,
    volume24h: 245000,
    liquidity: 410000,
    traders: 1820,
    icon: "🏦",
    sparkline: [0.70, 0.71, 0.72, 0.73, 0.74, 0.75, 0.74, 0.75, 0.76, 0.77, 0.76, 0.75, 0.76, 0.76],
    trending: true,
    hot: true,
  },
  {
    id: "gpt6-release",
    question: "Will OpenAI release GPT-6 before July 2026?",
    description: "Resolves YES if OpenAI officially announces the public release of GPT-6 before July 1, 2026. Must be a public model release, not a research preview.",
    category: "Tech",
    endDate: new Date(Date.now() + 312 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 124800,
    noPool: 187200,
    yesPrice: 0.40,
    noPrice: 0.60,
    volume24h: 88000,
    liquidity: 312000,
    traders: 1102,
    icon: "🤖",
    sparkline: [0.38, 0.39, 0.40, 0.41, 0.40, 0.39, 0.40, 0.41, 0.40, 0.39, 0.40, 0.41, 0.40, 0.40],
    trending: false,
    hot: false,
  },
  {
    id: "super-bowl-winner",
    question: "Will the Chiefs win Super Bowl LX?",
    description: "Resolves YES if the Kansas City Chiefs win Super Bowl LX (February 2026). Per official NFL results.",
    category: "Sports",
    endDate: new Date(Date.now() + 215 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 89000,
    noPool: 267000,
    yesPrice: 0.25,
    noPrice: 0.75,
    volume24h: 156000,
    liquidity: 356000,
    traders: 2204,
    icon: "🏈",
    sparkline: [0.23, 0.24, 0.25, 0.26, 0.25, 0.24, 0.25, 0.26, 0.25, 0.24, 0.25, 0.25, 0.25, 0.25],
    trending: false,
    hot: false,
  },
  {
    id: "apple-vision-2",
    question: "Will Apple ship Vision Pro 2 in 2026?",
    description: "Resolves YES if Apple officially releases a successor to Vision Pro with public availability before Dec 31, 2026.",
    category: "Tech",
    endDate: new Date(Date.now() + 421 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 68000,
    noPool: 102000,
    yesPrice: 0.40,
    noPrice: 0.60,
    volume24h: 42000,
    liquidity: 170000,
    traders: 580,
    icon: "🥽",
    sparkline: [0.42, 0.41, 0.40, 0.39, 0.40, 0.41, 0.40, 0.39, 0.40, 0.41, 0.40, 0.40, 0.40, 0.40],
    trending: false,
    hot: false,
  },
  {
    id: "sol-etf-approve",
    question: "Will a SOL spot ETF be approved in the US by end of 2025?",
    description: "Resolves YES if the SEC approves a Solana spot ETF before Dec 31, 2025. Per SEC filing decisions.",
    category: "Crypto",
    endDate: new Date(Date.now() + 142 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 156400,
    noPool: 117600,
    yesPrice: 0.571,
    noPrice: 0.429,
    volume24h: 198000,
    liquidity: 274000,
    traders: 1648,
    icon: "◎",
    sparkline: [0.52, 0.53, 0.54, 0.55, 0.56, 0.57, 0.58, 0.57, 0.56, 0.57, 0.58, 0.57, 0.57, 0.57],
    trending: true,
    hot: false,
  },
  {
    id: "world-cup-2026",
    question: "Will Brazil win the 2026 FIFA World Cup?",
    description: "Resolves YES if Brazil wins the 2026 FIFA World Cup. Per official FIFA results.",
    category: "Sports",
    endDate: new Date(Date.now() + 320 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 42000,
    noPool: 378000,
    yesPrice: 0.10,
    noPrice: 0.90,
    volume24h: 64000,
    liquidity: 420000,
    traders: 1124,
    icon: "⚽",
    sparkline: [0.11, 0.10, 0.09, 0.10, 0.11, 0.10, 0.10, 0.09, 0.10, 0.11, 0.10, 0.10, 0.10, 0.10],
    trending: false,
    hot: false,
  },
  {
    id: "nvidia-1t",
    question: "Will Nvidia reach $1T quarterly revenue by 2027?",
    description: "Resolves YES if Nvidia reports quarterly revenue >= $100 billion in any earnings report before Jan 1, 2027.",
    category: "Tech",
    endDate: new Date(Date.now() + 540 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 96000,
    noPool: 224000,
    yesPrice: 0.30,
    noPrice: 0.70,
    volume24h: 78000,
    liquidity: 320000,
    traders: 928,
    icon: "💰",
    sparkline: [0.28, 0.29, 0.30, 0.31, 0.30, 0.29, 0.30, 0.31, 0.30, 0.29, 0.30, 0.30, 0.30, 0.30],
    trending: false,
    hot: false,
  },
  {
    id: "ai-passes-turing",
    question: "Will an AI definitively pass the Turing Test in 2026?",
    description: "Resolves YES if a widely-recognized, peer-reviewed study demonstrates an AI passing a rigorous Turing Test with human judges in 2026.",
    category: "Tech",
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    yesPool: 58000,
    noPool: 162000,
    yesPrice: 0.263,
    noPrice: 0.737,
    volume24h: 32000,
    liquidity: 220000,
    traders: 412,
    icon: "🧠",
    sparkline: [0.24, 0.25, 0.26, 0.27, 0.26, 0.25, 0.26, 0.27, 0.26, 0.25, 0.26, 0.27, 0.26, 0.26],
    trending: false,
    hot: false,
  },
];

export const LEADERBOARD = [
  { rank: 1, username: "QuantumKing", wallet: "7xKw...Bt2P", volume: 2840000, profit: 412000, winRate: 0.68, marketsTraded: 142, avatar: "Q" },
  { rank: 2, username: "AlphaOracle", wallet: "9mNv...Lp8R", volume: 1980000, profit: 287000, winRate: 0.64, marketsTraded: 98, avatar: "A" },
  { rank: 3, username: "SatoshiBear", wallet: "4kLm...Xy1W", volume: 1450000, profit: 198000, winRate: 0.61, marketsTraded: 87, avatar: "S" },
  { rank: 4, username: "PythPriestess", wallet: "2zPR...M4nT", volume: 1240000, profit: 156000, winRate: 0.59, marketsTraded: 76, avatar: "P" },
  { rank: 5, username: "DiamondHands", wallet: "8Y6s...Q2vF", volume: 980000, profit: 124000, winRate: 0.57, marketsTraded: 64, avatar: "D" },
  { rank: 6, username: "MEV_Maven", wallet: "5tGh...K9rL", volume: 870000, profit: 98000, winRate: 0.55, marketsTraded: 58, avatar: "M" },
  { rank: 7, username: "LimitOrderLarry", wallet: "3bCd...V7tN", volume: 760000, profit: 84000, winRate: 0.54, marketsTraded: 51, avatar: "L" },
  { rank: 8, username: "CLOBQueen", wallet: "1fHj...W3sQ", volume: 690000, profit: 72000, winRate: 0.52, marketsTraded: 47, avatar: "C" },
];

export const ACTIVITY = [
  { type: "buy", user: "QuantumKing", market: "Will SOL close above $250?", side: "YES", amount: 5000, ts: "2s ago" },
  { type: "sell", user: "AlphaOracle", market: "Will BTC reach $100,000?", side: "NO", amount: 3200, ts: "8s ago" },
  { type: "buy", user: "DiamondHands", market: "Will the Fed cut rates?", side: "YES", amount: 8400, ts: "15s ago" },
  { type: "settle", user: "—", market: "Will ETH flip BTC?", side: "NO", amount: 245000, ts: "1m ago" },
  { type: "buy", user: "PythPriestess", market: "Will a SOL ETF be approved?", side: "YES", amount: 2200, ts: "2m ago" },
  { type: "buy", user: "MEV_Maven", market: "Will Bitcoin reach $100,000?", side: "YES", amount: 1500, ts: "3m ago" },
  { type: "sell", user: "LimitOrderLarry", market: "Will the Chiefs win Super Bowl LX?", side: "NO", amount: 980, ts: "4m ago" },
  { type: "buy", user: "CLOBQueen", market: "Will GPT-6 release before July?", side: "YES", amount: 1800, ts: "5m ago" },
  { type: "buy", user: "SatoshiBear", market: "Will SOL close above $250?", side: "NO", amount: 4200, ts: "7m ago" },
  { type: "create", user: "QuantumKing", market: "New market: Will SOL hit $300?", side: "—", amount: 0, ts: "9m ago" },
];

// Generate order book from market
export function generateOrderBook(yesPrice: number) {
  const bids: { price: number; size: number; total: number }[] = [];
  const asks: { price: number; size: number; total: number }[] = [];
  let bidTotal = 0, askTotal = 0;
  for (let i = 0; i < 12; i++) {
    const bidPrice = Math.max(0.01, yesPrice - 0.005 - i * 0.008);
    const askPrice = Math.min(0.99, yesPrice + 0.005 + i * 0.008);
    const bidSize = Math.round(50 + Math.random() * 500);
    const askSize = Math.round(50 + Math.random() * 500);
    bidTotal += bidSize;
    askTotal += askSize;
    bids.push({ price: bidPrice, size: bidSize, total: bidTotal });
    asks.push({ price: askPrice, size: askSize, total: askTotal });
  }
  return { bids, asks: asks.reverse() };
}

// Generate price history for chart
export function generatePriceHistory(currentPrice: number, points = 60) {
  const data: { time: number; price: number; volume: number }[] = [];
  let price = currentPrice;
  const now = Date.now();
  for (let i = points; i >= 0; i--) {
    const drift = (Math.random() - 0.5) * 0.04;
    price = Math.max(0.05, Math.min(0.95, price + drift));
    const volume = 10000 + Math.random() * 50000;
    data.push({ time: now - i * 60 * 60 * 1000, price, volume });
  }
  // Force the last point to currentPrice
  data[data.length - 1].price = currentPrice;
  return data;
}
