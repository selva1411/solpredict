import { NextRequest, NextResponse } from 'next/server';
import { recordLeaderboardSnapshot } from '@/lib/db/store';
import { db } from '@/lib/db/client';
import { leaderboardSnapshots } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';

export async function POST() {
  try {
    await recordLeaderboardSnapshot();
    return NextResponse.json({ ok: true, message: 'Leaderboard snapshot generated & saved to NeonDB' });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET() {
  try {
    if (db) {
      const snapshots = await db
        .select()
        .from(leaderboardSnapshots)
        .orderBy(desc(leaderboardSnapshots.id))
        .limit(50);
      return NextResponse.json({ ok: true, snapshots });
    }
    return NextResponse.json({ ok: true, snapshots: [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
