use anchor_lang::prelude::*;

/// Complete error enum for the SOLPredict program.
/// Every variant here has a corresponding friendly string in the frontend's
/// `app/src/lib/error-map.ts`. Never show raw Anchor error codes to users.
#[error_code]
pub enum SolPredictError {
    #[msg("Only the program admin can perform this action")]
    Unauthorized,                // 6000

    #[msg("Market is not open for trading")]
    MarketNotOpen,               // 6001

    #[msg("Market trading period has expired")]
    MarketExpired,               // 6002

    #[msg("Market has already been settled")]
    AlreadySettled,              // 6003

    #[msg("Market cannot be settled before resolve_ts")]
    TooEarlyToSettle,            // 6004

    #[msg("Market has not been settled yet")]
    MarketNotSettled,            // 6005

    #[msg("Market is not in cancelled state")]
    MarketNotCancelled,          // 6006

    #[msg("Rewards already claimed for this position")]
    AlreadyClaimed,              // 6007

    #[msg("No winning tokens to claim")]
    NothingToClaim,              // 6008

    #[msg("Oracle price is too stale")]
    StaleOracle,                 // 6009

    #[msg("Oracle feed does not match market's configured feed")]
    InvalidOracleFeed,           // 6010

    #[msg("Oracle price confidence interval too wide")]
    LowOracleConfidence,         // 6011

    #[msg("Arithmetic overflow or underflow detected")]
    MathOverflow,                // 6012

    #[msg("Quantity must be greater than zero and within limits")]
    InvalidQuantity,             // 6013

    #[msg("Question text exceeds maximum length")]
    QuestionTooLong,             // 6014

    #[msg("Description text exceeds maximum length")]
    DescriptionTooLong,          // 6015

    #[msg("End time must be in the future")]
    InvalidEndTime,              // 6016

    #[msg("Share price is below the minimum allowed")]
    SharePriceTooLow,            // 6017

    #[msg("Treasury balance insufficient for payout")]
    TreasuryInsufficient,        // 6018

    #[msg("Fee percentage exceeds maximum allowed (10%)")]
    FeeTooHigh,                  // 6019

    #[msg("Protocol fee has already been withdrawn")]
    FeeAlreadyWithdrawn,         // 6020

    #[msg("Price-backed markets must use settle_market with oracle price feed")]
    UseOracleSettlement,

    #[msg("Invalid outcome: must be 1 (Yes) or 2 (No)")]
    InvalidOutcome,

    #[msg("Markets without a price feed must use settle_market_manual")]
    UseManualSettlement,

    #[msg("Market has not ended yet")]
    MarketNotEnded,

    #[msg("User did not win this market")]
    NotAWinner,

    #[msg("Insufficient shares to claim")]
    InsufficientShares,

    #[msg("Invalid market ID")]
    InvalidMarket,

    #[msg("Crypto markets must use oracle settlement")]
    CryptoMustUseOracle,

    #[msg("No fees to withdraw")]
    NoFeesToWithdraw,
}
