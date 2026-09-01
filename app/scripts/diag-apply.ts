import { applyEvent } from "../src/lib/indexer/reducer";
import { logger } from "../src/lib/logger";

// Temporarily surface the swallowed reducer error in full
const origWarn = logger.warn.bind(logger);
logger.warn = (...args: unknown[]) => {
  console.log("WARN-FULL:", JSON.stringify(args, null, 2).slice(0, 3000));
};

async function main() {
  await applyEvent({
    type: "market",
    marketPubkey: "A7Zm8Z1pNotzQeTf3592poN7gBsgeWm63BhpU9FMssEC",
    marketId: 0,
    creator: "2zPRxYVxFDUZn6QEYU2m6bzyZcN7pCCJ4E25gc2EQcCS",
    question: "Will SOL exceed $300 by 15 Aug 2026?",
    description: "Settles via Pyth SOL/USD.",
    category: "Crypto",
    status: "open",
    yesPoolLamports: 3475929842,
    noPoolLamports: 3294915720,
    yesSupply: 750000000,
    noSupply: 795000000,
    endTs: Math.floor(Date.now() / 1000) + 86400,
    resolveTs: Math.floor(Date.now() / 1000) + 90000,
  } as never);
  console.log("done");
  process.exit(0);
}

main().catch((e) => {
  console.error("FATAL:", e?.message ?? e);
  process.exit(1);
});
