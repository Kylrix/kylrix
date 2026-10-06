import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { jwks } from '@/lib/db/schema';

export async function GET(_req: NextRequest) {
  try {
    const keys = await db.select().from(jwks);
    const formattedKeys = keys
      .map((k) => {
        try {
          const parsed = JSON.parse(k.publicKey);
          return {
            kid: k.id,
            alg: k.alg || 'RS256',
            use: 'sig',
            ...parsed,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return NextResponse.json(
      { keys: formattedKeys },
      {
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=3600',
        },
      }
    );
  } catch (_err: any) {
    return NextResponse.json({ keys: [] }, { status: 200 });
  }
}
