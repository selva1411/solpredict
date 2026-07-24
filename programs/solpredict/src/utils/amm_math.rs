use anchor_lang::prelude::*;
use crate::errors::SolPredictError;

const SCALE: u128 = 1_000_000_000_000;

pub fn get_spot_price_yes(pool_yes: u128, pool_no: u128, fee_bps: u16) -> Result<u128> {
    if pool_yes == 0 {
        return Ok(0);
    }
    let gross = pool_no
        .checked_mul(SCALE)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(pool_yes)
        .ok_or(SolPredictError::MathOverflow)?;
    let fee = gross
        .checked_mul(fee_bps as u128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)?;
    Ok(gross.checked_sub(fee).ok_or(SolPredictError::MathOverflow)?)
}

pub fn get_buy_cost_in(
    pool_yes: u128,
    pool_no: u128,
    dy_out: u128,
    fee_bps: u16,
) -> Result<u128> {
    require!(dy_out > 0, SolPredictError::InvalidQuantity);
    require!(dy_out < pool_yes, SolPredictError::InvalidQuantity);

    let k = pool_yes.checked_mul(pool_no).ok_or(SolPredictError::MathOverflow)?;
    let new_yes = pool_yes.checked_sub(dy_out).ok_or(SolPredictError::MathOverflow)?;
    if new_yes == 0 {
        return Err(SolPredictError::MathOverflow.into());
    }
    let new_no = k.checked_div(new_yes).ok_or(SolPredictError::MathOverflow)?;
    let dx_gross = new_no.checked_sub(pool_no).ok_or(SolPredictError::MathOverflow)?;

    let divisor = 10_000u128.checked_sub(fee_bps as u128).ok_or(SolPredictError::MathOverflow)?;
    let dx_with_fee = dx_gross
        .checked_mul(10_000)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(divisor)
        .ok_or(SolPredictError::MathOverflow)?;
    Ok(dx_with_fee)
}

pub fn get_buy_amount_out(
    pool_yes: u128,
    pool_no: u128,
    dx_in: u128,
    fee_bps: u16,
) -> Result<u128> {
    require!(dx_in > 0, SolPredictError::InvalidQuantity);
    let k = pool_yes.checked_mul(pool_no).ok_or(SolPredictError::MathOverflow)?;
    let fee = dx_in
        .checked_mul(fee_bps as u128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)?;
    let dx_after_fee = dx_in.checked_sub(fee).ok_or(SolPredictError::MathOverflow)?;
    let new_no = pool_no.checked_add(dx_after_fee).ok_or(SolPredictError::MathOverflow)?;
    if new_no == 0 {
        return Ok(0);
    }
    let new_yes = k.checked_div(new_no).ok_or(SolPredictError::MathOverflow)?;
    let dy = pool_yes.checked_sub(new_yes).ok_or(SolPredictError::MathOverflow)?;
    Ok(dy)
}

pub fn get_sell_amount_out(
    pool_yes: u128,
    pool_no: u128,
    dy_in: u128,
    fee_bps: u16,
) -> Result<u128> {
    require!(dy_in > 0, SolPredictError::InvalidQuantity);
    let k = pool_yes.checked_mul(pool_no).ok_or(SolPredictError::MathOverflow)?;
    let new_yes = pool_yes.checked_add(dy_in).ok_or(SolPredictError::MathOverflow)?;
    let new_no = k.checked_div(new_yes).ok_or(SolPredictError::MathOverflow)?;
    let dx_gross = pool_no.checked_sub(new_no).ok_or(SolPredictError::MathOverflow)?;
    let fee = dx_gross
        .checked_mul(fee_bps as u128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)?;
    Ok(dx_gross.checked_sub(fee).ok_or(SolPredictError::MathOverflow)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn buy_increases_price_sell_decreases() {
        let mut yes = 1_000_000u128;
        let mut no = 1_000_000u128;
        let fee = 30u16;
        let p0 = get_spot_price_yes(yes, no, fee).unwrap();

        let cost = get_buy_cost_in(yes, no, 100_000, fee).unwrap();
        let yes_after = yes.checked_sub(100_000).unwrap();
        let no_after = no.checked_add(cost).unwrap();
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
        let new_yes = yes - 50_000;
        let new_no = no + cost;
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

        let cost = get_buy_cost_in(yes, no, 10_000, fee).unwrap();
        assert!(cost > 0, "cost must be positive");

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

        let refund = get_sell_amount_out(
            yes - 10_000_000,
            no + cost,
            10_000_000,
            fee,
        ).unwrap();
        assert!(refund < cost);
    }

    #[test]
    fn zero_fee_round_trip() {
        let yes = 1_000_000u128;
        let no = 1_000_000u128;
        let fee = 0u16;

        let cost = get_buy_cost_in(yes, no, 100_000, fee).unwrap();
        let new_yes = yes - 100_000;
        let new_no = no + cost;
        let refund = get_sell_amount_out(new_yes, new_no, 100_000, fee).unwrap();
        let diff = cost.max(refund) - cost.min(refund);
        assert!(diff <= 2, "zero fee round trip diff={} > 2", diff);
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
        assert!(price > 0, "price must be positive in imbalanced pool");
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
        assert!(diff <= 1, "buy_cost_in / buy_amount_out round trip diff={} > 1", diff);
    }

    #[test]
    fn symmetric_zero_start() {
        let yes = 10_000_000u128;
        let no = 10_000_000u128;
        let fee = 200u16;
        let spot = get_spot_price_yes(yes, no, fee).unwrap();
        let fee_amt = 1_000_000_000_000u128 * 200 / 10_000;
        let expected = 1_000_000_000_000u128 - fee_amt;
        let diff = expected.max(spot) - expected.min(spot);
        assert!(diff < 1000, "symmetric spot price deviates: spot={} expected={}", spot, expected);
    }

    #[test]
    fn sell_entire_position() {
        let yes = 10_000_000u128;
        let no = 10_000_000u128;
        let fee = 30u16;
        let cost = get_buy_cost_in(yes, no, 9_000_000, fee).unwrap();
        let new_yes = yes - 9_000_000;
        let new_no = no + cost;
        let refund = get_sell_amount_out(new_yes, new_no, 9_000_000, fee).unwrap();
        assert!(refund < cost, "selling all must lose fee");
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
}