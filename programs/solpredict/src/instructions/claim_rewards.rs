use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::RewardsClaimed;
use crate::state::{Market, MarketStatus, UserPosition, WinningOutcome};
use crate::utils::payout_math;

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub claimer: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Settled @ SolPredictError::MarketNotSettled,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump = market.treasury_bump,
    )]
    pub treasury: SystemAccount<'info>,

    #[account(
        mut,
        constraint = (
            (market.winning_outcome == WinningOutcome::Yes && winning_mint.key() == market.yes_mint)
            || (market.winning_outcome == WinningOutcome::No && winning_mint.key() == market.no_mint)
        ) @ SolPredictError::NothingToClaim,
    )]
    pub winning_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = winning_mint,
        associated_token::authority = claimer,
    )]
    pub claimer_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        close = claimer,
        seeds = [POSITION_SEED, market.key().as_ref(), claimer.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.owner == claimer.key() @ SolPredictError::Unauthorized,
        constraint = user_position.market == market.key() @ SolPredictError::Unauthorized,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<ClaimRewards>) -> Result<()> {
    require!(!ctx.accounts.user_position.claimed, SolPredictError::AlreadyClaimed);

    let user_tokens = ctx.accounts.claimer_ata.amount;
    require!(user_tokens > 0, SolPredictError::NothingToClaim);

    let winning_supply = match ctx.accounts.market.winning_outcome {
        WinningOutcome::Yes => ctx.accounts.market.yes_supply,
        WinningOutcome::No => ctx.accounts.market.no_supply,
        WinningOutcome::Unset => return err!(SolPredictError::MarketNotSettled),
    };

    let payout = payout_math::calculate_payout(
        ctx.accounts.market.total_payout_pool, user_tokens, winning_supply,
    )?;

    ctx.accounts.user_position.yes_amount = 0;
    ctx.accounts.user_position.no_amount = 0;
    ctx.accounts.user_position.claimed = true;

    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Burn {
                mint: ctx.accounts.winning_mint.to_account_info(),
                from: ctx.accounts.claimer_ata.to_account_info(),
                authority: ctx.accounts.claimer.to_account_info(),
            },
        ),
        user_tokens,
    )?;

    let market_key = ctx.accounts.market.key();
    let treasury_bump = ctx.accounts.market.treasury_bump;
    let seeds = &[TREASURY_SEED, market_key.as_ref(), &[treasury_bump]];
    let signer_seeds = &[&seeds[..]];

    anchor_lang::system_program::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.system_program.to_account_info(),
            anchor_lang::system_program::Transfer {
                from: ctx.accounts.treasury.to_account_info(),
                to: ctx.accounts.claimer.to_account_info(),
            },
            signer_seeds,
        ),
        payout,
    )?;

    let claimer_key = ctx.accounts.claimer.key();
    let market_id = ctx.accounts.market.market_id;

    ctx.accounts.market.reentrancy_lock.acquire(&crate::ID)?;

    let market = &mut ctx.accounts.market;
    market.total_claimed = market.total_claimed.checked_add(payout).ok_or(SolPredictError::MathOverflow)?;

    let remaining = market.total_payout_pool.checked_sub(market.total_claimed).ok_or(SolPredictError::MathOverflow)?;
    let treasury_balance = ctx.accounts.treasury.to_account_info().lamports();
    require!(treasury_balance >= remaining, SolPredictError::TreasuryInsufficient);

    ctx.accounts.market.reentrancy_lock.release();

    emit!(RewardsClaimed { market_id, claimer: claimer_key, payout });

    Ok(())
}