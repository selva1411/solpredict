use anchor_lang::prelude::*;
use anchor_spl::token::{self, Burn, Mint, Token, TokenAccount};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::events::RewardsClaimed;
use crate::state::{Market, MarketStatus, UserPosition, WinningOutcome};
use crate::utils::payout_math;

/// Accounts for the `claim_rewards` instruction.
///
/// Winners burn their tokens and receive a pro-rata SOL payout from the
/// treasury. Double-claim is prevented by both the `claimed` flag and
/// the token burn (defense in depth).
#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    /// Claimer — must own the position and tokens.
    #[account(mut)]
    pub claimer: Signer<'info>,

    /// Market — must be Settled.
    #[account(
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Settled @ SolPredictError::MarketNotSettled,
    )]
    pub market: Account<'info, Market>,

    /// Treasury PDA — pays out SOL to winners.
    /// CHECK: Validated by seeds. Lamports transferred via direct manipulation.
    #[account(
        mut,
        seeds = [TREASURY_SEED, market.key().as_ref()],
        bump = market.treasury_bump,
    )]
    pub treasury: SystemAccount<'info>,

    /// Winning mint — YES or NO depending on market.winning_outcome.
    #[account(
        mut,
        constraint = (
            (market.winning_outcome == WinningOutcome::Yes && winning_mint.key() == market.yes_mint)
            || (market.winning_outcome == WinningOutcome::No && winning_mint.key() == market.no_mint)
        ) @ SolPredictError::NothingToClaim,
    )]
    pub winning_mint: Account<'info, Mint>,

    /// Claimer's ATA for the winning mint.
    #[account(
        mut,
        associated_token::mint = winning_mint,
        associated_token::authority = claimer,
    )]
    pub claimer_ata: Account<'info, TokenAccount>,

    /// UserPosition PDA — double-claim guard.
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

/// Handler for `claim_rewards`.
///
/// Burns the winner's tokens, computes pro-rata payout via u128 math,
/// and transfers SOL from treasury to claimer.
pub fn handler(ctx: Context<ClaimRewards>) -> Result<()> {
    // 1. Check not already claimed
    require!(
        !ctx.accounts.user_position.claimed,
        SolPredictError::AlreadyClaimed
    );

    // 2. Read user's token balance
    let user_tokens = ctx.accounts.claimer_ata.amount;
    require!(user_tokens > 0, SolPredictError::NothingToClaim);

    // 3. Determine winning supply for pro-rata calculation
    let winning_supply = match ctx.accounts.market.winning_outcome {
        WinningOutcome::Yes => ctx.accounts.market.yes_supply,
        WinningOutcome::No => ctx.accounts.market.no_supply,
        WinningOutcome::Unset => return err!(SolPredictError::MarketNotSettled),
    };

    // 4. Calculate pro-rata payout (floor-rounded, u128 intermediate)
    let payout = payout_math::calculate_payout(
        ctx.accounts.market.total_payout_pool,
        user_tokens,
        winning_supply,
    )?;

    // 5. Burn ALL winning tokens from claimer's ATA
    //    Authority = claimer (user signs for their own tokens)
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

    // 6. Transfer SOL from treasury → claimer via CPI (treasury is a SystemAccount)
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
    anchor_lang::system_program::transfer(cpi_ctx, payout)?;

    // 7. Defense-in-depth: verify treasury retains rent-exempt minimum or is completely empty
    let treasury_info = ctx.accounts.treasury.to_account_info();
    let rent = Rent::get()?;
    let min_balance = rent.minimum_balance(0); // treasury has zero data
    let balance = treasury_info.lamports();
    require!(
        balance >= min_balance || balance == 0,
        SolPredictError::TreasuryInsufficient
    );

    // 8. Mark position as claimed (double-claim guard)
    ctx.accounts.user_position.claimed = true;

    // 9. Emit event
    emit!(RewardsClaimed {
        market_id: ctx.accounts.market.market_id,
        claimer: ctx.accounts.claimer.key(),
        payout,
    });

    msg!(
        "Claimed {} lamports for market {}",
        payout,
        ctx.accounts.market.market_id
    );

    Ok(())
}
