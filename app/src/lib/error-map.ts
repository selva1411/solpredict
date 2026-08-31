export const ERROR_MAP: Record<string, string> = {
  "Unauthorized": "Only the program admin can perform this action",
  "MarketNotOpen": "Market is not open for trading",
  "MarketExpired": "Market trading period has expired",
  "AlreadySettled": "Market has already been settled",
  "TooEarlyToSettle": "Market cannot be settled before resolve_ts",
  "MarketNotSettled": "Market has not been settled yet",
  "MarketNotCancelled": "Market is not in cancelled state",
  "AlreadyClaimed": "Rewards already claimed for this position",
  "NothingToClaim": "No winning tokens to claim",
  "StaleOracle": "Oracle price is too stale",
  "InvalidOracleFeed": "Oracle feed does not match market's configured feed",
  "LowOracleConfidence": "Oracle price confidence interval too wide",
  "MathOverflow": "Arithmetic overflow or underflow detected",
  "InvalidQuantity": "Quantity must be greater than zero and within limits",
  "QuestionTooLong": "Question text exceeds maximum length",
  "DescriptionTooLong": "Description text exceeds maximum length",
  "InvalidEndTime": "End time must be in the future",
  "SharePriceTooLow": "Share price is below the minimum allowed",
  "TreasuryInsufficient": "Treasury balance insufficient for payout",
  "FeeTooHigh": "Fee percentage exceeds maximum allowed (10%)",
  "FeeAlreadyWithdrawn": "Protocol fee has already been withdrawn",
  "AlreadyPaused": "Emergency pause is already active",
  "NotPaused": "Emergency pause is not active",
  "EmergencyPaused": "Trading is halted — the market is under an emergency pause",
  "MultisigRequired": "Admin operation requires multisig approval",
  "InvalidGuardian": "Guardian pubkey is invalid (cannot be the zero address)",
  "GuardianAlreadyExists": "Guardian is already registered",
  "MaxGuardiansReached": "Maximum number of guardians reached (3)",
  "GuardianNotFound": "Guardian not found in the set",
  "InvalidThreshold": "Threshold must be between 1 and the number of registered guardians",
  "ThresholdExceedsGuardians": "Cannot remove guardian: required confirmations exceed remaining guardians",
  "InvalidMint": "Token mint does not match this market",
  "UseOracleSettlement": "Price-backed markets must be settled with the oracle",
  "InvalidOutcome": "Invalid outcome — must be YES or NO",
  "UseManualSettlement": "Non-price markets must be settled manually",
  "MarketNotEnded": "Market has not ended yet",
  "NotAWinner": "You did not win this market",
  "InsufficientShares": "You don't have enough shares for this action",
  "InvalidMarket": "Invalid or unknown market",
  "CryptoMustUseOracle": "Crypto markets must use the Pyth oracle for settlement",
  "NoFeesToWithdraw": "No protocol fees are available to withdraw",
  "InvalidPriceBps": "Limit price must be between 1 and 9999 basis points",
  "OrderAlreadyFilled": "Order has already been filled",
  "OrderCancelled": "Order has already been cancelled",
  "SelfTradingNotAllowed": "You cannot fill your own order",
  "EndTimeTooSoon": "End time must be at least one hour away",
  "EndTimeTooFar": "End time cannot be more than one year away",
  "ResolveTooSoon": "Resolution time must be at or after the market end time",
  "InvalidQuestion": "Question must be 10–200 characters",
  "InvalidDescription": "Description must be 400 characters or fewer",
  "EmptyPool": "Liquidity pool is empty — add liquidity first",
  "BettingClosed": "Betting period has ended for this market",
  "InsufficientFunds": "Insufficient funds for this operation",
  "AlreadyInitialized": "Program config is already initialized",
  "NothingToRefund": "There is nothing to refund on this position",
  "OutcomeNotSet": "Winning outcome has not been set yet",
  "ZeroSupply": "No winning shares in circulation",
  "ZeroPayout": "Payout calculated to zero — nothing to claim",
  "OracleFeedMismatch": "Oracle price feed does not match this market",
  "UsePythForCrypto": "Crypto markets must settle via the Pyth oracle",
  "MarketPaused": "Market is temporarily paused for maintenance",
  "ReentrancyDetected": "Reentrancy detected — please try again",
  "InsufficientLiquidity": "Not enough liquidity in the pool for this trade",
  "LiquidityPositionNotFound": "No liquidity position found for this wallet",
  "NoLpTokens": "You have no LP tokens to withdraw",
  "SlippageExceeded": "Price moved more than your slippage tolerance — try again or widen tolerance",
  "MinSpendNotMet": "Minimum spend not met for this trade",
  "SignatureVerificationFailed": "Signature verification failed — please try again",
  "AlreadyCancelled": "Market has already been cancelled",
  "InvalidCategory": "Invalid market category",
  "ResolutionSourceMismatch": "Settlement source does not match market configuration",
  "BatchSizeExceeded": "Batch size exceeds the maximum allowed",
  "ProposalNotPending": "Proposal is not in pending state — it may already be approved or rejected",
  "ProposalBondTooLow": "Proposal bond is below the minimum required",
  "SharePriceImmutable": "Share price cannot be changed once set",
  "LpDepositTooSmall": "LP deposit must be at least 0.01 SOL",
  "PositionHasUnclaimedRewards": "Claim your rewards before closing this position",
};

export function getFriendlyErrorMessage(err: unknown): string {
  if (!err) return "Unknown error occurred";
  
  let msg = "Unknown error occurred";
  if (err instanceof Error) {
    msg = err.message;
  } else if (typeof err === "object" && err !== null && "message" in err) {
    msg = String((err as { message: unknown }).message);
  } else {
    msg = String(err);
  }
  
  // Try to find matching error key in ERROR_MAP
  for (const key of Object.keys(ERROR_MAP)) {
    if (msg.includes(key)) {
      return ERROR_MAP[key];
    }
  }
  
  // Check specific custom program error codes before generic patterns
  if (msg.includes("custom program error: 0x1783")) {
    return ERROR_MAP.FeeTooHigh;
  }
  if (msg.includes("custom program error: 0x177d")) {
    return ERROR_MAP.InvalidQuantity;
  }
  if (msg.includes("custom program error: 0x1774")) {
    return ERROR_MAP.TooEarlyToSettle;
  }
  if (msg.includes("custom program error: 0x1776")) {
    return ERROR_MAP.MarketNotSettled;
  }

  if (
    msg.includes("Attempt to debit an account") ||
    msg.includes("insufficient lamports") ||
    msg.includes("insufficient funds") ||
    msg.includes("Transaction results in an account (0) with insufficient funds")
  ) {
    return "Insufficient SOL in connected wallet for gas fees & position. Click '🪂 Airdrop SOL' in the header!";
  }

  // Check common anchor/wallet adapter errors
  if (msg.includes("User rejected the request")) {
    return "Transaction signature rejected by user.";
  }
  
  if (msg.includes("Account does not exist")) {
    return "Required account does not exist on-chain.";
  }
  
  return msg.length > 100 ? msg.substring(0, 100) + "..." : msg;
}
