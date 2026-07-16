# Release Notes — SOLPredict v1.0.0 (Production Release)

We are proud to release **SOLPredict v1.0.0**, a Polymarket-style decentralized predictions platform built on Solana. This release includes critical math and security bug fixes, custom React Three Fiber 3D visuals, live on-chain platform metrics, real-time RPC connection health monitors, and a complete operations deployment guide.

---

## 🚀 Key Features & Upgrades

### 1. Competitive Differentiator: Live 3D Win-Probability Orb
*   **3D WebGL Mesh**: Renders a floating, pulsing 3D mesh that represents the live probability of a YES outcome.
*   **Odds Mapping**:
    *   **High YES (>50%)**: Grows in scale and turns green.
    *   **High NO (<50%)**: Shrinks/deforms and turns red.
    *   **50/50 Even Odds**: Glows amber.
*   **Low-End Device Fallback**: Automatically degrades to a beautiful, lightweight 2D CSS glowing radial bubble if WebGL is unsupported or blocked.

### 2. Live Escrow & Trust Indicators
*   **PDA Treasury Escrow Ticker**: Fetches the live escrow balance of the treasury PDA directly from the Solana blockchain.
*   **Dynamic Fee Ticker**: Queries the official Config account PDA to show the active fee percentage rate (capped at 10%).
*   **On-Chain Settlement Explainer**: Displays instructions showing how the smart contract resolves sports/custom boards via admin signature or crypto boards via the Pyth Network pull oracle feed.

### 3. Star Watchlist & Share Buttons
*   ** star Toggle**: Permits users to add or remove boards from their local watchlist directly from the detail view.
*   **Social Sharing Popover**: One-click actions to copy the URL to clipboard, or direct forward links to X (Twitter) and Telegram.

### 4. Resilient Error Shielding & Health Monitors
*   **React Error Boundary**: Catch runtime component exceptions, rendering a clean fault console to prevent client crashes.
*   **RPC Connection Dot**: A real-time header dot showing the active connection status to the Solana node (Online, Offline, Checking).

---

## 🛠️ Deployment Instructions (Go-Live Order)

To execute a clean deploy of the SOLPredict program and Next.js frontend, execute these commands in order:

### 1. Build and Deploy Rust Smart Contract
Generate keys, update paths, and push compiled binaries to Solana:
```bash
# 1. Check/fund your deployer balance (needs ~3.5 SOL):
solana balance

# 2. Compile target files:
anchor build

# 3. Retrieve your compiled program address:
solana address -k target/deploy/solpredict-keypair.json

# 4. Update the Program ID in Anchor.toml & programs/solpredict/src/lib.rs, then re-build:
anchor build

# 5. Deploy to Mainnet-Beta (or Devnet):
anchor deploy --provider.cluster mainnet-beta --program-keypair target/deploy/solpredict-keypair.json
```

### 2. Initialize On-Chain Configuration
1. Connect the authority keypair on the web interface `/admin` console.
2. Initialize the platform configuration to establish the escrow rules.

### 3. Deploy Frontend on Vercel
Connect your repo, choose the Next.js preset, set the root directory to `app/`, and specify the following **Environment Variables**:

*   `NEXT_PUBLIC_SOLANA_RPC_URL`: `https://api.mainnet-beta.solana.com` (Or your custom high-performance endpoint).
*   `NEXT_PUBLIC_SOLANA_NETWORK`: `mainnet-beta`
*   `NEXT_PUBLIC_PROGRAM_ID`: Your deployed Mainnet Program ID (e.g. `HNY9PwV2MN6CHACuigCNvRWusfJdDZGgxC3weM4QVaJP`).
*   `NEXT_PUBLIC_VERCEL_URL`: Your Vercel domain URL.
