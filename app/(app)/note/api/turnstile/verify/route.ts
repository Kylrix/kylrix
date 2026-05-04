import { NextResponse, NextRequest } from 'next/server';
import { verifyTurnstileToken } from '@/lib/turnstile';
import { createRateLimiter } from '@/lib/rate-limit-middleware';

const rateLimiter = createRateLimiter({
  max: 30,
  windowMs: 60 * 1000,
});

export async function POST(req: NextRequest) {
  const { allowed, retryAfter } = rateLimiter(req);

  if (!allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      {
        status: 429,
        headers: { 'Retry-After': retryAfter?.toString() || '60' },
      }
    );
  }

  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { error: 'Missing token' },
        { status: 400 }
      );
    }

    const result = await verifyTurnstileToken(token);

    if (!result.success) {
      return NextResponse.json(
        { error: 'Verification failed', codes: result.error_codes },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Turnstile verification error:', error);
    return NextResponse.json(
      { error: 'Verification error' },
      { status: 500 }
    );
  }
}
