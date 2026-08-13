use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::LiquidityRemoved;
use crate::state::{EmergencyPause, LiquidityPosition, Market};
use crate::utils::check_not_paused;

#[derive(Accounts)]
pub struct RemoveLiquidity<'info> {
    #[account(mut)]
    pub provider: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
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
        seeds = [YES_MINT_SEED, market.key().as_ref()],
        bump,
    )]
    pub yes_mint: Account<'info, Mint>,

    #[account(
        mut,
        seeds = [NO_MINT_SEED, market.key().as_ref()],
        bump,
    )]
    pub no_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = yes_mint,
        associated_token::authority = provider,
    )]
    pub provider_yes_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = no_mint,
        associated_token::authority = provider,
    )]
    pub provider_no_ata: Account<'info, TokenAccount>,

    #[account(
        mut,
        seeds = [LP_SEED, market.key().as_ref(), provider.key().as_ref()],
        bump = liquidity_position.bump,
    )]
    pub liquidity_position: Account<'info, LiquidityPosition>,

    /// Optional emergency-pause account. When present and paused, trading is halted.
    pub emergency_pause: Option<Account<'info, EmergencyPause>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<RemoveLiquidity>, lp_tokens_to_burn: u64) -> Result<()> {
    check_not_paused(&ctx.accounts.emergency_pause)?;

    let market = &mut ctx.accounts.market;
    let lp = &ctx.accounts.liquidity_position;

    require!(lp.lp_tokens >= lp_tokens_to_burn, SolPredictError::NoLpTokens);
    require!(lp_tokens_to_burn > 0, SolPredictError::InvalidQuantity);

    // Pre-compute withdrawal amounts
    let lp_ratio = (lp_tokens_to_burn as u128)
        .checked_mul(PRECISION as u128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(lp.lp_tokens as u128)
        .ok_or(SolPredictError::MathOverflow)?;

    let yes_withdraw = ((lp.yes_deposited as u128)
        .checked_mul(lp_ratio)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(PRECISION as u128))
        .ok_or(SolPredictError::MathOverflow)? as u64;

    let no_withdraw = ((lp.no_deposited as u128)
        .checked_mul(lp_ratio)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(PRECISION as u128))
        .ok_or(SolPredictError::MathOverflow)? as u64;

    let yes_refund = yes_withdraw.min(
        (market.yes_pool_lamports as u128)
            .checked_mul(lp_ratio)
            .unwrap_or(0)
            .checked_div(PRECISION as u128)
            .unwrap_or(0) as u64,
    );
    let no_refund = no_withdraw.min(
        (market.no_pool_lamports as u128)
            .checked_mul(lp_ratio)
            .unwrap_or(0)
            .checked_div(PRECISION as u128)
            .unwrap_or(0) as u64,
    );

    // Proportional token amounts to burn (same ratio as the SOL refunds).
    let burn_yes = ((lp.yes_deposited as u128)
        .checked_mul(lp_ratio)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(PRECISION as u128))
        .ok_or(SolPredictError::MathOverflow)? as u64;
    let burn_no = ((lp.no_deposited as u128)
        .checked_mul(lp_ratio)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(PRECISION as u128))
        .ok_or(SolPredictError::MathOverflow)? as u64;
    let has_yes = lp.yes_deposited > 0;
    let has_no = lp.no_deposited > 0;

    let treasury_balance = ctx.accounts.treasury.lamports();
    let total_refund = yes_refund.checked_add(no_refund).ok_or(SolPredictError::MathOverflow)?;
    // Keep the treasury rent-exempt (mirrors claim_refund): never drain a
    // system account below its minimum balance or the runtime rejects the tx.
    let rent = Rent::get()?;
    let rent_min = rent.minimum_balance(0);
    let safe_refund = total_refund.min(treasury_balance.saturating_sub(rent_min.min(treasury_balance)));

    let yes_payout = if total_refund > 0 {
        (safe_refund as u128)
            .checked_mul(yes_refund as u128)
            .unwrap_or(0)
            .checked_div(total_refund as u128)
            .unwrap_or(0) as u64
    } else {
        0
    };
    let no_payout = safe_refund.saturating_sub(yes_payout);

    // Pre-read fields needed for signer seeds
    let market_id = market.market_id;
    let treasury_bump = market.treasury_bump;
    let market_key = market.key();
    let provider_key = ctx.accounts.provider.key();

    market.reentrancy_lock.acquire(&crate::ID)?;

    // Transfer from treasury
    if yes_payout > 0 && lp.yes_deposited > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.treasury.to_account_info(),
                    to: ctx.accounts.provider.to_account_info(),
                },
                &[&[TREASURY_SEED, market_key.as_ref(), &[treasury_bump]]],
            ),
            yes_payout,
        )?;
    }

    if no_payout > 0 && lp.no_deposited > 0 {
        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.treasury.to_account_info(),
                    to: ctx.accounts.provider.to_account_info(),
                },
                &[&[TREASURY_SEED, market_key.as_ref(), &[treasury_bump]]],
            ),
            no_payout,
        )?;
    }

    if has_yes {
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.yes_mint.to_account_info(),
                    from: ctx.accounts.provider_yes_ata.to_account_info(),
                    authority: ctx.accounts.provider.to_account_info(),
                },
            ),
            burn_yes,
        )?;
    }

    if has_no {
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.no_mint.to_account_info(),
                    from: ctx.accounts.provider_no_ata.to_account_info(),
                    authority: ctx.accounts.provider.to_account_info(),
                },
            ),
            burn_no,
        )?;
    }

    market.yes_pool_lamports = market.yes_pool_lamports.saturating_sub(yes_payout);
    market.no_pool_lamports = market.no_pool_lamports.saturating_sub(no_payout);
    // Decrement supply by the BURNED amount (not the full deposit) so partial
    // withdrawals stay consistent with the on-chain token supply.
    market.yes_supply = market.yes_supply.saturating_sub(burn_yes);
    market.no_supply = market.no_supply.saturating_sub(burn_no);

    // Decrement the LP position; keep it open for partial withdrawals and only
    // close it (returning the rent) once every LP token has been burned.
    let position = &mut ctx.accounts.liquidity_position;
    position.lp_tokens = position
        .lp_tokens
        .checked_sub(lp_tokens_to_burn)
        .ok_or(SolPredictError::MathOverflow)?;
    position.yes_deposited = position.yes_deposited.saturating_sub(burn_yes);
    position.no_deposited = position.no_deposited.saturating_sub(burn_no);
    position.total_lamports_deposited = position
        .total_lamports_deposited
        .saturating_sub(burn_yes.checked_add(burn_no).ok_or(SolPredictError::MathOverflow)?);

    let fully_withdrawn = position.lp_tokens == 0;

    market.reentrancy_lock.release();

    if fully_withdrawn {
        // Return the position's rent to the provider and zero the account data.
        anchor_lang::AccountsClose::close(position, ctx.accounts.provider.to_account_info())?;
    }

    emit!(LiquidityRemoved {
        market_id,
        provider: provider_key,
        yes_payout,
        no_payout,
        lp_tokens_burned: lp_tokens_to_burn,
    });

    Ok(())
}