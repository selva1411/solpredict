import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";
import { getDb } from "../app/src/lib/db/client";
import { marketsCache, marketOutcomes, trades, positions, userStats } from "../app/src/lib/db/schema";
import { probabilityYesBps, DEFAULT_B } from "../app/src/lib/amm/lmsr";
import { recomputeUserStats } from "../app/src/lib/indexer/user-stats";
import { eq } from "drizzle-orm";

const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";

// 12 deterministic test markets across categories
const TEST_MARKETS = [
  {
    marketPubkey: "SOLPRED111111111111111111111111111111111111",
    marketId: 1,
    question: "Will Bitcoin reach $120,000 before Q4 2026?",
    description: "Settles YES if Pyth BTC/USD feed exceeds $120,000 on or before October 1, 2026.",
    category: "Crypto",
    status: "open",
    yesSupply: 150_000_000_000,
    noSupply: 50_000_000_000,
    totalVolume: "145.5",
    viewCount: 1420,
    endTs: new Date(Date.now() + 86400 * 60 * 1000),
  },
  {
    marketPubkey: "SOLPRED222222222222222222222222222222222222",
    marketId: 2,
    question: "Will Solana TPS surpass 100k on Firedancer mainnet release?",
    description: "Settles YES if verified Firedancer benchmark exceeds 100,000 non-vote TPS.",
    category: "Tech",
    status: "open",
    yesSupply: 200_000_000_000,
    noSupply: 40_000_000_000,
    totalVolume: "310.2",
    viewCount: 2890,
    endTs: new Date(Date.now() + 86400 * 30 * 1000),
  },
  {
    marketPubkey: "SOLPRED333333333333333333333333333333333333",
    marketId: 3,
    question: "US Fed Rate Cut > 50bps at next FOMC meeting?",
    description: "Settles YES if the Federal Reserve cuts benchmark interest rate by strictly more than 50 basis points.",
    category: "Politics",
    status: "open",
    yesSupply: 60_000_000_000,
    noSupply: 120_000_000_000,
    totalVolume: "95.0",
    viewCount: 850,
    endTs: new Date(Date.now() + 3600 * 1000 * 45), // closes in under an hour
  },
  {
    marketPubkey: "SOLPRED444444444444444444444444444444444444",
    marketId: 4,
    question: "Will Real Madrid win the Champions League 2026?",
    description: "Settles YES if Real Madrid CF wins the final match.",
    category: "Sports",
    status: "open",
    yesSupply: 80_000_000_000,
    noSupply: 80_000_000_000,
    totalVolume: "78.4",
    viewCount: 620,
    endTs: new Date(Date.now() + 86400 * 90 * 1000),
  },
  {
    marketPubkey: "SOLPRED555555555555555555555555555555555555",
    marketId: 5,
    question: "Will Apple announce AI-native glasses in 2026?",
    description: "Settles YES if Apple Inc officially reveals a standalone smart glasses hardware product.",
    category: "Tech",
    status: "open",
    yesSupply: 40_000_000_000,
    noSupply: 160_000_000_000,
    totalVolume: "52.1",
    viewCount: 1100,
    endTs: new Date(Date.now() + 86400 * 120 * 1000),
  },
  {
    marketPubkey: "SOLPRED666666666666666666666666666666666666",
    marketId: 6,
    question: "Will ETH/BTC ratio drop below 0.035 in 2026?",
    description: "Settles YES if Binance ETH/BTC spot pair drops to 0.03499 or below.",
    category: "Crypto",
    status: "open",
    yesSupply: 110_000_000_000,
    noSupply: 90_000_000_000,
    totalVolume: "188.0",
    viewCount: 1750,
    endTs: new Date(Date.now() + 86400 * 45 * 1000),
  },
  {
    marketPubkey: "SOLPRED777777777777777777777777777777777777",
    marketId: 7,
    question: "Settled Test: Did SOL flip BNB in market cap?",
    description: "Settled market for win rate verification.",
    category: "Crypto",
    status: "settled",
    winningOutcome: "yes",
    yesSupply: 100_000_000_000,
    noSupply: 50_000_000_000,
    totalVolume: "220.0",
    viewCount: 3100,
    endTs: new Date(Date.now() - 86400 * 10 * 1000),
    settledAt: new Date(Date.now() - 86400 * 5 * 1000),
  },
  {
    marketPubkey: "SOLPRED888888888888888888888888888888888888",
    marketId: 8,
    question: "Settled Test: Did SpaceX Starship achieve orbit on IFT-5?",
    description: "Settled market for win rate verification.",
    category: "Tech",
    status: "settled",
    winningOutcome: "yes",
    yesSupply: 180_000_000_000,
    noSupply: 20_000_000_000,
    totalVolume: "410.0",
    viewCount: 4200,
    endTs: new Date(Date.now() - 86400 * 20 * 1000),
    settledAt: new Date(Date.now() - 86400 * 15 * 1000),
  },
  {
    marketPubkey: "SOLPRED999999999999999999999999999999999999",
    marketId: 9,
    question: "Disputed Test: UK Emergency Budget Election Outcome",
    description: "Disputed market for dispute testing.",
    category: "Politics",
    status: "disputed",
    yesSupply: 70_000_000_000,
    noSupply: 70_000_000_000,
    totalVolume: "90.0",
    viewCount: 480,
    endTs: new Date(Date.now() - 86400 * 2 * 1000),
  },
  {
    marketPubkey: "SOLPREDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    marketId: 10,
    question: "Cancelled Test: SuperBowl Weather Postponement",
    description: "Cancelled market for refund testing.",
    category: "Sports",
    status: "cancelled",
    yesSupply: 10_000_000_000,
    noSupply: 10_000_000_000,
    totalVolume: "15.0",
    viewCount: 310,
    endTs: new Date(Date.now() - 86400 * 3 * 1000),
  },
  {
    marketPubkey: "SOLPREDBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
    marketId: 11,
    question: "Will OpenAI release GPT-5 before July 2026?",
    description: "Settles YES if OpenAI publicly announces GPT-5 model launch.",
    category: "Tech",
    status: "open",
    yesSupply: 130_000_000_000,
    noSupply: 70_000_000_000,
    totalVolume: "265.0",
    viewCount: 2100,
    endTs: new Date(Date.now() + 86400 * 15 * 1000),
  },
  {
    marketPubkey: "SOLPREDCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC",
    marketId: 12,
    question: "Will Solana DEX Volume exceed Uniswap in Q3 2026?",
    description: "Settles YES if DefiLlama quarterly 7-day average DEX volume places Solana above Ethereum mainnet.",
    category: "Crypto",
    status: "open",
    yesSupply: 95_000_000_000,
    noSupply: 105_000_000_000,
    totalVolume: "172.0",
    viewCount: 1650,
    endTs: new Date(Date.now() + 86400 * 50 * 1000),
  },
];

