use anchor_lang::prelude::*;
use borsh::{BorshDeserialize, BorshSerialize};

use crate::constants::MAX_CONF_PCT;
use crate::errors::SolPredictError;
use crate::state::Comparison;

/// Local definitions for Pyth receiver SDK types to resolve version conflicts.
#[derive(BorshDeserialize, BorshSerialize, Clone, Copy, Debug, PartialEq)]
pub enum VerificationLevel {
    Partial { num_signatures: u8 },
    Full,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
pub struct PriceFeedMessage {
    pub feed_id: [u8; 32],
    pub price: [u8; 8],        // Big-endian i64
    pub conf: [u8; 8],         // Big-endian u64
    pub exponent: [u8; 4],     // Big-endian i32
    pub publish_time: [u8; 8], // Big-endian i64
    pub prev_publish_time: [u8; 8], // Big-endian i64
    pub ema_price: [u8; 8],    // Big-endian i64
    pub ema_conf: [u8; 8],     // Big-endian u64
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
pub struct PriceUpdateV2 {
    pub write_authority: Pubkey,
    pub verification_level: VerificationLevel,
    pub price_message: PriceFeedMessage,
    pub posted_slot: u64,
}

/// Result of reading and validating a Pyth oracle price.
pub struct ValidatedPrice {
    pub price: i64,
    pub expo: i32,
}

/// Parse and validate a Pyth PriceUpdateV2 account from raw account info.
///
/// Enforces on-chain validation:
/// 1. Staleness check
/// 2. Feed identity check
/// 3. Confidence interval check
pub fn validate_and_read_price(
    price_update_info: &AccountInfo,
    clock: &Clock,
    oracle_feed_id: &[u8; 32],
    max_staleness_secs: u64,
) -> Result<ValidatedPrice> {
    // 1. Verify owner is either the Pyth Solana Receiver, or (in test mode) our program / System Program
    let pyth_receiver = pubkey!("rec5EKMGg6MxZYaMdyBfgwp4d5rB9T1VQH5pJv5LtFJ");
    let is_valid_owner = price_update_info.owner == &pyth_receiver
        || (cfg!(feature = "test-only") && (
            price_update_info.owner == &crate::ID
            || price_update_info.owner == &anchor_lang::prelude::System::id()
        ));
    require!(is_valid_owner, SolPredictError::InvalidOracleFeed);

    let data = price_update_info.try_borrow_data()?;

    // Account data must contain at least the 8-byte Anchor discriminator
    if data.len() < 8 {
        return err!(SolPredictError::StaleOracle);
    }

    // Deserialize manually from offset 8
    let price_update: PriceUpdateV2 = PriceUpdateV2::deserialize(&mut &data[8..])
        .map_err(|_| error!(SolPredictError::StaleOracle))?;

    let message = &price_update.price_message;

    // Verify Feed ID matches the market configuration
    require!(
        message.feed_id == *oracle_feed_id,
        SolPredictError::InvalidOracleFeed
    );

    // Extract big-endian values from message fields
    let price = i64::from_be_bytes(message.price);
    let conf = u64::from_be_bytes(message.conf);
    let expo = i32::from_be_bytes(message.exponent);
    let publish_time = i64::from_be_bytes(message.publish_time);

    // Verify Staleness: publish_time must be within max_staleness_secs of current slot time
    let age = clock.unix_timestamp.saturating_sub(publish_time);
    require!(
        age >= 0 && (age as u64) <= max_staleness_secs,
        SolPredictError::StaleOracle
    );

    // Confidence check: conf / |price| must be < MAX_CONF_PCT%
    // Integer math: conf * 100 < |price| * MAX_CONF_PCT
    let price_abs = (price as i128).unsigned_abs();
    let conf_u128 = conf as u128;

    let conf_scaled = conf_u128
        .checked_mul(100)
        .ok_or(SolPredictError::MathOverflow)?;
    let price_threshold = price_abs
        .checked_mul(MAX_CONF_PCT as u128)
        .ok_or(SolPredictError::MathOverflow)?;

    require!(
        conf_scaled < price_threshold,
        SolPredictError::LowOracleConfidence
    );

    Ok(ValidatedPrice { price, expo })
}

/// Compare an oracle price against a target price, handling different exponents.
pub fn compare_prices(
    oracle_price: i64,
    oracle_expo: i32,
    target_price: i64,
    target_expo: i32,
    comparison: Comparison,
) -> Result<bool> {
    let oracle_price_i128 = oracle_price as i128;
    let target_price_i128 = target_price as i128;

    let (oracle_scaled, target_scaled) = if oracle_expo < target_expo {
        // Oracle has more precision (more negative exponent)
        // Scale target UP to match oracle's precision
        let diff = (target_expo - oracle_expo) as u32;
        let scale = 10i128
            .checked_pow(diff)
            .ok_or(SolPredictError::MathOverflow)?;
        let target_up = target_price_i128
            .checked_mul(scale)
            .ok_or(SolPredictError::MathOverflow)?;
        (oracle_price_i128, target_up)
    } else if oracle_expo > target_expo {
        // Target has more precision
        // Scale oracle UP to match target's precision
        let diff = (oracle_expo - target_expo) as u32;
        let scale = 10i128
            .checked_pow(diff)
            .ok_or(SolPredictError::MathOverflow)?;
        let oracle_up = oracle_price_i128
            .checked_mul(scale)
            .ok_or(SolPredictError::MathOverflow)?;
        (oracle_up, target_price_i128)
    } else {
        // Same exponent — compare directly
        (oracle_price_i128, target_price_i128)
    };

    let condition_met = match comparison {
        Comparison::GreaterThan => oracle_scaled > target_scaled,
        Comparison::LessThan => oracle_scaled < target_scaled,
    };

    Ok(condition_met)
}
