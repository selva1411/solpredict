# Monorepo Structure

Antigravity must scaffold exactly this tree in Phase 0:

solpredict/
├── Anchor.toml                  # devnet cluster, wallet path, program id
├── Cargo.toml                   # workspace root
├── programs/
│   └── solpredict/
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs           # declare_id!, #[program] mod, re-exports
│           ├── constants.rs     # seeds, fee bps, staleness window, limits
│           ├── errors.rs        # custom error enum
│           ├── state/
│           │   ├── mod.rs
│           │   ├── config.rs
│           │   ├── market.rs
│           │   └── user_position.rs
│           ├── instructions/
│           │   ├── mod.rs
│           │   ├── initialize_config.rs
│           │   ├── initialize_market.rs
│           │   ├── buy_shares.rs
│           │   ├── settle_market.rs
│           │   ├── claim_rewards.rs
│           │   ├── cancel_market.rs
│           │   ├── claim_refund.rs
│           │   └── withdraw_fees.rs
│           └── utils/
│               ├── mod.rs
│               ├── oracle.rs    # Pyth read + validation helper
│               └── payout_math.rs # checked i128 payout calculations
│
├── tests/
│   ├── solpredict.ts            # full integration suite (local validator)
│   ├── helpers/
│   │   ├── setup.ts             # shared test bootstrap
│   │   ├── mock-pyth.ts         # mock PriceUpdateV2 account builder
│   │   └── pda.ts               # PDA derivation helpers (mirrors client)
│   └── litesvm/
│       └── payout-math.test.ts  # fast pure-function tests
│
├── app/                         # Next.js frontend
│   ├── src/
│   │   ├── app/                 # routes
│   │   │   ├── page.tsx                 # Home
│   │   │   ├── market/[id]/page.tsx     # Market detail
│   │   │   ├── portfolio/page.tsx
│   │   │   ├── admin/page.tsx
│   │   │   └── leaderboard/page.tsx
│   │   ├── components/
│   │   │   ├── ui/              # glass cards, buttons, inputs (design system)
│   │   │   ├── 3d/              # R3F scenes (globe, orb, coin-flip)
│   │   │   └── market/          # MarketCard, TradePanel, ActivityFeed
│   │   ├── hooks/
│   │   │   ├── useProgram.ts
│   │   │   ├── useMarkets.ts
│   │   │   ├── usePosition.ts
│   │   │   ├── usePythPrice.ts
│   │   │   └── useActivityFeed.ts
│   │   ├── lib/
│   │   │   ├── anchor-client.ts
│   │   │   ├── pda.ts           # MUST mirror program seeds exactly
│   │   │   ├── format.ts        # SOL/probability formatters
│   │   │   ├── error-map.ts     # Anchor error code → human message
│   │   │   └── env.ts           # typed env var access, fails fast if missing
│   │   └── idl/                 # copied from target/idl after each anchor build
│   ├── public/
│   └── .env.local.example
│
├── docs/                        # this documentation set
├── scripts/
│   ├── initialize-config.ts
│   ├── seed-markets.ts
│   ├── settle-market.ts         # manual admin settlement helper
│   └── airdrop.ts
│
└── .github/workflows/
    └── ci.yml                   # lint + anchor test + frontend build on PR