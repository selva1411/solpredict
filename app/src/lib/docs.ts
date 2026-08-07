export interface DocArticle {
  slug: string;
  title: string;
  summary: string;
  icon: string;
  sections: { heading: string; body: string }[];
}

export const DOC_ARTICLES: DocArticle[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    summary: "Connect your wallet, fund with devnet SOL, and place your first position.",
    icon: "terminal",
    sections: [
      {
        heading: "1. Connect a wallet",
        body:
          "Open the platform and click Connect Wallet in the header. Phantom and other Solana wallets are supported. Make sure the wallet is on the same cluster the app points at (Devnet by default).",
      },
      {
        heading: "2. Get devnet SOL",
        body:
          "Trading costs SOL for gas and for the position itself. Use the Airdrop button in the header (or a public devnet faucet) to request free devnet SOL. Each position also requires a small rent-exempt amount for the position account.",
      },
      {
        heading: "3. Choose a market",
        body:
          "Browse open markets on the Markets page. Each market asks a binary question (YES/NO), shows the implied odds dial, the target price vs. the live Pyth oracle feed, and the time remaining until end.",
      },
      {
        heading: "4. Place your first position",
        body:
          "Open a market and use the Buy panel to purchase YES or NO shares. Shares are priced off the AMM pool and carry a protocol fee. Confirm the transaction in your wallet to mint your position tokens.",
      },
    ],
  },
  {
    slug: "how-markets-work",
    title: "How Markets Work",
    summary: "Questions, shares, implied odds, and how the pool prices YES/NO.",
    icon: "activity",
    sections: [
      {
        heading: "Binary markets",
        body:
          "Every market is a binary question — the outcome is either YES or NO. When you buy, you receive SPL-token shares of the side you picked. When the market settles, winning shares redeem for the payout pool.",
      },
      {
        heading: "Pricing & implied odds",
        body:
          "Each market has a fixed share price (in lamports per share) that anchors the cost of a share. The pool is balanced with AMM math so the implied probability of each side stays between 0% and 100% and the two sides always sum to ~100%.",
      },
      {
        heading: "Fees",
        body:
          "A protocol fee (a percentage of each trade) is collected into the market treasury. It is used to fund payouts and can be withdrawn by the admin from settled markets.",
      },
      {
        heading: "End & resolution",
        body:
          "Trading stops at the market end time. After the resolve time, an admin (or the oracle-driven settle path) settles the market using the live Pyth price feed compared against the market's target.",
      },
    ],
  },
  {
    slug: "trading-guide",
    title: "Trading Guide",
    summary: "Buying and selling shares, limit orders, and managing positions.",
    icon: "candlestick",
    sections: [
      {
        heading: "Buying shares",
        body:
          "Enter a quantity of shares and pick YES or NO. The panel shows the estimated cost, including fees, before you sign. Larger quantities move the price through the AMM curve.",
      },
      {
        heading: "Selling shares",
        body:
          "Holders can sell winning or open positions back into the pool while a market is still open, subject to pool liquidity. The return is calculated from the current AMM price minus fees.",
      },
      {
        heading: "Limit orders",
        body:
          "Markets with the order book enabled let you place buy-bids and sell-asks at a limit price in basis points. Funds are escrowed in the order PDA until the order fills or is cancelled.",
      },
      {
        heading: "Liquidity providing",
        body:
          "You can add liquidity to a market by depositing equal YES/NO token value. In return you receive LP tokens that represent a share of the pool, claimable pro-rata as trades flow through.",
      },
    ],
  },
  {
    slug: "claims-and-payouts",
    title: "Claims & Payouts",
    summary: "How settlement works, what you get, and how to claim rewards.",
    icon: "coins",
    sections: [
      {
        heading: "Settlement",
        body:
          "Once a market passes its resolve time, it is settled. The Pyth oracle price at settlement is compared to the market's target condition to determine YES or NO as the winning side.",
      },
      {
        heading: "Winning shares",
        body:
          "If you hold the winning side, your position is marked as a winner. You can claim your share of the payout pool — proportional to your winning token balance over the total winning supply.",
      },
      {
        heading: "How to claim",
        body:
          "Open the market or your portfolio, find the settled position, and click Claim. The transaction burns your winning tokens and transfers the payout in SOL to your wallet. Claims are one-time per position.",
      },
      {
        heading: "Cancelled markets",
        body:
          "If a market is cancelled (no valid outcome), holders can claim a refund of their original deposit. Refunds burn both YES and NO tokens and return the exact amount paid.",
      },
    ],
  },
  {
    slug: "oracle-pricing",
    title: "Oracle Pricing",
    summary: "How Pyth prices are validated and used to settle crypto markets.",
    icon: "radar",
    sections: [
      {
        heading: "Live price feeds",
        body:
          "Crypto markets settle against the Pyth Network price feed configured for that market (for example SOL/USD). Prices are read directly from the on-chain Pyth account at settlement time.",
      },
      {
        heading: "On-chain validation",
        body:
          "Before a price is accepted, the program verifies the feed ID matches the market, the price is fresh (not stale), and the confidence interval is narrow enough. A malformed or stale update is rejected.",
      },
      {
        heading: "Exponent scaling",
        body:
          "Pyth prices and market targets can use different decimal exponents. The program scales both sides to a common precision using checked 128-bit math before comparing, so a $250 target vs. a $249.97 oracle price resolves correctly.",
      },
      {
        heading: "Devnet mock feeds",
        body:
          "On devnet, a mock price-update instruction lets the admin set controlled oracle prices so settlement paths can be exercised deterministically in integration tests.",
      },
    ],
  },
  {
    slug: "security",
    title: "Security & Safeguards",
    summary: "Emergency pause, admin gating, and how the protocol protects funds.",
    icon: "shield",
    sections: [
      {
        heading: "Emergency pause",
        body:
          "The protocol has an emergency-pause circuit. When active, all user trading instructions (buy, sell, add/remove liquidity, orders) are rejected. Admin winding-down paths (settle, withdraw, claim, refund) still work so the platform can be unwound safely.",
      },
      {
        heading: "Admin gating",
        body:
          "Market creation, settlement (manual), cancellation, and fee withdrawal require the configured admin authority to sign. The admin is stored in the platform config account at initialization.",
      },
      {
        heading: "Funds flow",
        body:
          "Position payments go to a market-specific treasury PDA. Winning payouts and refunds are paid out of that treasury, and the program asserts rent-exemption is maintained on every transfer.",
      },
      {
        heading: "Audit status",
        body:
          "The program is audited against a security checklist covering arithmetic overflow, PDA derivation, oracle substitution, double-claim, and double-settle. See the repository's program security checklist for the full itemized verification.",
      },
    ],
  },
  {
    slug: "admin",
    title: "Admin Operations",
    summary: "For the platform admin: creating markets, settling, treasury, pause.",
    icon: "settings",
    sections: [
      {
        heading: "Access",
        body:
          "The admin console is gated by wallet authority. The wallet that initialized the platform config is the admin; other wallets are routed to the user dashboard.",
      },
      {
        heading: "Create & approve markets",
        body:
          "Admins can create markets directly or approve proposed markets. Market creation validates question length, timing windows, minimum share price, and category.",
      },
      {
        heading: "Settle & cancel",
        body:
          "Manual settlement sets an outcome for markets without a price feed. Oracle-driven markets settle against the Pyth price once the resolve time passes. Markets can also be cancelled before settlement.",
      },
      {
        heading: "Treasury & fees",
        body:
          "The treasury page shows balances across markets. Protocol fees accumulated in settled markets can be withdrawn to the admin wallet. Emergency pause and withdraw are available under controls.",
      },
    ],
  },
];

export function getDocArticle(slug: string): DocArticle | undefined {
  return DOC_ARTICLES.find((a) => a.slug === slug);
}
