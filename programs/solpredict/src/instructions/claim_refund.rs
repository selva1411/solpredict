use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::RefundClaimed;
use crate::state::{Market, MarketStatus, UserPosition};

/// Accounts for the `claim_refund` instruction.
///
/// For cancelled markets only. User burns all tokens (both sides) and
/// receives an exact refund of their original purchase price. No fee taken
/// on cancellation — it wasn't the user's fault the market was cancelled.
#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    /// User claiming refund.
    #[account(mut)]
    pub claimer: Signer<'info>,

    /// Market — must be Cancelled.
    #[account(
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Cancelled @ SolPredictError::MarketNotCancelled,
    )]
    pub market: Account<'info, Market>,

    /// Treasury PDA — refunds SOL to user.
    /// CHECK: Validated by seeds constraint.
    #[account(
        mut,
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump = market.treasury_bump,
    )]
    pub treasury: SystemAccount<'info>,

    /// YES mint.
    #[account(
        mut,
        constraint = yes_mint.key() == market.yes_mint @ SolPredictError::Unauthorized,
    )]
    pub yes_mint: Account<'info, Mint>,

    /// NO mint.
    #[account(
        mut,
        constraint = no_mint.key() == market.no_mint @ SolPredictError::Unauthorized,
    )]
    pub no_mint: Account<'info, Mint>,

    /// User's YES token ATA.
    #[account(
        mut,
        associated_token::mint = yes_mint,
        associated_token::authority = claimer,
    )]
    pub claimer_yes_ata: Account<'info, TokenAccount>,

    /// User's NO token ATA.
    #[account(
        mut,
        associated_token::mint = no_mint,
        associated_token::authority = claimer,
    )]
    pub claimer_no_ata: Account<'info, TokenAccount>,

    /// UserPosition PDA — double-refund guard.
    #[account(
        mut,
        seeds = [POSITION_SEED, market.key().as_ref(), claimer.key().as_ref()],
        bump = user_position.bump,
        constraint = user_position.owner == claimer.key() @ SolPredictError::Unauthorized,
        constraint = user_position.market == market.key() @ SolPredictError::Unauthorized,
    )]
    pub user_position: Account<'info, UserPosition>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

/// Handler for `claim_refund`.
///
/// Burns all YES and NO tokens the user holds, refunds the exact original
/// purchase price in SOL. No fee deducted on cancellation.
pub fn handler(ctx: Context<ClaimRefund>) -> Result<()> {
    // 1. Check not already claimed/refunded
    require!(
        !ctx.accounts.user_position.claimed,
        SolPredictError::AlreadyClaimed
    );

    // 2. Read token balances
    let yes_tokens = ctx.accounts.claimer_yes_ata.amount;
    let no_tokens = ctx.accounts.claimer_no_ata.amount;

    // Must have at least some tokens
    require!(
        yes_tokens > 0 || no_tokens > 0,
        SolPredictError::NothingToClaim
    );

    // 3. Calculate refund: (yes_tokens + no_tokens) * share_price_lamports / BASE_UNITS_PER_SHARE
    //    user gets back EXACTLY what they paid, no fee taken on cancellation.
    let total_tokens = yes_tokens
        .checked_add(no_tokens)
        .ok_or(SolPredictError::MathOverflow)?;
    let refund = (total_tokens as u128)
        .checked_mul(ctx.accounts.market.share_price_lamports as u128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(BASE_UNITS_PER_SHARE as u128)
        .ok_or(SolPredictError::MathOverflow)?;
    let refund_u64 = u64::try_from(refund).map_err(|_| SolPredictError::MathOverflow)?;

    // 4. Burn YES tokens if non-zero
    if yes_tokens > 0 {
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.yes_mint.to_account_info(),
                    from: ctx.accounts.claimer_yes_ata.to_account_info(),
                    authority: ctx.accounts.claimer.to_account_info(),
                },
            ),
            yes_tokens,
        )?;
    }

    // 5. Burn NO tokens if non-zero
    if no_tokens > 0 {
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.no_mint.to_account_info(),
                    from: ctx.accounts.claimer_no_ata.to_account_info(),
                    authority: ctx.accounts.claimer.to_account_info(),
                },
            ),
            no_tokens,
        )?;
    }

    // 6. Transfer refund lamports treasury → user via CPI (treasury is a SystemAccount)
    let market_key = ctx.accounts.market.key();
    let treasury_bump = ctx.accounts.market.treasury_bump;
    let seeds = &[
        TREASURY_SEED,
        market_key.as_ref(),
        &[treasury_bump],
    ];
    let signer_seeds = &[&seeds[..]];

    let cpi_ctx = CpiContext::new_with_signer(
        ctx.accounts.system_program.to_account_info(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.treasury.to_account_info(),
            to: ctx.accounts.claimer.to_account_info(),
        },
        signer_seeds,
    );
    anchor_lang::system_program::transfer(cpi_ctx, refund_u64)?;

    // 7. Verify treasury retains rent-exempt minimum or is completely empty
    let treasury_info = ctx.accounts.treasury.to_account_info();
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(0);
    let balance = treasury_info.lamports();
    require!(
        balance >= min_balance || balance == 0,
        SolPredictError::TreasuryInsufficient
    );

    ctx.accounts.user_position.claimed = true;

    // 9. Emit event
    emit!(RefundClaimed {
        market_id: ctx.accounts.market.market_id,
        user: ctx.accounts.claimer.key(),
        refund: refund_u64,
    });

    msg!(
        "Refunded {} lamports for market {}",
        refund_u64,
        ctx.accounts.market.market_id
    );

    Ok(())
}
