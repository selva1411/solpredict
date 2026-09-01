use anchor_lang::prelude::*;
use crate::errors::SolPredictError;

const SCALE: u128 = 1_000_000_000_000;

/// Floor integer square root for u128 (Newton's method). The discriminant in
/// the constant-product formulas below never exceeds ~1e27 for real pool
/// sizes, so `r * r` cannot overflow u128 (2^128 >> 1e27).
fn isqrt(x: u128) -> u128 {
    if x < 2 {
        return x;
    }
    let mut r = x;
    while r > x / r {
        r = (r + x / r) / 2;
    }
    // Guard against floor-rounding edge cases at small values.
    while r > 0 && r * r > x {
        r -= 1;
    }
    while (r + 1) * (r + 1) <= x {
        r += 1;
    }
    r
}

/// Spot price of YES as a *probability* in fixed-point (SCALE).
///
/// price_yes = pool_yes / (pool_yes + pool_no)   ← documented formula
/// (`docs/program/00-design-decisions.md` §2). The pools hold the SOL committed
/// to each outcome; the fraction of total commitment backing YES IS the implied
/// probability. Returns 0 on an empty (0/0) pool — callers default to the flat
/// baseline price in that case.
pub fn get_spot_price_yes(pool_yes: u128, pool_no: u128, _fee_bps: u16) -> Result<u128> {
    let total = pool_yes.checked_add(pool_no).ok_or(SolPredictError::MathOverflow)?;
    if total == 0 {
        return Ok(0);
    }
    // The RAW probability: a trade's fee is a cost on the transaction, not a
    // reduction in probability. Subtracting it here broke the p_yes + p_no =
    // 1 invariant at any non-zero fee (both sides shrank by their own fee).
    // Fees belong to cost/refund quotes (get_buy_cost_in / get_sell_amount_out),
    // which already apply them. `_fee_bps` kept for call-site compatibility.
    let _ = _fee_bps;
    pool_yes
        .checked_mul(SCALE)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(total)
        .ok_or_else(|| error!(SolPredictError::MathOverflow))
}

/// Spot price of NO as a probability (mirror of get_spot_price_yes).
pub fn get_spot_price_no(pool_yes: u128, pool_no: u128, _fee_bps: u16) -> Result<u128> {
    let total = pool_yes.checked_add(pool_no).ok_or(SolPredictError::MathOverflow)?;
    if total == 0 {
        return Ok(0);
    }
    // Mirror of get_spot_price_yes — raw probability, no fee adjustment.
    let _ = _fee_bps;
    pool_no
        .checked_mul(SCALE)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(total)
        .ok_or_else(|| error!(SolPredictError::MathOverflow))
}

/// Cost (in lamports) to buy `dy_out`-value of the traded side.
///
/// Constant-product curve in *probability space*: buying YES of value `v`
/// credits `c` to the YES pool (one-sided pool model), so the post-trade
/// probability is `p' = (yes + c) / (yes + c + no)`. The buyer pays
/// `c = v * p'`, i.e. the shares are priced at the post-trade probability —
/// this gives correct slippage (buy pushes the price up) while keeping prices
/// in [0,1] and consistent with the displayed probability.
///
/// Solving `c = v·(yes+c)/(yes+c+no)` gives `c = [√((s−v)² + 4·v·yes) − (s−v)] / 2`
/// with `s = yes + no`.
///
/// For the NO side callers swap the pool arguments (same convention as the
/// handler). The gross cost is then grossed up by the fee.
pub fn get_buy_cost_in(
    pool_yes: u128,
    pool_no: u128,
    dy_out: u128,
    fee_bps: u16,
) -> Result<u128> {
    require!(dy_out > 0, SolPredictError::InvalidQuantity);

    let s = pool_yes
        .checked_add(pool_no)
        .ok_or(SolPredictError::MathOverflow)?;
    // One-sided pools price at the flat baseline (c = v), which the formula
    // reproduces naturally: with pool_no == 0 → c = v·(yes+v)/(yes+v) = v.
    // Handle trades larger than the total pool without signed underflow:
    // disc = (s−v)² + 4·v·yes, root = √disc ≥ |s−v|.
    let diff_sq = if s >= dy_out {
        let d = s - dy_out;
        d.checked_mul(d).ok_or(SolPredictError::MathOverflow)?
    } else {
        let d = dy_out - s;
        d.checked_mul(d).ok_or(SolPredictError::MathOverflow)?
    };
    let disc = diff_sq
        .checked_add(
            4u128
                .checked_mul(dy_out)
                .ok_or(SolPredictError::MathOverflow)?
                .checked_mul(pool_yes)
                .ok_or(SolPredictError::MathOverflow)?,
        )
        .ok_or(SolPredictError::MathOverflow)?;
    let root = isqrt(disc);
    // c = (root − (s−v)) / 2 with the sign of (s−v) handled explicitly.
    let c_gross = if s >= dy_out {
        root
            .checked_sub(s - dy_out)
            .ok_or(SolPredictError::MathOverflow)?
    } else {
        root
            .checked_add(dy_out - s)
            .ok_or(SolPredictError::MathOverflow)?
    }
    .checked_div(2)
    .ok_or(SolPredictError::MathOverflow)?;

    let divisor = 10_000u128.checked_sub(fee_bps as u128).ok_or(SolPredictError::MathOverflow)?;
    let dx_with_fee = c_gross
        .checked_mul(10_000)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(divisor)
        .ok_or(SolPredictError::MathOverflow)?;
    // Floor at 1 lamport: a longshot can price to ~0 in integer math, and
    // minting shares for 0 lamports would be a free-mint exploit.
    Ok(dx_with_fee.max(1))
}

