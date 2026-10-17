import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth/better-auth';

const SOCIAL_PROVIDERS = new Set(['google', 'github']);

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!SOCIAL_PROVIDERS.has(provider)) {
    return new Response('Unsupported OAuth provider', { status: 400 });
  }

  const callbackURL = request.nextUrl.searchParams.get('callbackURL') || '/app';
  return auth.api.signInSocial({
    body: {
      provider,
      callbackURL,
    },
    headers: request.headers,
  });
}
