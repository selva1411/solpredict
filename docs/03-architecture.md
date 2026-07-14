# High-Level Architecture

## Request Flow

Next.js Frontend
    │
    ▼
Wallet Adapter (Phantom/Solflare/Backpack)
    │  (signs transactions)
    ▼
Anchor Client (TypeScript, generated from IDL)
    │  (builds instructions, derives PDAs)
    ▼
Solana Devnet RPC (see ops/01-rpc-resilience.md)
    │
    ▼
SOLPredict Program (Rust/Anchor)
    │
    ├──► SPL Token Program (mint/burn/transfer YES/NO tokens)
    ├──► System Program (SOL transfers to/from Treasury PDA)
    └──► Pyth Receiver Program (read PriceUpdateV2 for settlement)

## Data Read Path (frontend queries, no wallet needed)
Frontend → react-query → `program.account.market.all()` /
`getProgramAccounts` with memcmp filters → rendered as market cards.
Live updates via `connection.onAccountChange` / `onLogs` websocket
subscriptions, invalidating the relevant react-query cache key.

## Trust Boundaries
- **On-chain program**: source of truth for all balances, market
  state, and settlement outcome. Nothing in the frontend is trusted.
- **Frontend**: pure UI/UX layer + convenience caching. Every
  number shown must ultimately be derivable from on-chain accounts.
- **Pyth oracle**: trusted third-party price feed, but the program
  independently validates staleness, feed identity, and confidence
  before trusting any price it reads (see `oracle/00-pyth-integration.md`).

## Diagram (Mermaid — put in README + this file)

    flowchart TD
        A[Next.js Frontend] --> B[Wallet Adapter]
        B --> C[Anchor Client]
        C --> D[Solana Devnet RPC]
        D --> E[SOLPredict Program]
        E --> F[SPL Token Program]
        E --> G[System Program / Treasury PDA]
        E --> H[Pyth Receiver Program]
        F --> I[User YES/NO ATAs]
        G --> J[Treasury PDA lamports]
        H --> K[PriceUpdateV2 Account]