/// Shares-value (in the pool's unit) bought for `dx_in` lamports. Exact inverse
/// of `get_buy_cost_in` (fee-adjusted both directions): `v = c·(c + yes + no) / (yes + c)`
/// where `c = dx_in` net of fee.
pub fn get_buy_amount_out(
    pool_yes: u128,
    pool_no: u128,
    dx_in: u128,
    fee_bps: u16,
) -> Result<u128> {
    require!(dx_in > 0, SolPredictError::InvalidQuantity);
    let fee = dx_in
        .checked_mul(fee_bps as u128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)?;
    let c = dx_in.checked_sub(fee).ok_or(SolPredictError::MathOverflow)?;

    let numerator = c
        .checked_mul(
            c.checked_add(pool_yes)
                .ok_or(SolPredictError::MathOverflow)?
                .checked_add(pool_no)
                .ok_or(SolPredictError::MathOverflow)?,
        )
        .ok_or(SolPredictError::MathOverflow)?;
    let denominator = pool_yes.checked_add(c).ok_or(SolPredictError::MathOverflow)?;
    if denominator == 0 {
        return Ok(0);
    }
    Ok(numerator.checked_div(denominator).ok_or(SolPredictError::MathOverflow)?)
}

/// Refund (lamports) for selling `dy_in`-value of the traded side.
///
/// Mirrors the buy curve: selling removes `r` from the YES pool, so the
/// post-trade probability is `p'' = (yes − r) / (yes − r + no)` and the seller
/// receives `r = v · p''`, i.e. `r = [(s+v) − √((s+v)² − 4·v·yes)] / 2` with `s = yes + no`.
///
/// The refund is always < the value sold (the pool keeps the spread) and is
/// capped below the pool. Fee is taken from the refund.
pub fn get_sell_amount_out(
    pool_yes: u128,
    pool_no: u128,
    dy_in: u128,
    fee_bps: u16,
) -> Result<u128> {
    require!(dy_in > 0, SolPredictError::InvalidQuantity);

    let s = pool_yes
        .checked_add(pool_no)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_add(dy_in)
        .ok_or(SolPredictError::MathOverflow)?;
    let disc = s
        .checked_mul(s)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_sub(
            4u128
                .checked_mul(dy_in)
                .ok_or(SolPredictError::MathOverflow)?
                .checked_mul(pool_yes)
                .ok_or(SolPredictError::MathOverflow)?,
        )
        .ok_or(SolPredictError::MathOverflow)?;
    // disc = (yes + no + v)² − 4·v·yes ≥ (yes + no − v)² ≥ 0 by AM-GM.
    let root = isqrt(disc);
    let r_gross = s
        .checked_sub(root)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(2)
        .ok_or(SolPredictError::MathOverflow)?;

    // Never refund more than the pool holds.
    let r_capped = r_gross.min(pool_yes.saturating_sub(1));
    let fee = r_capped
        .checked_mul(fee_bps as u128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)?;
    Ok(r_capped.checked_sub(fee).ok_or(SolPredictError::MathOverflow)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn symmetric_pools_price_at_fifty_percent() {
        let yes = 1_000_000u128;
        let no = 1_000_000u128;
        let fee = 0u16;
        let p_yes = get_spot_price_yes(yes, no, fee).unwrap();
        let p_no = get_spot_price_no(yes, no, fee).unwrap();
        // Probability basis: yes/(yes+no) = 0.5 and the two sides sum to 1.
        assert_eq!(p_yes, SCALE / 2);
        assert_eq!(p_no, SCALE / 2);
        assert_eq!(p_yes + p_no, SCALE);

    #[test]
    fn spot_prices_sum_to_one_at_nonzero_fee() {
        // Regression: the fee used to be subtracted from each side's
        // probability independently, so p_yes + p_no < 1 at any real fee.
        for fee in [30u16, 100u16, 300u16] {
            let yes = 4_000_000u128;
            let no = 6_000_000u128;
            let p_yes = get_spot_price_yes(yes, no, fee).unwrap();
            let p_no = get_spot_price_no(yes, no, fee).unwrap();
            assert_eq!(p_yes, SCALE * 40 / 100);
            assert_eq!(p_yes + p_no, SCALE);
        }
    }
    }

    #[test]
    fn imbalanced_pools_price_by_share_of_total() {
        let yes = 3_000_000u128;
        let no = 1_000_000u128;
        let p_yes = get_spot_price_yes(yes, no, 0).unwrap();
        assert_eq!(p_yes, SCALE * 3 / 4); // 75%
        let p_no = get_spot_price_no(yes, no, 0).unwrap();
        assert_eq!(p_no, SCALE / 4); // 25%
    }

    #[test]
    fn one_sided_pools_price_at_extremes() {
        assert_eq!(get_spot_price_yes(0, 1_000_000, 0).unwrap(), 0);
        assert_eq!(get_spot_price_yes(1_000_000, 0, 0).unwrap(), SCALE);
        assert_eq!(get_spot_price_no(1_000_000, 0, 0).unwrap(), 0);
        assert_eq!(get_spot_price_yes(0, 0, 0).unwrap(), 0);
    }

    #[test]
    fn buy_increases_price_sell_decreases() {
        let mut yes = 1_000_000u128;
        let mut no = 1_000_000u128;
        let fee = 30u16;
        let p0 = get_spot_price_yes(yes, no, fee).unwrap();

        let cost = get_buy_cost_in(yes, no, 100_000, fee).unwrap();
        let yes_after = yes.checked_add(cost).unwrap();
        let no_after = no;
        yes = yes_after;
        no = no_after;
        let p1 = get_spot_price_yes(yes, no, fee).unwrap();
        assert!(p1 > p0, "price must rise after buying YES");

        let refund = get_sell_amount_out(yes, no, 100_000, fee).unwrap();
        assert!(refund < cost, "treasury must keep the spread");
    }

    #[test]
    fn no_arbitrage_round_trip() {
        let yes = 1_000_000u128;
        let no = 1_000_000u128;
        let fee = 30u16;
        let cost = get_buy_cost_in(yes, no, 50_000, fee).unwrap();
        let new_yes = yes + cost;
        let new_no = no;
        let refund = get_sell_amount_out(new_yes, new_no, 50_000, fee).unwrap();
        assert!(refund < cost, "ARBITRAGE BUG: refund must be < cost");
    }

    #[test]
    fn asymmetric_pools() {
        let yes = 3_000_000u128;
        let no = 1_000_000u128;
        let fee = 50u16;

        let price = get_spot_price_yes(yes, no, fee).unwrap();
        assert!(price > 0, "price must be positive");
        assert!(price <= SCALE, "probability must never exceed 1");

        let cost = get_buy_cost_in(yes, no, 10_000, fee).unwrap();
        assert!(cost > 0, "cost must be positive");
        assert!(cost < 10_000, "cost must be below face value (pool is YES-favored)");

        let refund = get_sell_amount_out(yes, no, 10_000, fee).unwrap();
        assert!(refund < cost, "sell must be cheaper than buy");
    }

    #[test]
    fn large_quantities_no_overflow() {
        let yes = 100_000_000_000u128;
        let no = 100_000_000_000u128;
        let fee = 30u16;

        let cost = get_buy_cost_in(yes, no, 10_000_000, fee).unwrap();
        assert!(cost > 0);
        assert!(cost < 10_000_000, "cost below face value at balanced pools");

        let refund = get_sell_amount_out(yes + cost, no, 10_000_000, fee).unwrap();
        assert!(refund < cost);
    }

    #[test]
    fn zero_fee_round_trip_keeps_spread() {
        let yes = 1_000_000u128;
        let no = 1_000_000u128;
        let fee = 0u16;

        let cost = get_buy_cost_in(yes, no, 100_000, fee).unwrap();
        let new_yes = yes + cost;
        let refund = get_sell_amount_out(new_yes, no, 100_000, fee).unwrap();
        // Buying pushes the price up; selling at the (higher) post-buy pool
        // must still return strictly less than paid — no free round trip.
        assert!(refund < cost, "spread must prevent free round trips");
    }

    #[test]
    fn max_fee_bps() {
        let yes = 1_000_000u128;
        let no = 1_000_000u128;
        let fee = 5_000u16;
        let cost = get_buy_cost_in(yes, no, 100_000, fee).unwrap();
        assert!(cost > 0, "cost must be positive even at high fee");
        let refund = get_sell_amount_out(yes, no, 100_000, fee).unwrap();
        assert!(refund < cost, "at high fee, seller gets less than buyer paid");
    }

    #[test]
    fn extremely_imbalanced_pools() {
        let yes = 999_999_999_999u128;
        let no = 1u128;
        let fee = 30u16;
        let price = get_spot_price_yes(yes, no, fee).unwrap();
        assert!(price > 0 && price <= SCALE, "probability must be in (0,1]");
        let cost = get_buy_cost_in(yes, no, 1, fee).unwrap();
        assert!(cost >= 0, "cost must be non-negative for small buy");
    }

    #[test]
    fn buy_amount_out_consistency() {
        let yes = 10_000_000u128;
        let no = 10_000_000u128;
        let fee = 30u16;
        let cost = get_buy_cost_in(yes, no, 100_000, fee).unwrap();
        let dy = get_buy_amount_out(yes, no, cost, fee).unwrap();
        let diff = 100_000u128.max(dy) - 100_000u128.min(dy);
        // Integer-sqrt rounding can cost a couple of base units.
        assert!(diff <= 2, "buy_cost_in / buy_amount_out round trip diff={} > 2", diff);
    }

    #[test]
    fn symmetric_zero_start() {
        let yes = 10_000_000u128;
        let no = 10_000_000u128;
        let fee = 200u16;
        // Spot price is the RAW probability — the trade fee does not shift it
        // (fees apply to cost/refund quotes). Symmetric pools price at 50%
        // regardless of fee, and both sides still sum to 1.
        let spot = get_spot_price_yes(yes, no, fee).unwrap();
        assert_eq!(spot, SCALE / 2);
        let no_spot = get_spot_price_no(yes, no, fee).unwrap();
        assert_eq!(spot + no_spot, SCALE);
    }

    #[test]
    fn sell_entire_position() {
        let yes = 10_000_000u128;
        let no = 10_000_000u128;
        let fee = 30u16;
        let cost = get_buy_cost_in(yes, no, 9_000_000, fee).unwrap();
        let new_yes = yes + cost;
        let refund = get_sell_amount_out(new_yes, no, 9_000_000, fee).unwrap();
        assert!(refund < cost, "selling all must lose the spread");
        assert!(refund > 0, "must get something back");
    }

    #[test]
    fn extreme_pool_ratio() {
        let yes = 100_000u128;
        let no = 1_000_000_000_000_000u128;
        let fee = 50u16;
        let cost = get_buy_cost_in(yes, no, 1, fee).unwrap();
        assert!(cost > 0, "buy must work with extreme ratio");
        let refund = get_sell_amount_out(yes, no, 1, fee).unwrap();
        assert!(refund < cost, "sell must be cheaper than buy");
    }

    #[test]
    fn buy_cost_in_never_underflows() {
        let pairs = [
            (1_000_000u128, 1_000_000u128),
            (50_000_000u128, 50_000_000u128),
        ];
        for &(yes, no) in &pairs {
            for fee in [0u16, 1, 100, 500, 2000, 5000] {
                if let Ok(cost) = get_buy_cost_in(yes, no, 1, fee) {
                    assert!(cost > 0, "cost must be > 0 for pairs ({}, {}) fee={}", yes, no, fee);
                }
            }
        }
    }

    #[test]
    fn buy_cost_stays_at_or_below_fee_grossed_face_value() {
        // The most important property for users: the GROSS buy cost never
        // exceeds the face value of the shares (the curve always prices at or
        // below the post-trade probability ≤ 1). The protocol fee grosses the
        // cost up by 10000/(10000−fee), which is the only way cost can approach
        // face value.
        for &(yes, no) in &[(1_000_000u128, 1_000_000u128), (1_000_000, 9_000_000), (9_000_000, 1_000_000), (1, 1)] {
            for fee in [0u16, 30, 300] {
                let cost = get_buy_cost_in(yes, no, 100_000, fee).unwrap();
                let max_fee_gross = 100_000u128 * 10_000 / (10_000 - fee as u128) + 2;
                assert!(cost <= max_fee_gross, "cost {cost} > fee-grossed face value {max_fee_gross} at ({yes},{no}) fee {fee}");
            }
        }
    }
}
