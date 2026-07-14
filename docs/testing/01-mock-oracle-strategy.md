# Mock Oracle Strategy

Because SOLPredict runs on-chain validations for the Pyth price account (staleness, feed ID, confidence, exponent comparison), testing settlement locally requires constructing a mock Pyth `PriceUpdateV2` account with custom properties.

## Strategy: Direct Account Data Mocking

Since Pyth Receiver is deployed on Devnet, we can mock it in local integration tests by:
1. Deriving a keypair to represent the mock oracle account.
2. Directly writing serialized Borsh data corresponding to our custom `PriceUpdateV2` structure into that account on-chain.
3. Using the local validator's ability to initialize custom accounts with arbitrary owner programs (in this case, the Pyth receiver program id).

## Verification Account Structure (Borsh Layout)

The mock account data is written with the following structure:
- **8 bytes**: Anchor discriminator of `PriceUpdateV2`.
- **32 bytes**: `write_authority` Pubkey.
- **VerificationLevel Enum**:
  - `Full` tag: `1` (1 byte).
- **PriceFeedMessage Struct**:
  - `feed_id`: `[u8; 32]` (32 bytes).
  - `price`: `[u8; 8]` (8 bytes, big-endian i64).
  - `conf`: `[u8; 8]` (8 bytes, big-endian u64).
  - `exponent`: `[u8; 4]` (4 bytes, big-endian i32).
  - `publish_time`: `[u8; 8]` (8 bytes, big-endian i64).
  - `prev_publish_time`: `[u8; 8]` (8 bytes, big-endian i64).
  - `ema_price`: `[u8; 8]` (8 bytes, big-endian i64).
  - `ema_conf`: `[u8; 8]` (8 bytes, big-endian u64).
- **8 bytes**: `posted_slot` (u64).

## Helper Code Example (`tests/helpers/mock-pyth.ts`)

```typescript
import * as anchor from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";

// Dummy program ID matching standard Pyth receiver
export const PYTH_PROGRAM_ID = new PublicKey("rec5vq4ECMs3m9npaSTQQa9YZt5d6568N7dvoG728K7");

export function createPriceUpdateBuffer(
  feedId: Buffer,
  price: bigint,
  conf: bigint,
  exponent: number,
  publishTime: bigint
): Buffer {
  const buffers: Buffer[] = [];

  // 1. Anchor Discriminator for PriceUpdateV2 (8 bytes)
  // Let's compute or use the standard discriminator: sha256("account:PriceUpdateV2")[0..8]
  // In Pyth, it is: [85, 230, 203, 117, 219, 107, 107, 107]
  const discriminator = Buffer.from([85, 230, 203, 117, 219, 107, 107, 107]);
  buffers.push(discriminator);

  // 2. write_authority Pubkey (32 bytes)
  buffers.push(Buffer.alloc(32));

  // 3. VerificationLevel::Full tag (1 byte)
  buffers.push(Buffer.from([1]));

  // 4. PriceFeedMessage - feed_id (32 bytes)
  buffers.push(feedId);

  // 5. PriceFeedMessage - price (8 bytes BE)
  const priceBuf = Buffer.alloc(8);
  priceBuf.writeBigInt64BE(price);
  buffers.push(priceBuf);

  // 6. PriceFeedMessage - conf (8 bytes BE)
  const confBuf = Buffer.alloc(8);
  confBuf.writeBigUint64BE(conf);
  buffers.push(confBuf);

  // 7. PriceFeedMessage - exponent (4 bytes BE)
  const expBuf = Buffer.alloc(4);
  expBuf.writeInt32BE(exponent);
  buffers.push(expBuf);

  // 8. PriceFeedMessage - publish_time (8 bytes BE)
  const pubTimeBuf = Buffer.alloc(8);
  pubTimeBuf.writeBigInt64BE(publishTime);
  buffers.push(pubTimeBuf);

  // 9. PriceFeedMessage - prev_publish_time (8 bytes BE)
  buffers.push(Buffer.alloc(8));

  // 10. PriceFeedMessage - ema_price (8 bytes BE)
  buffers.push(Buffer.alloc(8));

  // 11. PriceFeedMessage - ema_conf (8 bytes BE)
  buffers.push(Buffer.alloc(8));

  // 12. posted_slot (8 bytes LE)
  buffers.push(Buffer.alloc(8));

  return Buffer.concat(buffers);
}
```
This strategy ensures testing is completely independent of external network states or APIs, facilitating deterministic local integration tests.
