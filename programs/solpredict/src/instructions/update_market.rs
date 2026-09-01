use anchor_lang::prelude::*;

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::MarketUpdated;
use crate::state::{Config, Market, MarketStatus};

#[derive(Accounts)]
pub struct UpdateMarket<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        seeds = [CONFIG_SEED],
        bump = config.bump,
        constraint = admin.key() == config.admin @ SolPredictError::Unauthorized,
    )]
    pub config: Account<'info, Config>,
}

pub fn handler(
    ctx: Context<UpdateMarket>,
    question: Option<String>,
    description: Option<String>,
    category: Option<u8>,
    end_ts: Option<i64>,
    resolve_ts: Option<i64>,
    share_price_lamports: Option<u64>,
) -> Result<()> {
    let market = &mut ctx.accounts.market;

    require!(market.status == MarketStatus::Open, SolPredictError::MarketNotOpen);

    let clock = Clock::get()?;

    let market_id = market.market_id;
    let mut final_question = market.question.clone();

    market.reentrancy_lock.acquire(&crate::ID)?;

    if let Some(q) = question {
        require!(q.len() >= 10 && q.len() <= MAX_QUESTION_LEN, SolPredictError::InvalidQuestion);
        market.question = q.clone();
        final_question = q;
    }

    if let Some(d) = description {
        require!(d.len() <= MAX_DESCRIPTION_LEN, SolPredictError::InvalidDescription);
        market.description = d;
    }

    if let Some(cat) = category {
        require!(cat <= 4, SolPredictError::InvalidCategory);
        market.category = match cat {
            0 => crate::state::Category::Crypto,
            1 => crate::state::Category::Sports,
            2 => crate::state::Category::Politics,
            3 => crate::state::Category::Tech,
            _ => crate::state::Category::Other,
        };
    }

    if let Some(et) = end_ts {
        require!(et > clock.unix_timestamp + 3600, SolPredictError::EndTimeTooSoon);
        require!(et < clock.unix_timestamp + 31_536_000, SolPredictError::EndTimeTooFar);
        market.end_ts = et;
    }

    if let Some(rt) = resolve_ts {
        require!(rt >= market.end_ts, SolPredictError::ResolveTooSoon);
        market.resolve_ts = rt;
    }

    if let Some(sp) = share_price_lamports {
        require!(sp >= MIN_SHARE_PRICE, SolPredictError::SharePriceTooLow);
        // The share price anchors every recorded total_spent_lamports and the
        // flat-mint/refund math. Changing it once shares exist silently
        // corrupts every holder's accounting — lock it after first mint.
        require!(
            sp == market.share_price_lamports
                || (market.yes_supply == 0 && market.no_supply == 0),
            SolPredictError::SharePriceImmutable
        );
        market.share_price_lamports = sp;
    }

    let final_end_ts = market.end_ts;
    market.reentrancy_lock.release();

    emit!(MarketUpdated {
        market_id,
        question: final_question,
        end_ts: final_end_ts,
    });

    Ok(())
}