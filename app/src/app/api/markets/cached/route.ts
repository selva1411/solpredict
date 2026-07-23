import { NextResponse } from 'next/server';
import { getCachedMarketsFromDb } from '@/lib/db/store';

export async function GET() {
  try {
    const markets = await getCachedMarketsFromDb();
    return NextResponse.json({ ok: true, markets });
  } catch (err: any) {
    console.error("Error fetching cached markets API:", err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
