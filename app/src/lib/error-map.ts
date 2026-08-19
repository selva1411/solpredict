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
