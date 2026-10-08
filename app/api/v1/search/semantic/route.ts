import { NextRequest, NextResponse } from 'next/server';
import { searchSemantic, upsertVectors, generateEmbedding } from '@/lib/cloudflare/vectorize';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams.get('q') || '';
    const topK = parseInt(req.nextUrl.searchParams.get('topK') || '5', 10);

    if (!q.trim()) {
      return NextResponse.json({ ok: false, error: 'Query parameter "q" is required' }, { status: 400 });
    }

    const matches = await searchSemantic(q, topK);
    return NextResponse.json({ ok: true, query: q, matches });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Semantic search failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { id, text, metadata } = body;

    if (!id || !text) {
      return NextResponse.json({ ok: false, error: 'Both "id" and "text" are required' }, { status: 400 });
    }

    const vector = await generateEmbedding(text);
    const result = await upsertVectors([{ id, values: vector, metadata: metadata || {} }]);

    return NextResponse.json({ ok: true, indexed: result.count, id });
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message || 'Vector indexing failed' }, { status: 500 });
  }
}
