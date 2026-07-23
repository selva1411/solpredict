import { NextRequest, NextResponse } from 'next/server';
import { getMarketComments, addMarketComment } from '@/lib/db/store';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketPubkey } = await params;
    const comments = await getMarketComments(marketPubkey);
    return NextResponse.json({ ok: true, comments });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: marketPubkey } = await params;
    const { authorWallet, authorUsername, content, parentId } = await req.json();

    if (!authorWallet || !content) {
      return NextResponse.json({ error: 'authorWallet and content required' }, { status: 400 });
    }

    const created = await addMarketComment({
      marketPubkey,
      authorWallet,
      authorUsername,
      content,
      parentId,
    });

    return NextResponse.json({ ok: true, comment: created });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
