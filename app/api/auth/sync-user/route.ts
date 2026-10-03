import { NextResponse } from 'next/server';
import { ensureBetterAuthUserTurso } from '@/lib/actions/turso-ops';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id, name, email, emailVerified, image } = body || {};

    if (!id || !email) {
      return NextResponse.json({ error: 'Missing required user parameters' }, { status: 400 });
    }

    const result = await ensureBetterAuthUserTurso({
      id,
      name: name || (email ? email.split('@')[0] : 'User'),
      email,
      emailVerified: Boolean(emailVerified),
      image,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[api/auth/sync-user] Sync user failed:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to sync user' },
      { status: 500 }
    );
  }
}