// 8 funded test keypairs
const TEST_TRADERS = Array.from({ length: 8 }, (_, i) => {
  const seed = Buffer.alloc(32);
  seed.write(`solpredict_seed_trader_${i + 1}`);
  return Keypair.fromSeed(seed).publicKey.toBase58();
});

async function main() {
  const db = getDb();
  if (!db) {
    console.error("Database not available");
    process.exit(1);
  }

  console.log("🌱 Seeding devnet database tables...");

  for (const m of TEST_MARKETS) {
    const yesBps = probabilityYesBps(DEFAULT_B, BigInt(m.yesSupply), BigInt(m.noSupply));

    await db.insert(marketsCache).values({
      marketPubkey: m.marketPubkey,
      marketId: m.marketId,
      question: m.question,
      description: m.description,
      category: m.category,
      status: m.status,
      winningOutcome: m.winningOutcome,
      totalVolume: m.totalVolume,
      viewCount: m.viewCount,
      endTs: m.endTs,
      settledAt: m.settledAt,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: marketsCache.marketPubkey,
      set: {
        status: m.status,
        winningOutcome: m.winningOutcome,
        totalVolume: m.totalVolume,
        viewCount: m.viewCount,
        updatedAt: new Date(),
      },
    });

    // Outcomes
    await db.insert(marketOutcomes).values({
      marketPubkey: m.marketPubkey,
      outcomeIndex: 0,
      label: "YES",
      sharesOutstanding: m.yesSupply,
      lastPriceBps: yesBps,
    }).onConflictDoUpdate({
      target: [marketOutcomes.marketPubkey, marketOutcomes.outcomeIndex],
      set: { sharesOutstanding: m.yesSupply, lastPriceBps: yesBps },
    });

    await db.insert(marketOutcomes).values({
      marketPubkey: m.marketPubkey,
      outcomeIndex: 1,
      label: "NO",
      sharesOutstanding: m.noSupply,
      lastPriceBps: 10000 - yesBps,
    }).onConflictDoUpdate({
      target: [marketOutcomes.marketPubkey, marketOutcomes.outcomeIndex],
      set: { sharesOutstanding: m.noSupply, lastPriceBps: 10000 - yesBps },
    });
  }

  console.log(`  ✓ Inserted ${TEST_MARKETS.length} test markets across all categories`);

  // Seed trades & positions for 8 traders across settled and open markets
  let tradeCount = 0;
  for (let i = 0; i < TEST_TRADERS.length; i++) {
    const trader = TEST_TRADERS[i];
    const m1 = TEST_MARKETS[i % TEST_MARKETS.length];
    const m2 = TEST_MARKETS[(i + 4) % TEST_MARKETS.length];

    for (const m of [m1, m2]) {
      const sig = `SEED_SIG_${i}_${m.marketId}_${Date.now()}`;
      const isYes = i % 2 === 0;
      const outcomeIndex = isYes ? 0 : 1;
      const lamportsIn = (1 + (i % 5)) * 1e9;
      const tokensOut = Math.floor(lamportsIn * 1.5);

      await db.insert(trades).values({
        signature: sig,
        marketPubkey: m.marketPubkey,
        outcomeIndex,
        trader,
        side: isYes ? "YES" : "NO",
        shares: tokensOut,
        cost: lamportsIn,
        avgPriceBps: 5000,
        lamportsIn,
        tokensOut,
        pricePerToken: "0.5",
        blockTime: new Date(Date.now() - (i + 1) * 3600 * 1000),
        slot: 100000 + i * 50,
      }).onConflictDoNothing();

      await db.insert(positions).values({
        wallet: trader,
        marketPubkey: m.marketPubkey,
        outcomeIndex,
        shares: tokensOut,
        costBasis: lamportsIn,
      }).onConflictDoUpdate({
        target: [positions.wallet, positions.marketPubkey, positions.outcomeIndex],
        set: { shares: tokensOut, costBasis: lamportsIn },
      });

      tradeCount++;
    }

    // Recompute stats for trader
    await recomputeUserStats(trader);
  }

  console.log(`  ✓ Seeded ${tradeCount} trades & positions across ${TEST_TRADERS.length} traders`);

  // Print summary row counts
  const [mRes, oRes, tRes, pRes, uRes] = await Promise.all([
    db.select().from(marketsCache),
    db.select().from(marketOutcomes),
    db.select().from(trades),
    db.select().from(positions),
    db.select().from(userStats),
  ]);

  console.log("\n════════════════════ SEED COMPLETE ════════════════════");
  console.log(`markets_cache: ${mRes.length} rows`);
  console.log(`market_outcomes: ${oRes.length} rows`);
  console.log(`trades: ${tRes.length} rows`);
  console.log(`positions: ${pRes.length} rows`);
  console.log(`user_stats: ${uRes.length} rows`);
}

main().catch(err => {
  console.error("Seed failed:", err);
  process.exit(1);
});
