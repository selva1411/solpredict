import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { marketsCache } from "../src/lib/db/schema";
import { sql } from "drizzle-orm";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const sqlClient = neon(DATABASE_URL);
const db = drizzle(sqlClient);

const SEED_MARKETS = [
  {
    marketPubkey: "EFziv45w9kY3KLABzQxgLBNDfNm7KsqMWYs5B43nUyo6",
    marketId: 1,
    question: "Will SOL exceed $250 by end of week?",
    description: "Resolves YES if SOL/USD > $250 at 17:00 UTC Friday via Pyth.",
    category: "Crypto",
    status: "open",
    yesPoolSol: "184.32",
    noPoolSol: "98.24",
    endTs: new Date(Date.now() + 5 * 86400000),
    resolveTs: new Date(Date.now() + 5 * 86400000 + 7200),
  },
  {
    marketPubkey: "8m1uNPLbo25kZGnaFUa3aKDJQBRxGQjGpuVFXMYirMWt",
    marketId: 2,
    question: "Will BTC hold above $60K this month?",
    description: "Resolves YES if BTC/USD stays above $60,000 for the remainder of the month.",
    category: "Crypto",
    status: "open",
    yesPoolSol: "320.50",
    noPoolSol: "180.75",
    endTs: new Date(Date.now() + 14 * 86400000),
    resolveTs: new Date(Date.now() + 14 * 86400000 + 7200),
  },
  {
    marketPubkey: "HxPLdMZh1jMGNpQY6NCGHd7mQQLP8FQ7NPQKFSBSJMnC",
    marketId: 3,
    question: "Will India win the Cricket World Cup 2027?",
    description: "Resolves YES if India wins the ICC Cricket World Cup 2027.",
    category: "Sports",
    status: "open",
    yesPoolSol: "56.80",
    noPoolSol: "120.40",
    endTs: new Date(Date.now() + 30 * 86400000),
    resolveTs: new Date(Date.now() + 30 * 86400000 + 7200),
  },
  {
    marketPubkey: "5X7kRmXt2qK4mMqrK4E4TLyGMtPUxPzCwXfYBrnrQGBd",
    marketId: 4,
    question: "Will Fed cut rates by 50bps this quarter?",
    description: "Resolves YES if the Federal Reserve cuts the federal funds rate by at least 50 basis points before end of quarter.",
    category: "Politics",
    status: "open",
    yesPoolSol: "92.15",
    noPoolSol: "155.30",
    endTs: new Date(Date.now() + 60 * 86400000),
    resolveTs: new Date(Date.now() + 60 * 86400000 + 7200),
  },
  {
    marketPubkey: "GQWNP2jMHBCsQDPzH3b6bAhWBdV4Jr4RsNn8JXFeGLvc",
    marketId: 5,
    question: "Will Apple release a foldable iPhone this year?",
    description: "Resolves YES if Apple announces/releases a foldable iPhone or iPad hybrid device by Dec 31.",
    category: "Tech",
    status: "open",
    yesPoolSol: "45.20",
    noPoolSol: "210.60",
    endTs: new Date(Date.now() + 90 * 86400000),
    resolveTs: new Date(Date.now() + 90 * 86400000 + 7200),
  },
  {
    marketPubkey: "D7Xckrbdg52MVV2kKzH2XJ8hFqvYCFs6TEoZjcN3gJ1N",
    marketId: 6,
    question: "Will SOL ETF be approved by SEC this year?",
    description: "Resolves YES if the SEC approves a spot Solana ETF.",
    category: "Crypto",
    status: "open",
    yesPoolSol: "78.90",
    noPoolSol: "65.40",
    endTs: new Date(Date.now() + 120 * 86400000),
    resolveTs: new Date(Date.now() + 120 * 86400000 + 7200),
  },
  {
    marketPubkey: "2ViXGQVF94LmL3SGBgNQ5NL3B8Gh6U6jBCA14zYKHGMk",
    marketId: 7,
    question: "Will ETH 2.0 staking rate exceed 4%?",
    description: "Resolves YES if the ETH staking rate exceeds 4% APY on average for a week.",
    category: "Crypto",
    status: "open",
    yesPoolSol: "34.60",
    noPoolSol: "89.20",
    endTs: new Date(Date.now() + 45 * 86400000),
    resolveTs: new Date(Date.now() + 45 * 86400000 + 7200),
  },
  {
    marketPubkey: "FKvfPpt7mCgEowLVdBjYr2Au4QduLFfPEKgmmvjQfDfH",
    marketId: 8,
    question: "Will the Lakers win the NBA championship?",
    description: "Resolves YES if LA Lakers win the NBA Finals.",
    category: "Sports",
    status: "open",
    yesPoolSol: "210.00",
    noPoolSol: "45.80",
    endTs: new Date(Date.now() + 180 * 86400000),
    resolveTs: new Date(Date.now() + 180 * 86400000 + 7200),
  },
  {
    marketPubkey: "Ci9csLSfX5kv4QbCQSRjM9Z5Fh5QdAHHm3WWxG62qVND",
    marketId: 9,
    question: "Will AI-generated content exceed 50% of web traffic?",
    description: "Resolves YES if AI-generated content accounts for >50% of total web traffic.",
    category: "Tech",
    status: "open",
    yesPoolSol: "67.30",
    noPoolSol: "112.50",
    endTs: new Date(Date.now() + 60 * 86400000),
    resolveTs: new Date(Date.now() + 60 * 86400000 + 7200),
  },
];

async function seed() {
  console.log("Clearing old markets_cache...");
  await db.delete(marketsCache);

  console.log(`Inserting ${SEED_MARKETS.length} seed markets...`);
  for (const m of SEED_MARKETS) {
    await db.insert(marketsCache).values({
      marketPubkey: m.marketPubkey,
      marketId: m.marketId,
      question: m.question,
      description: m.description,
      category: m.category,
      status: m.status,
      yesPoolSol: m.yesPoolSol,
      noPoolSol: m.noPoolSol,
      endTs: m.endTs,
      resolveTs: m.resolveTs,
      yesSupply: 0,
      noSupply: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    console.log(`  #${m.marketId}: ${m.question.slice(0, 50)}`);
  }

  console.log("\nSeed complete! 9 markets inserted.");
}

seed().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
