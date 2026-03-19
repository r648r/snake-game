import { NextResponse } from 'next/server';
import { getTopScores, addScore } from '@/lib/scores';

export async function GET() {
  try {
    const scores = await getTopScores();
    return NextResponse.json(scores);
  } catch (err) {
    console.error('[GET /api/scores]', err);
    return NextResponse.json({ error: 'Failed to fetch scores' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = String(body.name ?? '').trim().toUpperCase().slice(0, 16);
    const score = Number(body.score);

    if (!name || !Number.isInteger(score) || score < 0) {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    const entry = await addScore({ name, score });
    return NextResponse.json(entry, { status: 201 });
  } catch (err) {
    console.error('[POST /api/scores]', err);
    return NextResponse.json({ error: 'Failed to save score' }, { status: 500 });
  }
}
