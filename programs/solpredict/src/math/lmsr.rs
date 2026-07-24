use crate::errors::SolPredictError;

/// B parameter (liquidity parameter) in lamports.
/// Controls how deep the liquidity pool is. Higher B = less slippage.
/// 100 SOL = 100_000_000_000 lamports gives reasonable slippage for prediction markets.
pub const DEFAULT_B: u128 = 100_000_000_000; // 100 SOL

/// Precision for fixed-point arithmetic (9 decimals matches lamports).
pub const PRECISION: u128 = 1_000_000_000;

/// Compute exp(x) for x scaled by PRECISION.
/// Uses Taylor series with proper fixed-point scaling: term_n = term_{n-1} * x / (n * PRECISION)
pub fn exp_scaled(x: i128) -> Result<u128, SolPredictError> {
    let mut result: i128 = PRECISION as i128;
    let mut term: i128 = PRECISION as i128;

    for k in 1..=12 {
        term = term
            .checked_mul(x)
            .ok_or(SolPredictError::MathOverflow)?
            .checked_div((k as i128).checked_mul(PRECISION as i128).ok_or(SolPredictError::MathOverflow)?)
            .ok_or(SolPredictError::MathOverflow)?;
        result = result
            .checked_add(term)
            .ok_or(SolPredictError::MathOverflow)?;
    }

    if result <= 0 {
        return Err(SolPredictError::MathOverflow);
    }

    u128::try_from(result).map_err(|_| SolPredictError::MathOverflow)
}

/// Compute ln(x) for x > 0 scaled by PRECISION.
/// Uses natural log approximation.
pub fn ln_scaled(x: u128) -> Result<i128, SolPredictError> {
    if x == 0 {
        return Err(SolPredictError::MathOverflow);
    }

    // Convert to f64 for ln computation, then back to fixed-point
    // This is a reasonable trade-off for a Solana program since the
    // Solana runtime supports f64 operations.
    let x_f64 = x as f64 / PRECISION as f64;
    if x_f64 <= 0.0 {
        return Err(SolPredictError::MathOverflow);
    }
    let ln_f64 = x_f64.ln();
    Ok((ln_f64 * PRECISION as f64) as i128)
}

