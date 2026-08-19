use anchor_lang::prelude::*;

// ============================================================================
// PDA Seeds — every seed used for PDA derivation across the program.
// Frontend's lib/pda.ts MUST mirror these byte-for-byte.
// ============================================================================

#[constant]
pub const CONFIG_SEED: &[u8] = b"config";

#[constant]
pub const MARKET_SEED: &[u8] = b"market";

#[constant]
pub const TREASURY_SEED: &[u8] = b"treasury";

#[constant]
pub const POSITION_SEED: &[u8] = b"position";

#[constant]
pub const YES_MINT_SEED: &[u8] = b"yes_mint";

#[constant]
pub const NO_MINT_SEED: &[u8] = b"no_mint";

#[constant]
pub const ORDER_SEED: &[u8] = b"order";
/// Seed for the data-less SOL escrow PDA backing limit BUY orders. Buy orders
/// escrow lamports on a plain system account (no data) so fill/cancel can move
/// them with a CPI system transfer — the system program refuses to debit a
/// data-carrying account, and a program cannot directly credit a system-owned
/// one.
pub const ORDER_ESCROW_SEED: &[u8] = b"order_escrow";

#[constant]
pub const LP_SEED: &[u8] = b"lp";

#[constant]
pub const PAUSE_SEED: &[u8] = b"emergency_pause";

#[constant]
pub const PROPOSAL_SEED: &[u8] = b"proposal";

#[constant]
pub const PROPOSAL_VAULT_SEED: &[u8] = b"proposal_vault";

// ============================================================================
// Market Constraints
// ============================================================================

/// Maximum length for a market question (characters, not bytes — but for ASCII
/// the difference is negligible; Anchor's String serialization uses 4-byte
/// length prefix + UTF-8 bytes).
pub const MAX_QUESTION_LEN: usize = 200;

/// Maximum length for a market description / settlement rules text.
pub const MAX_DESCRIPTION_LEN: usize = 400;

/// Maximum fee in basis points (1000 = 10%). Prevents admin from setting
/// an unreasonably high fee that would disincentivize participation.
pub const MAX_FEE_BPS: u16 = 1000;

/// Minimum share price in lamports (1_000_000 = 0.001 SOL).
/// Prevents dust-amount markets that waste compute and storage.
pub const MIN_SHARE_PRICE: u64 = 1_000_000;

/// Maximum shares purchasable in a single transaction.
/// Prevents overflow-crafting attacks where quantity * share_price > u64::MAX.
pub const MAX_SHARES_PER_TX: u64 = 1_000_000;

/// Precision scaling factor for fixed-point math (1e9).
pub const PRECISION: u64 = 1_000_000_000;

/// Token decimals for YES/NO SPL token mints.
/// 1 share = 10^6 base units (matching SOL's lamport scale for mental math).
pub const SHARE_DECIMALS: u8 = 6;

/// Base units per share: 10^SHARE_DECIMALS = 1_000_000.
pub const BASE_UNITS_PER_SHARE: u64 = 1_000_000;

// ============================================================================
// Oracle Constraints
// ============================================================================

/// Maximum age (in seconds) for a Pyth price update to be considered valid.
/// 60 seconds is conservative — Pyth typically publishes every ~400ms.
pub const MAX_STALENESS_SECS: u64 = 60;

/// Maximum confidence-to-price ratio (as a percentage integer).
/// If conf/price > 2%, we reject the oracle reading as too uncertain.
pub const MAX_CONF_PCT: u64 = 2;

// ============================================================================
// SOL/USD Feed ID — Pyth Network
// Verified from: https://pyth.network/developers/price-feed-ids
// Date verified: 2026-07-14
// Same feed ID on mainnet and devnet.
// ============================================================================
pub const SOL_USD_FEED_ID: [u8; 32] = [
    0xef, 0x0d, 0x8b, 0x6f, 0xda, 0x2c, 0xeb, 0xa4,
    0x1d, 0xa1, 0x5d, 0x40, 0x95, 0xd1, 0xda, 0x39,
    0x2a, 0x0d, 0x2f, 0x8e, 0xd0, 0xc6, 0xc7, 0xbc,
    0x0f, 0x4c, 0xfa, 0xc8, 0xc2, 0x80, 0xb5, 0x6d,
];
