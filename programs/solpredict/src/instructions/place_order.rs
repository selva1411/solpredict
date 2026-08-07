use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, Transfer};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::state::{EmergencyPause, Market, MarketStatus, Order, OrderStatus, Side};
use crate::utils::check_not_paused;

#[derive(Accounts)]
#[instruction(order_id: u64)]
pub struct PlaceOrder<'info> {
    #[account(mut)]
    pub maker: Signer<'info>,

    #[account(
        mut,
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Open @ SolPredictError::MarketNotOpen,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = maker,
        space = Order::LEN,
        seeds = [ORDER_SEED, market.key().as_ref(), maker.key().as_ref(), order_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub order: Account<'info, Order>,

    /// CHECK: Maker's token ATA — validated by token program CPI.
    #[account(mut)]
    pub maker_token_ata: UncheckedAccount<'info>,

    /// CHECK: Order's token ATA escrow — validated by token program CPI.
    #[account(mut)]
    pub order_token_escrow: UncheckedAccount<'info>,

    /// Optional emergency-pause account. When present and paused, trading is halted.
    pub emergency_pause: Option<Account<'info, EmergencyPause>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

pub fn handler(
    ctx: Context<PlaceOrder>,
    order_id: u64,
    side: Side,
    is_buy: bool,
    price_bps: u64,
    quantity: u64,
) -> Result<()> {
    check_not_paused(&ctx.accounts.emergency_pause)?;

    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < ctx.accounts.market.end_ts,
        SolPredictError::MarketExpired
    );

    require!(
        price_bps >= 1 && price_bps <= 9999,
        SolPredictError::InvalidPriceBps
    );

    require!(
        quantity > 0 && quantity <= MAX_SHARES_PER_TX,
        SolPredictError::InvalidQuantity
    );

    if is_buy {
        // Limit Buy Order (Bid): Lock SOL in Order PDA escrow
        // Cost = quantity * price_bps * share_price / 10000
        let cost = (quantity as u128)
            .checked_mul(price_bps as u128)
            .ok_or(SolPredictError::MathOverflow)?
            .checked_mul(ctx.accounts.market.share_price_lamports as u128)
            .ok_or(SolPredictError::MathOverflow)?
            .checked_div(10_000)
            .ok_or(SolPredictError::MathOverflow)?;
        let cost_u64 = u64::try_from(cost).map_err(|_| SolPredictError::MathOverflow)?;

        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.maker.to_account_info(),
                    to: ctx.accounts.order.to_account_info(),
                },
            ),
            cost_u64,
        )?;
    } else {
        // Limit Sell Order (Ask): Lock SPL tokens in Order escrow
        let token_amount = (quantity as u128)
            .checked_mul(BASE_UNITS_PER_SHARE as u128)
            .ok_or(SolPredictError::MathOverflow)?;
        let token_amount_u64 = u64::try_from(token_amount).map_err(|_| SolPredictError::MathOverflow)?;

        // Transfer tokens from maker ATA to order escrow ATA
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.maker_token_ata.to_account_info(),
                    to: ctx.accounts.order_token_escrow.to_account_info(),
                    authority: ctx.accounts.maker.to_account_info(),
                },
            ),
            token_amount_u64,
        )?;
    }

    let order = &mut ctx.accounts.order;
    order.market = ctx.accounts.market.key();
    order.maker = ctx.accounts.maker.key();
    order.order_id = order_id;
    order.side = side;
    order.is_buy = is_buy;
    order.price_bps = price_bps;
    order.quantity = quantity;
    order.filled_quantity = 0;
    order.status = OrderStatus::Open;
    order.bump = ctx.bumps.order;

    msg!(
        "Order #{} placed by {}: side={:?}, is_buy={}, price_bps={}, qty={}",
        order_id,
        ctx.accounts.maker.key(),
        side,
        is_buy,
        price_bps,
        quantity
    );

    Ok(())
}
