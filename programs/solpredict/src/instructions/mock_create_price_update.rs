use anchor_lang::prelude::*;

/// Accounts for the `mock_create_price_update` instruction.
///
/// Creates a mock Pyth PriceUpdateV2 account. Only used for testing.
#[derive(Accounts)]
pub struct MockCreatePriceUpdate<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    /// CHECK: This is a raw AccountInfo that we manually initialize and populate.
    #[account(
        init,
        payer = payer,
        space = 134,
        seeds = [b"mock_price_feed", payer.key().as_ref()],
        bump,
    )]
    pub price_update: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Handler for `mock_create_price_update`.
///
/// Writes mock Pyth V2 price update data directly to the account.
pub fn handler(
    ctx: Context<MockCreatePriceUpdate>,
    feed_id: [u8; 32],
    price: i64,
    conf: u64,
    exponent: i32,
    publish_time: i64,
) -> Result<()> {
    let price_update = &ctx.accounts.price_update;
    let mut data = price_update.try_borrow_mut_data()?;

    // 1. Write Anchor discriminator for PriceUpdateV2: [85, 230, 203, 117, 219, 107, 107, 107]
    let discriminator = [85, 230, 203, 117, 219, 107, 107, 107];
    data[0..8].copy_from_slice(&discriminator);

    // 2. Write write_authority (payer Pubkey)
    let authority = ctx.accounts.payer.key().to_bytes();
    data[8..40].copy_from_slice(&authority);

    // 3. Write verification_level: VerificationLevel::Full
    // VerificationLevel in Borsh:
    //   Partial = tag 0 + 1 byte num_signatures
    //   Full = tag 1
    // Since we mock Full verification, we write tag 1 at offset 40.
    data[40] = 1;

    // 4. Write PriceFeedMessage fields:
    // feed_id (32 bytes) starting at offset 41 (40 is tag, 41 starts price_message)
    data[41..73].copy_from_slice(&feed_id);

    // price (8 bytes, big-endian)
    data[73..81].copy_from_slice(&price.to_be_bytes());

    // conf (8 bytes, big-endian)
    data[81..89].copy_from_slice(&conf.to_be_bytes());

    // exponent (4 bytes, big-endian)
    data[89..93].copy_from_slice(&exponent.to_be_bytes());

    // publish_time (8 bytes, big-endian)
    data[93..101].copy_from_slice(&publish_time.to_be_bytes());

    // prev_publish_time (8 bytes, big-endian) - unused
    let zeroes_8 = [0u8; 8];
    data[101..109].copy_from_slice(&zeroes_8);

    // ema_price (8 bytes, big-endian) - unused
    data[109..117].copy_from_slice(&zeroes_8);

    // ema_conf (8 bytes, big-endian) - unused
    data[117..125].copy_from_slice(&zeroes_8);

    // 5. Write posted_slot: u64 (8 bytes, little-endian) - unused
    data[125..133].copy_from_slice(&zeroes_8);

    msg!(
        "Mock price update initialized: feed={:?}, price={}, expo={}, publish_time={}",
        feed_id,
        price,
        exponent,
        publish_time
    );

    Ok(())
}
