import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth/better-auth';

const SOCIAL_PROVIDERS = new Set(['google', 'github']);

/**
 * Validate and sanitize callbackURL to prevent Open Redirect vulnerabilities.
 * Ensures the target is a relative path starting with '/' and not a protocol-relative
 * or external URL (e.g., //evil.com, https://evil.com, /\\evil.com).
 */
export function sanitizeCallbackUrl(url: string | null | undefined): string {
  if (!url || typeof url !== 'string') return '/app';

  const trimmed = url.trim();

  // Reject absolute URLs, protocol-relative URLs, control characters, whitespace at head, or backslash evasion attempts
  if (
    trimmed.startsWith('//') ||
    trimmed.startsWith('/\\') ||
    /^\/[/\\]/.test(trimmed) ||
    /^\/\s/.test(trimmed) ||
    /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ||
    /[\x00-\x1F\x7F]/.test(trimmed)
  ) {
    return '/app';
  }

  // Must start with '/'
  if (!trimmed.startsWith('/')) {
    return '/app';
  }

  try {
    const parsed = new URL(trimmed, 'https://dummy-base.local');
    if (parsed.origin !== 'https://dummy-base.local' || parsed.pathname.startsWith('//')) {
      return '/app';
    }
    return parsed.pathname + parsed.search + parsed.hash;
  } catch {
    return '/app';
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!SOCIAL_PROVIDERS.has(provider)) {
    return new Response('Unsupported OAuth provider', { status: 400 });
  }

  const rawCallbackURL = request.nextUrl.searchParams.get('callbackURL');
  const callbackURL = sanitizeCallbackUrl(rawCallbackURL);

  const result = await auth.api.signInSocial({
    body: {
      provider,
      callbackURL,
    },
    headers: request.headers,
  });

  if (result && typeof result === 'object' && 'url' in result && typeof result.url === 'string') {
    return NextResponse.redirect(new URL(result.url, request.url));
  }

  return NextResponse.json(result, { status: 400 });
}
