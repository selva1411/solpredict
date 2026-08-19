use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, Transfer};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::state::{EmergencyPause, Market, Order, OrderStatus, Side};
use crate::utils::{check_not_paused, require_valid_ata};

#[derive(Accounts)]
pub struct CancelOrder<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        close = maker,
        seeds = [ORDER_SEED, market.key().as_ref(), maker.key().as_ref(), order.order_id.to_le_bytes().as_ref()],
        bump = order.bump,
        constraint = order.maker == maker.key() @ SolPredictError::Unauthorized,
        constraint = order.market == market.key() @ SolPredictError::InvalidMarket,
        constraint = order.status == OrderStatus::Open @ SolPredictError::OrderCancelled,
    )]
    pub order: Account<'info, Order>,

    /// CHECK: Maker's token ATA — validated by token program CPI.
    #[account(mut)]
    pub maker_token_ata: UncheckedAccount<'info>,

    /// CHECK: Order's token ATA escrow — validated by token program CPI.
    #[account(mut)]
    pub order_token_escrow: UncheckedAccount<'info>,

    /// Data-less SOL escrow for limit BUY orders — refunded to the maker on
    /// cancel. Unused for sell orders.
    #[account(
        mut,
        seeds = [ORDER_ESCROW_SEED, market.key().as_ref(), maker.key().as_ref(), order.order_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub order_escrow: SystemAccount<'info>,

    /// Optional emergency-pause account. When present and paused, trading is halted.
    pub emergency_pause: Option<Account<'info, EmergencyPause>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelOrder>) -> Result<()> {
    check_not_paused(&ctx.accounts.emergency_pause)?;

    let is_buy = ctx.accounts.order.is_buy;
    let quantity = ctx.accounts.order.quantity;
    let filled_quantity = ctx.accounts.order.filled_quantity;
    let order_id = ctx.accounts.order.order_id;
    let order_bump = ctx.accounts.order.bump;

    let remaining_qty = quantity
        .checked_sub(filled_quantity)
        .ok_or(SolPredictError::MathOverflow)?;

    if !is_buy && remaining_qty > 0 {
        // The order escrows tokens for the side's mint; verify the caller's
        // ATAs actually belong to that mint before returning the escrow.
        let expected_mint = match ctx.accounts.order.side {
            Side::Yes => ctx.accounts.market.yes_mint,
            Side::No => ctx.accounts.market.no_mint,
        };
        let maker_ata = ctx.accounts.maker_token_ata.to_account_info();
        let escrow_ata = ctx.accounts.order_token_escrow.to_account_info();
        require_valid_ata(&maker_ata, expected_mint, ctx.accounts.maker.key())?;
        require_valid_ata(&escrow_ata, expected_mint, ctx.accounts.order.key())?;

        // Return remaining escrowed tokens to maker
        let token_amount = (remaining_qty as u128)
            .checked_mul(BASE_UNITS_PER_SHARE as u128)
            .ok_or(SolPredictError::MathOverflow)?;
        let token_amount_u64 = u64::try_from(token_amount).map_err(|_| SolPredictError::MathOverflow)?;

        let market_key = ctx.accounts.market.key();
        let maker_key = ctx.accounts.maker.key();
        let order_id_bytes = order_id.to_le_bytes();
        let seeds = &[
            ORDER_SEED,
            market_key.as_ref(),
            maker_key.as_ref(),
            order_id_bytes.as_ref(),
            &[order_bump],
        ];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.order_token_escrow.to_account_info(),
                    to: ctx.accounts.maker_token_ata.to_account_info(),
                    authority: ctx.accounts.order.to_account_info(),
                },
                signer_seeds,
            ),
            token_amount_u64,
        )?;
    }

    if is_buy && remaining_qty > 0 {
        // Return the escrowed SOL for the UNFILLED portion of a buy order from
        // the data-less order_escrow PDA to the maker. (Previously this relied
        // on `close = maker` draining the lamports off the order PDA — fragile
        // and incompatible with the escrow-account design.)
        let remaining_cost = (remaining_qty as u128)
            .checked_mul(ctx.accounts.order.price_bps as u128)
            .ok_or(SolPredictError::MathOverflow)?
            .checked_mul(ctx.accounts.market.share_price_lamports as u128)
            .ok_or(SolPredictError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(SolPredictError::MathOverflow)?;
        let remaining_cost_u64 = u64::try_from(remaining_cost)
            .map_err(|_| SolPredictError::MathOverflow)?;

        let market_key = ctx.accounts.market.key();
        let maker_key = ctx.accounts.maker.key();
        let order_id_bytes = order_id.to_le_bytes();
        let escrow_seeds = &[
            ORDER_ESCROW_SEED,
            market_key.as_ref(),
            maker_key.as_ref(),
            order_id_bytes.as_ref(),
            &[ctx.bumps.order_escrow],
        ];
        let escrow_signer_seeds = &[&escrow_seeds[..]];

        system_program::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.order_escrow.to_account_info(),
                    to: ctx.accounts.maker.to_account_info(),
                },
                escrow_signer_seeds,
            ),
            remaining_cost_u64,
        )?;
    }

    ctx.accounts.order.status = OrderStatus::Cancelled;
    msg!("Order #{} cancelled by maker", order_id);

    Ok(())
}
