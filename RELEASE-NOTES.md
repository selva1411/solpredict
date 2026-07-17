# Release Notes — SolPredict Upgrades

Welcome to the latest version of **SolPredict**. This release introduces a broadened oracle settlement architecture, dynamic frontend sparklines, and a standardized design token theme layout.

---

## 1. What Changed
- **Broadened Oracle Gating**: The smart contract settlement gate was upgraded from a strict category-based constraint (`category == Category::Crypto`) to a dynamic feed-backed constraint (`oracle_feed_id != [0u8; 32]`). Any market initialized with a non-zero Pyth feed ID is resolved on-chain via the Pyth pull oracle receiver.
- **Enforced Manual Settlement**: Markets without a price feed (zero feed ID `[0u8; 32]`) must use `settle_market_manual`, while manual settlement is strictly blocked for any price-backed market.
- **Dynamic Frontend Sparklines**: Market card elements in the explorer now render `<MiniSparkline>` trend indicators capturing the last 10 price points polled from Hermes, degraded gracefully if the feed is loading.
- **Enhanced Gating in Admin Console**: The Admin Panel creation form dynamically toggles oracle configurations based on whether the selected category is oracle-backed. Selecting a price-backed asset automatically fills in feed parameters and categorization values.

---

## 2. Oracle vs. Manual Categories & Rationale

### Oracle-Settleable Categories
- **`Crypto` (0)**, **`Tech` (3)**, and **`Other` (4)** (Metals, Commodities, FX).
- **Why**: These categories represent financial and asset markets that have continuous, high-precision price data feeds provided by the Pyth Network (e.g., BTC/USD, TSLA/USD, XAU/USD). They can be resolved securely on-chain by pulling signed price packets directly from Pyth.

### Manual-Only Categories
- **`Sports` (1)** and **`Politics` (2)**.
- **Why**: Pyth is a **price oracle only**. It does not support event outcomes, election results, sports scores, or external real-world indices. These categories must remain manually settled by a multi-signature verified platform administrator once official results are finalized.

---

## 3. Environment Configurations
The application uses the following environment variables (stored in `app/.env.local` or production settings):

| Variable Name | Description | Default Value |
| --- | --- | --- |
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Solana cluster endpoint | `http://127.0.0.1:8899` (Localnet) or `https://api.devnet.solana.com` |
| `NEXT_PUBLIC_PROGRAM_ID` | Deployed address of the SOLPredict contract | `6LRXkhVNdLdFtVYE2LHyVd2Zhjn2FreKEJNSgq4YKKT5` |
| `NEXT_PUBLIC_PYTH_PROGRAM_ID` | Pyth Solana receiver contract address | `rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ` |

---

## 4. Registering a New Price Feed Asset
To register a new oracle asset to the system:

1. Locate the asset feed on Pyth (https://pyth.network/price-feeds).
2. Copy the **Price Feed ID (Hex)** (e.g. `0xe62df6c8b4a85fe...`).
3. Add a new key-value entry to the `PYTH_FEED_REGISTRY` mapping in [app/src/lib/pyth-feeds.ts](file:///home/selva/solana_projects/solpredict/app/src/lib/pyth-feeds.ts):
```typescript
"SOL/USD": {
  symbol: "SOL/USD",
  label: "Solana",
  feedIdHex: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
  category: "Crypto", // "Crypto" | "Tech" | "Other"
  expo: -8 // Correct decimals exponent from Pyth
}
```
4. Rebuild the application (`npm run build`). The asset will immediately appear in the admin creation dropdown list and populate constraints automatically.
