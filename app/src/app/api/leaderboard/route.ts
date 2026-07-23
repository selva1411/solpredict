import { NextResponse } from 'next/server';
import { getLeaderboardData } from '@/lib/db/store';

export async function GET() {
  try {
    const leaderboard = await getLeaderboardData();
    return NextResponse.json({ ok: true, leaderboard });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
