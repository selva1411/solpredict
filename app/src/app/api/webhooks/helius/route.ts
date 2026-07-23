import { NextRequest, NextResponse } from 'next/server';
import { insertTrade, upsertMarketCache } from '@/lib/db/store';

export async function POST(req: NextRequest) {
  try {
    // Verify secret if set in environment
    const secret = process.env.HELIUS_WEBHOOK_SECRET;
    if (secret) {
      const authHeader = req.headers.get('authorization');
      if (authHeader !== `Bearer ${secret}` && authHeader !== secret) {
        return NextResponse.json({ error: 'Unauthorized webhook request' }, { status: 401 });
      }
    }

    const events = await req.json();
    if (!Array.isArray(events)) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    let count = 0;
    for (const event of events) {
      const { signature, timestamp, slot, instructions } = event;
      if (!instructions) continue;

      for (const ix of instructions) {
        if (ix.programId !== process.env.NEXT_PUBLIC_PROGRAM_ID) continue;

        const parsedType = ix.parsed?.type || ix.type;
        const info = ix.parsed?.info || {};

        if (parsedType === 'buyShares' || parsedType === 'sellShares') {
          const { market, buyer, seller, side, quantity, cost, refund } = info;
          const trader = buyer || seller || 'Unknown';
          const isBuy = parsedType === 'buyShares';
          const sideStr = typeof side === 'object' && 'yes' in side ? 'YES' : 'NO';
          const amountLamports = cost || refund || 0;

          await insertTrade({
            signature: signature || `tx_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            marketPubkey: market || 'Unknown',
            trader,
            side: sideStr as 'YES' | 'NO',
            lamportsIn: Number(amountLamports),
            tokensOut: Number(quantity || 0) * 1_000_000,
            pricePerToken: amountLamports / Math.max(1, Number(quantity || 1) * 1_000_000),
            blockTime: timestamp ? new Date(timestamp * 1000) : new Date(),
            slot: slot || 0,
          });
          count++;
        }
      }
    }

    return NextResponse.json({ ok: true, processed: count });
  } catch (err: any) {
    console.error("Helius webhook processing error:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "online",
    service: "SolPredict Helius Webhook Indexer",
    timestamp: new Date().toISOString(),
  });
}
