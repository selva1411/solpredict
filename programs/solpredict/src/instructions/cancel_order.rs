use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, Transfer};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::state::{Market, Order, OrderStatus};

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

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(ctx: Context<CancelOrder>) -> Result<()> {
    let is_buy = ctx.accounts.order.is_buy;
    let quantity = ctx.accounts.order.quantity;
    let filled_quantity = ctx.accounts.order.filled_quantity;
    let order_id = ctx.accounts.order.order_id;
    let order_bump = ctx.accounts.order.bump;

    let remaining_qty = quantity
        .checked_sub(filled_quantity)
        .ok_or(SolPredictError::MathOverflow)?;

    if !is_buy && remaining_qty > 0 {
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

    ctx.accounts.order.status = OrderStatus::Cancelled;
    msg!("Order #{} cancelled by maker", order_id);

    Ok(())
}
