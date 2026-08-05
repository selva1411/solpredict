/**
 * Database seeder — run with:
 *   npx tsx scripts/seed-cache.ts
 *
 * Populates the database with realistic sample markets, admin settings,
 * and demo user profiles for local development and staging.
 */
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('❌  DATABASE_URL not set. Add it to your .env.local file.');
  process.exit(1);
}

const db = drizzle(neon(DATABASE_URL), { schema });

// ── Sample markets ──────────────────────────────────────────────────────────

const now = Date.now();
const DAY = 86_400_000;

function futureDate(days: number) {
  return new Date(now + days * DAY);
}

function randomPubkey() {
  const ALPHA = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let s = '';
  while (s.length < 44) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

const SAMPLE_MARKETS: Array<typeof schema.marketsCache.$inferInsert> = [
  {
    marketPubkey: randomPubkey(),
    marketId: 1,
    question: 'Will Bitcoin exceed $120,000 before December 31, 2025?',
    description: 'Resolves YES if BTC/USD closes above $120,000 on any day before the end of 2025 according to Pyth Network price feed.',
    category: 'Crypto',
    status: 'open',
    yesPoolSol: '48.50',
    noPoolSol: '31.20',
    yesSupply: 48500,
    noSupply: 31200,
    endTs: futureDate(60),
    resolveTs: futureDate(61),
    thumbnailUrl: null,
    tags: ['bitcoin', 'btc', 'price', 'crypto'],
    viewCount: 2840,
  },
  {
    marketPubkey: randomPubkey(),
    marketId: 2,
    question: 'Will Solana reach $400 before January 1, 2026?',
    description: 'Resolves YES if SOL/USD on Pyth Network closes at or above $400 at any point before January 1, 2026.',
    category: 'Crypto',
    status: 'open',
    yesPoolSol: '22.10',
    noPoolSol: '37.90',
    yesSupply: 22100,
    noSupply: 37900,
    endTs: futureDate(90),
    resolveTs: futureDate(91),
    thumbnailUrl: null,
    tags: ['solana', 'sol', 'price'],
    viewCount: 1920,
  },
  {
    marketPubkey: randomPubkey(),
    marketId: 3,
    question: 'Will the US Federal Reserve cut interest rates in Q3 2025?',
    description: 'Resolves YES if the Federal Reserve cuts the target federal funds rate by at least 25 basis points at their July or September 2025 meeting.',
    category: 'Finance',
    status: 'open',
    yesPoolSol: '15.00',
    noPoolSol: '10.00',
    yesSupply: 15000,
    noSupply: 10000,
    endTs: futureDate(120),
    resolveTs: futureDate(121),
    thumbnailUrl: null,
    tags: ['fed', 'rates', 'macro'],
    viewCount: 1340,
  },
  {
    marketPubkey: randomPubkey(),
    marketId: 4,
    question: 'Will SpaceX successfully land on Mars before 2030?',
    description: 'Resolves YES if SpaceX achieves a successful crewed or uncrewed Mars landing mission before December 31, 2029.',
    category: 'Tech',
    status: 'open',
    yesPoolSol: '8.20',
    noPoolSol: '41.80',
    yesSupply: 8200,
    noSupply: 41800,
    endTs: futureDate(1800),
    resolveTs: futureDate(1801),
    thumbnailUrl: null,
    tags: ['spacex', 'mars', 'space'],
    viewCount: 980,
  },
  {
    marketPubkey: randomPubkey(),
    marketId: 5,
    question: 'Will Ethereum ETF see $1B inflows in first week of trading?',
    description: 'Resolves YES if total net inflows across all spot Ethereum ETFs exceed $1,000,000,000 in their first calendar week of trading.',
    category: 'Crypto',
    status: 'open',
    yesPoolSol: '33.60',
    noPoolSol: '16.40',
    yesSupply: 33600,
    noSupply: 16400,
    endTs: futureDate(30),
    resolveTs: futureDate(31),
    thumbnailUrl: null,
    tags: ['ethereum', 'etf', 'institutional'],
    viewCount: 3200,
  },
  {
    marketPubkey: randomPubkey(),
    marketId: 6,
    question: 'Will the next US President be a Republican?',
    description: 'Resolves YES if the Republican Party candidate wins the 2028 US Presidential Election.',
    category: 'Politics',
    status: 'open',
    yesPoolSol: '29.00',
    noPoolSol: '21.00',
    yesSupply: 29000,
    noSupply: 21000,
    endTs: futureDate(1095),
    resolveTs: futureDate(1096),
    thumbnailUrl: null,
    tags: ['politics', 'election', 'usa'],
    viewCount: 5100,
  },
  {
    marketPubkey: randomPubkey(),
    marketId: 7,
    question: 'Will the FIFA World Cup 2026 be won by Brazil?',
    description: 'Resolves YES if Brazil wins the FIFA World Cup 2026 tournament final.',
    category: 'Sports',
    status: 'open',
    yesPoolSol: '11.00',
    noPoolSol: '39.00',
    yesSupply: 11000,
    noSupply: 39000,
    endTs: futureDate(360),
    resolveTs: futureDate(361),
    thumbnailUrl: null,
    tags: ['soccer', 'worldcup', 'brazil'],
    viewCount: 2700,
  },
  {
    marketPubkey: randomPubkey(),
    marketId: 8,
    question: 'Will GPT-5 pass the Turing Test under standardized evaluation?',
    description: 'Resolves YES if OpenAI GPT-5 (or equivalent) passes a recognized standardized Turing Test evaluation published in a peer-reviewed venue by the end of 2025.',
    category: 'Tech',
    status: 'open',
    yesPoolSol: '18.50',
    noPoolSol: '31.50',
    yesSupply: 18500,
    noSupply: 31500,
    endTs: futureDate(180),
    resolveTs: futureDate(181),
    thumbnailUrl: null,
    tags: ['ai', 'gpt', 'openai', 'turing'],
    viewCount: 4450,
  },
];

// ── Admin settings ──────────────────────────────────────────────────────────

const ADMIN_SETTINGS: Array<typeof schema.adminSettings.$inferInsert> = [
  { key: 'feeBps',             value: '200' },
  { key: 'platformName',       value: 'PREDICT-X' },
  { key: 'maintenanceMode',    value: 'false' },
  { key: 'maxMarketDuration',  value: '2592000' },
  { key: 'minLiquiditySol',    value: '1.0' },
  { key: 'resolutionDelaySec', value: '3600' },
  { key: 'disputePeriodSec',   value: '86400' },
  { key: 'twitterShareEnabled','value': 'true' },
];

// ── Demo users ──────────────────────────────────────────────────────────────

const DEMO_USERS: Array<typeof schema.users.$inferInsert> = [
  {
    wallet: '7gWnJRMNMXrWFGLJStJMX7xVJgRXxW6RNGiX6JLbVSrF',
    username: 'WhaleProphet',
    totalWagered: '450.00',
    totalWon: '510.00',
    totalProfit: '60.00',
    marketsTraded: 42,
    winRate: '68.00',
    pasScore: 82,
  },
  {
    wallet: 'CrBvmLCX9MLmPFhT2JxQZmhPQiamTK8wVBqbg3nMEdKs',
    username: 'AlphaTrader',
    totalWagered: '280.00',
    totalWon: '310.00',
    totalProfit: '30.00',
    marketsTraded: 28,
    winRate: '61.00',
    pasScore: 74,
  },
  {
    wallet: 'DXmkLZBq7qRJ9VNF4UXjNyHcPqsqmBfevMJWrH7SkFHG',
    username: 'OracleSeeker',
    totalWagered: '175.50',
    totalWon: '160.00',
    totalProfit: '-15.50',
    marketsTraded: 19,
    winRate: '47.00',
    pasScore: 58,
  },
];

// ── Seed runner ─────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱  Starting database seed...\n');

  // Markets
  console.log(`📊  Seeding ${SAMPLE_MARKETS.length} markets...`);
  for (const market of SAMPLE_MARKETS) {
    try {
      await db.insert(schema.marketsCache)
        .values(market)
        .onConflictDoUpdate({
          target: schema.marketsCache.marketPubkey,
          set: {
            question: market.question,
            yesPoolSol: market.yesPoolSol,
            noPoolSol: market.noPoolSol,
            viewCount: market.viewCount ?? 0,
            updatedAt: new Date(),
          },
        });
      console.log(`  ✅  ${market.question.slice(0, 60)}...`);
    } catch (e) {
      console.error(`  ❌  Failed: ${market.question.slice(0, 40)}`, e);
    }
  }

  // Admin settings
  console.log(`\n⚙️   Seeding ${ADMIN_SETTINGS.length} admin settings...`);
  for (const setting of ADMIN_SETTINGS) {
    try {
      await db.insert(schema.adminSettings)
        .values(setting)
        .onConflictDoUpdate({
          target: schema.adminSettings.key,
          set: { value: setting.value, updatedAt: new Date() },
        });
      console.log(`  ✅  ${setting.key} = ${setting.value}`);
    } catch (e) {
      console.error(`  ❌  Failed: ${setting.key}`, e);
    }
  }

  // Demo users
  console.log(`\n👥  Seeding ${DEMO_USERS.length} demo users...`);
  for (const user of DEMO_USERS) {
    try {
      await db.insert(schema.users)
        .values(user)
        .onConflictDoUpdate({
          target: schema.users.wallet,
          set: {
            username: user.username,
            totalWagered: user.totalWagered,
            totalWon: user.totalWon,
            totalProfit: user.totalProfit,
            marketsTraded: user.marketsTraded,
            winRate: user.winRate,
          },
        });
      console.log(`  ✅  ${user.username} (${user.wallet.slice(0, 8)}...)`);
    } catch (e) {
      console.error(`  ❌  Failed: ${user.username}`, e);
    }
  }

  console.log('\n✨  Seed complete!');
  process.exit(0);
}

main().catch(e => {
  console.error('❌  Seed failed:', e);
  process.exit(1);
});
