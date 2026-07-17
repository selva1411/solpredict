export interface PythFeedEntry {
  symbol: string;
  label: string;
  feedIdHex: string;
  category: "Crypto" | "Tech" | "Other";
  expo: number;
}

export const PYTH_FEED_REGISTRY: Record<string, PythFeedEntry> = {
  // --- Crypto Category ---
  "SOL/USD": {
    symbol: "SOL/USD",
    label: "Solana",
    feedIdHex: "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d",
    category: "Crypto",
    expo: -8
  },
  "BTC/USD": {
    symbol: "BTC/USD",
    label: "Bitcoin",
    feedIdHex: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
    category: "Crypto",
    expo: -8
  },
  "ETH/USD": {
    symbol: "ETH/USD",
    label: "Ethereum",
    feedIdHex: "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace",
    category: "Crypto",
    expo: -8
  },
  "BONK/USD": {
    symbol: "BONK/USD",
    label: "Bonk",
    feedIdHex: "0x72b021217ca3fe68922a19aaf990109cb9d84e9ad004b4d2025ad6f529314419",
    category: "Crypto",
    expo: -8
  },
  "JUP/USD": {
    symbol: "JUP/USD",
    label: "Jupiter",
    feedIdHex: "0x0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996",
    category: "Crypto",
    expo: -8
  },
  "DOGE/USD": {
    symbol: "DOGE/USD",
    label: "Dogecoin",
    feedIdHex: "0xdcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c",
    category: "Crypto",
    expo: -8
  },
  "LINK/USD": {
    symbol: "LINK/USD",
    label: "Chainlink",
    feedIdHex: "0x8ac0c70fff57e9aefdf5edf44b51d62c2d433653cbb2cf5cc06bb115af04d221",
    category: "Crypto",
    expo: -8
  },
  "WIF/USD": {
    symbol: "WIF/USD",
    label: "dogwifhat",
    feedIdHex: "0x4ca4beeca86f0d164160323817a4e42b10010a724c2217c6ee41b54cd4cc61fc",
    category: "Crypto",
    expo: -8
  },
  "PYTH/USD": {
    symbol: "PYTH/USD",
    label: "Pyth Network",
    feedIdHex: "0x0bbf28e9a841a1cc788f6a361b17ca072d0ea3098a1e5df1c3922d06719579ff",
    category: "Crypto",
    expo: -8
  },
  "RENDER/USD": {
    symbol: "RENDER/USD",
    label: "Render Token",
    feedIdHex: "0x3d4a2bd9535be6ce8059d75eadeba507b043257321aa544717c56fa19b49e35d",
    category: "Crypto",
    expo: -8
  },

  // --- Tech Category (Equities) ---
  "NVDA/USD": {
    symbol: "NVDA/USD",
    label: "NVIDIA",
    feedIdHex: "0xb1073854ed24cbc755dc527418f52b7d271f6cc967bbf8d8129112b18860a593",
    category: "Tech",
    expo: -8
  },
  "AAPL/USD": {
    symbol: "AAPL/USD",
    label: "Apple",
    feedIdHex: "0x49f6b65cb1de6b10eaf75e7c03ca029c306d0357e91b5311b175084a5ad55688",
    category: "Tech",
    expo: -8
  },
  "TSLA/USD": {
    symbol: "TSLA/USD",
    label: "Tesla",
    feedIdHex: "0x16dad506d7db8da01c87581c87ca897a012a153557d4d578c3b9c9e1bc0632f1",
    category: "Tech",
    expo: -8
  },
  "MSFT/USD": {
    symbol: "MSFT/USD",
    label: "Microsoft",
    feedIdHex: "0xd0ca23c1cc005e004ccf1db5bf76aeb6a49218f43dac3d4b275e92de12ded4d1",
    category: "Tech",
    expo: -8
  },
  "GOOGL/USD": {
    symbol: "GOOGL/USD",
    label: "Google",
    feedIdHex: "0x5a48c03e9b9cb337801073ed9d166817473697efff0d138874e0f6a33d6d5aa6",
    category: "Tech",
    expo: -8
  },
  "AMZN/USD": {
    symbol: "AMZN/USD",
    label: "Amazon",
    feedIdHex: "0xb5d0e0fa58a1f8b81498ae670ce93c872d14434b72c364885d4fa1b257cbb07a",
    category: "Tech",
    expo: -8
  },
  "META/USD": {
    symbol: "META/USD",
    label: "Meta Platforms",
    feedIdHex: "0x78a3e3b8e676a8f73c439f5d749737034b139bbbe899ba5775216fba596607fe",
    category: "Tech",
    expo: -8
  },

  // --- FX / Metals / Commodities (Other Category) ---
  "EUR/USD": {
    symbol: "EUR/USD",
    label: "Euro / US Dollar",
    feedIdHex: "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
    category: "Other",
    expo: -8
  },
  "XAU/USD": {
    symbol: "XAU/USD",
    label: "Gold Spot",
    feedIdHex: "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
    category: "Other",
    expo: -8
  },
  "XAG/USD": {
    symbol: "XAG/USD",
    label: "Silver Spot",
    feedIdHex: "0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e",
    category: "Other",
    expo: -8
  },
  "WTI/USD": {
    symbol: "WTI/USD",
    label: "WTI Crude Oil",
    feedIdHex: "0x05e7c9b556df67e455c52ea2d31658744e3f4ade60db7dab887008844f2ae472",
    category: "Other",
    expo: -8
  }
};

export function feedIdBytesToHex(feedId: number[] | Uint8Array): string {
  const arr = Array.from(feedId);
  return "0x" + arr.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function lookupFeedEntry(feedIdHex: string): PythFeedEntry | undefined {
  const normalized = feedIdHex.toLowerCase();
  return Object.values(PYTH_FEED_REGISTRY).find(
    (entry) =>
      normalized.includes(entry.feedIdHex.slice(2).toLowerCase()) ||
      entry.feedIdHex.toLowerCase().includes(normalized)
  );
}

export function isOracleCategory(category: number): boolean {
  return category === 0 || category === 3 || category === 4;
}
