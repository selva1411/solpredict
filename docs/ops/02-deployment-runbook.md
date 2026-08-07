# SOLPredict — Deployment and Operations Runbook

This document describes the exact steps to build, deploy, configure, and maintain the SOLPredict platform on Solana (Devnet and Mainnet-Beta) and Vercel.

---

## 🌐 1. Network Environments

| Parameter | Devnet Configuration (Default) | Mainnet-Beta Configuration |
|---|---|---|
| **Solana RPC URL** | `https://api.devnet.solana.com` | `https://api.mainnet-beta.solana.com` (Or custom private RPC) |
| **Program ID** | `HNY9PwV2MN6CHACuigCNvRWusfJdDZGgxC3weM4QVaJP` | (Custom Program ID generated on deploy) |
| **Pyth Receiver Program** | `rec5EK5dx4Cj2CXobQxh2XVtJUuNHEG65eUkwHLvn4g` | `rec5EK5dx4Cj2CXobQxh2XVtJUuNHEG65eUkwHLvn4g` |
| **SOL/USD Price Feed** | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` | `0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` |
| **BTC/USD Price Feed** | `0xe62df6c8b4a85fe1a67d0f246eca93afe6c92e4c6a482ee1190407b0db51bb50` | `0xe62df6c8b4a85fe1a67d0f246eca93afe6c92e4c6a482ee1190407b0db51bb50` |

---

## 🛠️ 2. Deploying the On-Chain Program

Follow these steps to deploy the Rust/Anchor program to Solana:

### Step 2.1: Keypair Preparation
Ensure you have a funded deployment authority keypair:
```bash
# Generate a deployment authority if you do not have one:
solana-keygen new -o deploy-authority.json

# Check your balance (ensure you have ~3-4 SOL for program storage account creation):
solana balance -k deploy-authority.json
```

### Step 2.2: Build the Program
Build the Anchor program to generate target artifacts and TypeScript types:
```bash
anchor build
```

> **Note:** the current checked-in program includes an optional
> `emergency_pause` account on all trading instructions (ABI change applied
> 2026-08-05). Any deployment must use a freshly built binary + regenerated
> IDL (`target/idl/solpredict.json` → `app/src/lib/idl/solpredict.json`).

### Step 2.3: Generate and Set Program ID
Find the public key of the built program:
```bash
# This outputs the Program ID matching the compiled binary keypair:
solana address -k target/deploy/solpredict-keypair.json
```
1. Replace the program ID in [Anchor.toml](file:///home/selva/solana_projects/solpredict/Anchor.toml) under `[programs.localnet]` and `[programs.devnet]`.
2. Replace the program ID in the Rust source code: [lib.rs](file:///home/selva/solana_projects/solpredict/programs/solpredict/src/lib.rs) inside `declare_id!("...")`.
3. Re-build to seal the correct program ID:
```bash
anchor build
```

### Step 2.4: Deploy to Solana Devnet
Run the deployment command:
```bash
anchor deploy --provider.cluster devnet --program-keypair target/deploy/solpredict-keypair.json
```

---

## 🎛️ 3. Initializing Platform Config

The platform requires an initialized on-chain Config PDA to handle trading fee distribution and rules.

1. Open the local console or go to the `/admin` console route of the deployed web application.
2. Connect your wallet containing the deployer/admin authority.
3. Locate the **Platform Config Panel** and click **Initialize Config**.
4. Set the desired fee percentage (e.g. `2.0%` represents `200` Basis Points).
5. Confirm the transaction.

---

## 🖥️ 4. Deploying the Web Frontend (Next.js on Vercel)

Deploying the Next.js application is recommended on **Vercel**.

### Step 4.1: Required Environment Variables
Set the following environment variables in your Vercel Project Settings (`Settings > Environment Variables`):

| Variable Name | Description | Recommended Value (Devnet) |
|---|---|---|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana network RPC endpoint | `https://api.devnet.solana.com` |
| `NEXT_PUBLIC_SOLANA_NETWORK` | Cluster network name tag | `devnet` |
| `NEXT_PUBLIC_PROGRAM_ID` | The deployed on-chain Program ID | `HNY9PwV2MN6CHACuigCNvRWusfJdDZGgxC3weM4QVaJP` |

### Step 4.2: Build Configuration on Vercel
In the Vercel Dashboard, set:
- **Framework Preset**: `Next.js`
- **Root Directory**: `app` (Or keep empty and set the project directory root to `app/`)
- **Build Command**: `npm run build`
- **Output Directory**: `.next`

---

## 🔄 5. Switching to Mainnet-Beta

To move the entire stack to Solana Mainnet-Beta:
1. Deploy the program to Mainnet:
   ```bash
   anchor deploy --provider.cluster mainnet --program-keypair target/deploy/solpredict-keypair.json
   ```
2. Initialize config via the admin console on mainnet.
3. Update Vercel environment variables:
   - `NEXT_PUBLIC_SOLANA_RPC_URL`: Set to a private high-performance mainnet RPC node (e.g. Helius, Triton, QuickNode).
   - `NEXT_PUBLIC_SOLANA_NETWORK`: Set to `mainnet-beta`.
   - `NEXT_PUBLIC_PROGRAM_ID`: Update to the newly deployed mainnet Program ID.
4. Redeploy the production frontend.