/// Cost function: C(q) = b * ln(exp(q_yes/b) + exp(q_no/b))
/// Returns the total cost in lamports for the given quantities.
pub fn cost_function(b: u128, q_yes: u128, q_no: u128) -> Result<u128, SolPredictError> {
    let exp_yes = exp_scaled((q_yes as i128)
        .checked_mul(PRECISION as i128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(b as i128)
        .ok_or(SolPredictError::MathOverflow)?)?;

    let exp_no = exp_scaled((q_no as i128)
        .checked_mul(PRECISION as i128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(b as i128)
        .ok_or(SolPredictError::MathOverflow)?)?;

    let sum = exp_yes
        .checked_add(exp_no)
        .ok_or(SolPredictError::MathOverflow)?;

    let ln_sum = ln_scaled(sum)?;

    let cost = (ln_sum as u128)
        .checked_mul(b)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(PRECISION)
        .ok_or(SolPredictError::MathOverflow)?;

    Ok(cost)
}

/// Cost to buy `delta` shares of YES.
/// Returns the additional cost in lamports.
pub fn buy_cost_yes(
    b: u128,
    q_yes: u128,
    q_no: u128,
    delta: u128,
) -> Result<u128, SolPredictError> {
    let cost_before = cost_function(b, q_yes, q_no)?;
    let cost_after = cost_function(b, q_yes.checked_add(delta).ok_or(SolPredictError::MathOverflow)?, q_no)?;

    cost_after
        .checked_sub(cost_before)
        .ok_or(SolPredictError::MathOverflow)
}

/// Cost to buy `delta` shares of NO.
pub fn buy_cost_no(
    b: u128,
    q_yes: u128,
    q_no: u128,
    delta: u128,
) -> Result<u128, SolPredictError> {
    let cost_before = cost_function(b, q_yes, q_no)?;
    let cost_after = cost_function(b, q_yes, q_no.checked_add(delta).ok_or(SolPredictError::MathOverflow)?)?;

    cost_after
        .checked_sub(cost_before)
        .ok_or(SolPredictError::MathOverflow)
}

/// Return from selling `delta` shares of YES.
/// Returns the refund in lamports.
pub fn sell_return_yes(
    b: u128,
    q_yes: u128,
    q_no: u128,
    delta: u128,
) -> Result<u128, SolPredictError> {
    if delta > q_yes {
        return Err(SolPredictError::InsufficientShares);
    }

    let cost_before = cost_function(b, q_yes, q_no)?;
    let new_yes = q_yes.checked_sub(delta).ok_or(SolPredictError::MathOverflow)?;
    let cost_after = cost_function(b, new_yes, q_no)?;

    cost_before
        .checked_sub(cost_after)
        .ok_or(SolPredictError::MathOverflow)
}

/// Return from selling `delta` shares of NO.
pub fn sell_return_no(
    b: u128,
    q_yes: u128,
    q_no: u128,
    delta: u128,
) -> Result<u128, SolPredictError> {
    if delta > q_no {
        return Err(SolPredictError::InsufficientShares);
    }

    let cost_before = cost_function(b, q_yes, q_no)?;
    let new_no = q_no.checked_sub(delta).ok_or(SolPredictError::MathOverflow)?;
    let cost_after = cost_function(b, q_yes, new_no)?;

    cost_before
        .checked_sub(cost_after)
        .ok_or(SolPredictError::MathOverflow)
}

/// Current YES probability in basis points (0-10000).
/// p_yes = exp(q_yes/b) / (exp(q_yes/b) + exp(q_no/b))
pub fn probability_yes_bps(
    b: u128,
    q_yes: u128,
    q_no: u128,
) -> Result<u16, SolPredictError> {
    let exp_yes = exp_scaled((q_yes as i128)
        .checked_mul(PRECISION as i128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(b as i128)
        .ok_or(SolPredictError::MathOverflow)?)?;

    let exp_no = exp_scaled((q_no as i128)
        .checked_mul(PRECISION as i128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(b as i128)
        .ok_or(SolPredictError::MathOverflow)?)?;

    let total = exp_yes
        .checked_add(exp_no)
        .ok_or(SolPredictError::MathOverflow)?;

    if total == 0 {
        return Ok(5000); // 50% default
    }

    let bps = exp_yes
        .checked_mul(10_000)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(total)
        .ok_or(SolPredictError::MathOverflow)?;

    let bps_u16 = u16::try_from(bps).unwrap_or(5000);
    Ok(bps_u16.min(9999).max(1))
}

/// Current NO probability in basis points.
pub fn probability_no_bps(
    b: u128,
    q_yes: u128,
    q_no: u128,
) -> Result<u16, SolPredictError> {
    let yes_bps = probability_yes_bps(b, q_yes, q_no)?;
    Ok(10000u16.saturating_sub(yes_bps))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_exp_small() {
        let result = exp_scaled(0).unwrap();
        assert_eq!(result, PRECISION); // exp(0) = 1.0
    }

    #[test]
    fn test_exp_positive() {
        let result = exp_scaled(PRECISION as i128).unwrap(); // exp(1.0)
        let expected = (std::f64::consts::E * PRECISION as f64) as u128;
        let diff = if result > expected { result - expected } else { expected - result };
        assert!(diff < PRECISION / 100, "exp(1) too far off: {} vs {}", result, expected);
    }

    #[test]
    fn test_probability_equal() {
        // When q_yes == q_no, probability should be ~50%
        let b = 100_000_000_000u128;
        let q = 50_000_000_000u128;
        let p = probability_yes_bps(b, q, q).unwrap();
        assert!((p as i16 - 5000).abs() < 100, "Expected ~50%, got {}%", p as f64 / 100.0);
    }

    #[test]
    fn test_probability_biased() {
        let b = 100_000_000_000u128;
        // YES has twice the pool of NO
        let p = probability_yes_bps(b, 100_000_000_000u128, 50_000_000_000u128).unwrap();
        assert!(p > 5000, "YES should be > 50% when pool is larger");
    }

    #[test]
    fn test_buy_cost_positive() {
        let b = 100_000_000_000u128;
        let cost = buy_cost_yes(b, 50_000_000_000u128, 50_000_000_000u128, 1_000_000u128).unwrap();
        assert!(cost > 0, "Buying shares should cost SOMETHING");
    }

    #[test]
    fn test_sell_return_less_than_buy() {
        let b = 100_000_000_000u128;
        let q_yes = 50_000_000_000u128;
        let q_no = 50_000_000_000u128;
        let delta = 1_000_000u128;

        let buy = buy_cost_yes(b, q_yes, q_no, delta).unwrap();
        let sell_return = sell_return_yes(b, q_yes + delta, q_no, delta).unwrap();

        // Sell return should be <= buy cost (spread = AMM fee)
        assert!(sell_return <= buy, "Sell return should be <= buy cost: {} vs {}", sell_return, buy);
    }

    #[test]
    fn test_large_quantities_no_overflow() {
        let b = 1_000_000_000_000u128; // 1000 SOL
        let q_yes = 500_000_000_000u128;
        let q_no = 500_000_000_000u128;
        let delta = 100_000_000_000u128; // 100 SOL worth of shares

        let cost = buy_cost_yes(b, q_yes, q_no, delta);
        assert!(cost.is_ok(), "Large quantity should not overflow");
    }

    #[test]
    fn test_symmetric_costs() {
        let b = 100_000_000_000u128;
        let q_yes = 50_000_000_000u128;
        let q_no = 50_000_000_000u128;

        let cost_yes = buy_cost_yes(b, q_yes, q_no, 1_000_000u128).unwrap();
        let cost_no = buy_cost_no(b, q_yes, q_no, 1_000_000u128).unwrap();

        // When pools are equal, buying YES and NO should cost the same
        let diff = if cost_yes > cost_no { cost_yes - cost_no } else { cost_no - cost_yes };
        assert!(diff < 1000, "Symmetric costs differ: {} vs {}", cost_yes, cost_no);
    }
}