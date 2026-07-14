# Technology Stack (Pinned — Do Not Substitute)

| Layer            | Technology                                    | Version/Notes |
|-------------------|-----------------------------------------------|----------------|
| Blockchain        | Solana Devnet                                  | `https://api.devnet.solana.com` — see `ops/01-rpc-resilience.md` for production RPC strategy |
| Smart contract    | Rust + Anchor Framework                        | Anchor ≥ 0.30.0 |
| Oracle            | Pyth Network (pull oracle)                     | `pyth-solana-receiver-sdk` on-chain crate |
| Oracle (research) | Switchboard                                    | Docs comparison only, no implementation |
| Tokens            | SPL Token Program + Associated Token Accounts  | `anchor-spl` crate |
| Frontend          | Next.js 14+ (App Router) + TypeScript + Tailwind | |
| Wallet            | `@solana/wallet-adapter`                       | Phantom, Solflare, Backpack |
| Anchor client     | `@coral-xyz/anchor` + generated IDL             | |
| 3D / Motion       | `@react-three/fiber`, `@react-three/drei`, `framer-motion`, `gsap` | |
| Charts            | Recharts or `lightweight-charts`               | probability history |
| State/query       | `@tanstack/react-query` + WS account subscriptions | |
| Testing           | Anchor mocha/ts (local validator) + LiteSVM     | |
| Tooling           | Solana CLI, Anchor CLI, Git & GitHub             | |
| Deployment        | Vercel (frontend), Solana Devnet (program)      | |

## Version Pinning Rule
Every dependency version gets locked in `package.json`/`Cargo.toml`
with exact versions (no `^` or `~` for critical deps: `anchor-lang`,
`anchor-spl`, `pyth-solana-receiver-sdk`, `@coral-xyz/anchor`).
This prevents "works on my machine" breakage from upstream updates.