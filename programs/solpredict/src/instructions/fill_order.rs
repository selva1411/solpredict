use anchor_lang::prelude::*;
use anchor_lang::system_program;
use anchor_spl::token::{self, Token, Transfer};

use crate::constants::*;
use crate::errors::SolPredictError;
use crate::state::{EmergencyPause, Market, MarketStatus, Order, OrderStatus, Side};
use crate::utils::{check_not_paused, require_valid_ata};

#[derive(Accounts)]
pub struct FillOrder<'info> {
    #[account(mut)]
    pub taker: Signer<'info>,

    /// CHECK: Order maker account — validated by seeds constraint on order PDA.
    #[account(mut)]
    pub maker: UncheckedAccount<'info>,

    #[account(
        seeds = [MARKET_SEED, market.market_id.to_le_bytes().as_ref()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Open @ SolPredictError::MarketNotOpen,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [ORDER_SEED, market.key().as_ref(), maker.key().as_ref(), order.order_id.to_le_bytes().as_ref()],
        bump = order.bump,
        constraint = order.maker == maker.key() @ SolPredictError::Unauthorized,
        constraint = order.market == market.key() @ SolPredictError::InvalidMarket,
        constraint = order.status == OrderStatus::Open @ SolPredictError::OrderAlreadyFilled,
        constraint = taker.key() != maker.key() @ SolPredictError::SelfTradingNotAllowed,
    )]
    pub order: Account<'info, Order>,

    /// CHECK: Taker's token ATA — validated by token program CPI.
    #[account(mut)]
    pub taker_token_ata: UncheckedAccount<'info>,

    /// CHECK: Maker's token ATA — validated by token program CPI.
    #[account(mut)]
    pub maker_token_ata: UncheckedAccount<'info>,

    /// CHECK: Order's token ATA escrow — validated by token program CPI.
    #[account(mut)]
    pub order_token_escrow: UncheckedAccount<'info>,

    /// Data-less SOL escrow for limit BUY orders — the source of the maker's
    /// payment. For sell orders this account is unused (tokens are escrowed in
    /// order_token_escrow instead).
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

pub fn handler(ctx: Context<FillOrder>, quantity: u64) -> Result<()> {
    check_not_paused(&ctx.accounts.emergency_pause)?;

    // Determine the mint this order trades: the market's YES or NO mint
    // depending on the order's side. The token accounts the caller passes in
    // MUST be ATAs of this exact mint, owned by the expected party. Without
    // this check a malicious taker could supply ATAs of a completely different
    // mint (or someone else's tokens) and receive/drain the wrong assets.
    let order = &ctx.accounts.order;
    let expected_mint = match order.side {
        Side::Yes => ctx.accounts.market.yes_mint,
        Side::No => ctx.accounts.market.no_mint,
    };

    let is_buy = order.is_buy;
    let price_bps = order.price_bps;
    let order_qty = order.quantity;
    let filled_qty = order.filled_quantity;
    let order_id = order.order_id;
    let order_bump = order.bump;
    let order_key = order.key();

    // Validate only the token accounts this branch actually touches (a Buy
    // order never has an initialized escrow ATA — it escrowed SOL instead).
    if is_buy {
        let taker_ata = ctx.accounts.taker_token_ata.to_account_info();
        let maker_ata = ctx.accounts.maker_token_ata.to_account_info();
        require_valid_ata(&taker_ata, expected_mint, ctx.accounts.taker.key())?;
        require_valid_ata(&maker_ata, expected_mint, ctx.accounts.maker.key())?;
    } else {
        let escrow_ata = ctx.accounts.order_token_escrow.to_account_info();
        let taker_ata = ctx.accounts.taker_token_ata.to_account_info();
        require_valid_ata(&escrow_ata, expected_mint, order_key)?;
        require_valid_ata(&taker_ata, expected_mint, ctx.accounts.taker.key())?;
    }

    let remaining = order_qty
        .checked_sub(filled_qty)
        .ok_or(SolPredictError::MathOverflow)?;

    let fill_qty = std::cmp::min(quantity, remaining);
    require!(fill_qty > 0, SolPredictError::InvalidQuantity);

    let trade_val = (fill_qty as u128)
        .checked_mul(price_bps as u128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_mul(ctx.accounts.market.share_price_lamports as u128)
        .ok_or(SolPredictError::MathOverflow)?
        .checked_div(10_000)
        .ok_or(SolPredictError::MathOverflow)?;
    let trade_val_u64 = u64::try_from(trade_val).map_err(|_| SolPredictError::MathOverflow)?;

    let token_units = (fill_qty as u128)
        .checked_mul(BASE_UNITS_PER_SHARE as u128)
        .ok_or(SolPredictError::MathOverflow)?;
    let token_units_u64 = u64::try_from(token_units).map_err(|_| SolPredictError::MathOverflow)?;

    if is_buy {
        // Maker is Buying tokens:
        // 1. Send SOL from the data-less order_escrow PDA -> Taker. This MUST
        //    be a CPI transfer: the taker is a system-owned account, so
        //    directly crediting lamports to it (add_lamports) is rejected by
        //    the runtime, and the system program refuses to debit a
        //    data-carrying account — hence the escrow lives on a dedicated
        //    plain system account.
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
                    to: ctx.accounts.taker.to_account_info(),
                },
                escrow_signer_seeds,
            ),
            trade_val_u64,
        )?;

        // 2. Transfer tokens Taker -> Maker
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.taker_token_ata.to_account_info(),
                    to: ctx.accounts.maker_token_ata.to_account_info(),
                    authority: ctx.accounts.taker.to_account_info(),
                },
            ),
            token_units_u64,
        )?;
    } else {
        // Maker is Selling tokens:
        // 1. Transfer SOL Taker -> Maker
        system_program::transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                system_program::Transfer {
                    from: ctx.accounts.taker.to_account_info(),
                    to: ctx.accounts.maker.to_account_info(),
                },
            ),
            trade_val_u64,
        )?;

        // 2. Transfer tokens Order escrow -> Taker
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
                    to: ctx.accounts.taker_token_ata.to_account_info(),
                    authority: ctx.accounts.order.to_account_info(),
                },
                signer_seeds,
            ),
            token_units_u64,
        )?;
    }

    let order = &mut ctx.accounts.order;
    order.filled_quantity = order
        .filled_quantity
        .checked_add(fill_qty)
        .ok_or(SolPredictError::MathOverflow)?;

    if order.filled_quantity >= order.quantity {
        order.status = OrderStatus::Filled;
    }

    msg!(
        "Filled Order #{}: fill_qty={}, trade_val={}",
        order_id,
        fill_qty,
        trade_val_u64
    );

    Ok(())
}
