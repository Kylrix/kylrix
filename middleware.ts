import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  DEFAULT_AUTHENTICATED_ROUTE,
  isValidAppResumePath,
  LAST_ROUTE_COOKIE,
} from '@/lib/ecosystem/resume-route';
import { isSelfHostedDeployment } from '@/lib/deployment/surface';
import { enforceApiIpShield } from '@/lib/api/edge-shield';
import { KYLRIX_API_V1_BASE } from '@/sdk/api';

/**
 * KYLRIX APPLICATION LAYER PROTECTION
 * 
 * Defends against:
 * 1. Rapid reload storms (accidental double-clicks, broken code causing infinite reloads)
 * 2. Redirect loops (poorly-written auth guards bouncing between pages endlessly)
 * 3. API burst floods (client bugs firing the same request in a tight loop)
 * 
 * Uses a lightweight cookie-based counter that requires zero database reads.
 */

const RELOAD_COOKIE = 'k_rld';
const REDIRECT_DEPTH_PARAM = '_rd';

// Thresholds
const MAX_RAPID_RELOADS = 30;         // Max page loads within the window
const RELOAD_WINDOW_MS = 5_000;       // 5-second sliding window
const MAX_REDIRECT_DEPTH = 5;         // Max chained redirects before circuit-breaker fires

function hasAuthSessionHint(request: NextRequest): boolean {
  if (request.cookies.get('kylrix_pulse_v2')) return true;
  return request.cookies.getAll().some((cookie) => cookie.name.startsWith('a_session_'));
}

function readResumePathFromCookie(request: NextRequest): string | null {
  const raw = request.cookies.get(LAST_ROUTE_COOKIE)?.value;
  if (!raw) return null;
  try {
    const path = decodeURIComponent(raw);
    return isValidAppResumePath(path) ? path : null;
  } catch {
    return null;
  }
}

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // ── Universal Attribution & Referral Processing (?ref=...) ──
  const ref = searchParams.get('ref');
  let attributionCookieValue: string | null = null;

  if (ref) {
    const src = searchParams.get('src') || (ref.startsWith('agt_') ? 'agent' : (ref.startsWith('org_') ? 'org' : (ref.startsWith('cmp_') ? 'campaign' : 'user')));
    const origin = searchParams.get('origin') || 'direct';
    const attributionData = JSON.stringify({
      ref,
      src,
      origin,
      timestamp: Date.now(),
    });
    attributionCookieValue = Buffer.from(attributionData).toString('base64');
  }

  // Handle Root URL ('/')
  if (pathname === '/' || pathname === '') {
    const isSelfHosted = isSelfHostedDeployment();

    if (isSelfHosted) {
      // In self-hosted mode, brand landing page is completely disabled.
      // Always route to the last active app route or /app.
      const lastRoute = readResumePathFromCookie(request);
      const target = (lastRoute && lastRoute.startsWith('/') && lastRoute !== '/')
        ? lastRoute
        : DEFAULT_AUTHENTICATED_ROUTE;
      return NextResponse.redirect(new URL(target, request.url));
    }

    if (ref) {
      // If referral link clicked:
      if (hasAuthSessionHint(request)) {
        // Logged-in user: redirect to app to auto-claim referral
        const response = NextResponse.redirect(new URL('/app', request.url));
        if (attributionCookieValue) {
          response.cookies.set({
            name: 'attribution_payload',
            value: attributionCookieValue,
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
            sameSite: 'lax',
          });
        }
        return response;
      } else {
        // Guest user: stay on landing page and pop open auth drawer
        const landingWithAuth = new URL('/', request.url);
        landingWithAuth.searchParams.set('auth', 'open');
        const response = NextResponse.redirect(landingWithAuth);
        if (attributionCookieValue) {
          response.cookies.set({
            name: 'attribution_payload',
            value: attributionCookieValue,
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/',
            sameSite: 'lax',
          });
        }
        return response;
      }
    }

    if (searchParams.has('stay')) {
      // Guest/user traffic stays on the landing page if ?stay or ?stay=true is present
    } else {
      if (hasAuthSessionHint(request)) {
        const lastRoute = readResumePathFromCookie(request);
        const target = (lastRoute && lastRoute.startsWith('/') && lastRoute !== '/')
          ? lastRoute
          : DEFAULT_AUTHENTICATED_ROUTE;
        return NextResponse.redirect(new URL(target, request.url));
      } else {
        // Guests redirect to /app instantly
        return NextResponse.redirect(new URL('/app', request.url));
      }
    }
  }

  // Handle deep link ?ref= query parameter stripping (URL hygiene)
  if (ref && pathname !== '/') {
    const cleanUrl = new URL(request.url);
    cleanUrl.searchParams.delete('ref');
    cleanUrl.searchParams.delete('src');
    cleanUrl.searchParams.delete('origin');

    const response = NextResponse.redirect(cleanUrl);
    if (attributionCookieValue) {
      response.cookies.set({
        name: 'attribution_payload',
        value: attributionCookieValue,
        maxAge: 60 * 60 * 24 * 30,
        path: '/',
        sameSite: 'lax',
      });
    }
    return response;
  }

  // Skip static assets — but protect API and MCP surfaces from IP pounding.
  if (
    pathname.startsWith(KYLRIX_API_V1_BASE) ||
    pathname.startsWith('/api/mcp') ||
    pathname.startsWith('/api/dev')
  ) {
    const shield = enforceApiIpShield(request);
    if (!shield.allowed) {
      return NextResponse.json(
        {
          error: 'edge_rate_limited',
          message: 'Too many API requests from this network. Retry shortly.',
          retry_after: shield.retryAfterSec,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(shield.retryAfterSec),
            'Cache-Control': 'no-store',
          },
        },
      );
    }
    return NextResponse.next();
  }

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // static files like .css, .js, .png
  ) {
    return NextResponse.next();
  }

  // Next.js RSC flight + Server Actions (GET or POST) — never throttle; throttling these
  // breaks rendering and can trigger 429 → auto-reload loops during client churn.
  const isRscFlight =
    request.headers.get('RSC') === '1' ||
    request.headers.has('next-router-prefetch') ||
    request.headers.has('next-router-state-tree') ||
    request.headers.has('Next-Action') ||
    searchParams.has('_rsc') ||
    request.headers.get('accept')?.includes('text/x-component');

  if (isRscFlight) {
    return NextResponse.next();
  }

  // Instant Route Forwards (Legacy -> Canonical)
  const APP_NOTE_RESERVED = new Set([
    'shared', 'landing', 'admin', 'pitch', 'popout', 'notes', 'extensions', 'settings', 'api', 'test',
  ]);

  const legacyAppNote = pathname.match(/^\/app\/([^/]+)(?:\/(.*))?$/);
  if (legacyAppNote) {
    const [, segment, rest] = legacyAppNote;
    if (!APP_NOTE_RESERVED.has(segment)) {
      const targetPath = rest ? `/idea/${segment}/${rest}` : `/idea/${segment}`;
      const target = new URL(targetPath, request.url);
      target.search = request.nextUrl.search;
      return NextResponse.redirect(target, 308);
    }
  }

  if (pathname.startsWith('/note/notes') || pathname.startsWith('/app/notes')) {
    const subPath = pathname.startsWith('/note/notes') 
      ? pathname.replace('/note/notes', '') 
      : pathname.replace('/app/notes', '');
    return NextResponse.redirect(new URL(`/app${subPath}`, request.url));
  }

  if (pathname.startsWith('/vault/dashboard')) {
    const subPath = pathname.replace('/vault/dashboard', '');
    return NextResponse.redirect(new URL(`/vault${subPath}`, request.url));
  }

  // ─── REDIRECT LOOP DEFENSE ────────────────────────────────────────────
  const redirectDepth = parseInt(searchParams.get(REDIRECT_DEPTH_PARAM) || '0', 10);
  if (redirectDepth >= MAX_REDIRECT_DEPTH) {
    // Circuit breaker: stop the redirect chain, serve the page as-is
    const cleanUrl = request.nextUrl.clone();
    cleanUrl.searchParams.delete(REDIRECT_DEPTH_PARAM);
    const response = NextResponse.rewrite(cleanUrl);
    // Clear the counter so future navigation starts fresh
    return response;
  }

  // ─── RAPID RELOAD STORM DEFENSE ───────────────────────────────────────
  const now = Date.now();
  const reloadCookie = request.cookies.get(RELOAD_COOKIE)?.value;
  let reloadData: { count: number; windowStart: number } = { count: 0, windowStart: now };

  if (reloadCookie) {
    try {
      reloadData = JSON.parse(reloadCookie);
    } catch {
      // Corrupted cookie — reset
      reloadData = { count: 0, windowStart: now };
    }
  }

  // Check if we're still in the active window
  if (now - reloadData.windowStart < RELOAD_WINDOW_MS) {
    reloadData.count++;
  } else {
    // Window expired — start a new one
    reloadData = { count: 1, windowStart: now };
  }

  if (reloadData.count > MAX_RAPID_RELOADS) {
    // Throttle: return a 429 with a brief cooldown message
    return new NextResponse(
      `<html>
        <head><meta charset="utf-8"><title>Slow Down</title></head>
        <body style="display:flex;align-items:center;justify-content:center;height:100vh;margin:0;background:#0a0a0a;color:#fff;font-family:system-ui">
          <div style="text-align:center">
            <h1 style="font-size:1.5rem;font-weight:800;margin-bottom:0.5rem">Too many requests</h1>
            <p style="opacity:0.5;font-size:0.9rem">Please wait a moment before refreshing.</p>
            <script>setTimeout(()=>location.reload(),3000)</script>
          </div>
        </body>
      </html>`,
      {
        status: 429,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Retry-After': '3',
        },
      }
    );
  }

  // Proceed normally, updating the reload tracking cookie
  const response = NextResponse.next();
  response.cookies.set(RELOAD_COOKIE, JSON.stringify(reloadData), {
    path: '/',
    maxAge: Math.ceil(RELOAD_WINDOW_MS / 1000),
    httpOnly: true,
    sameSite: 'lax',
  });

  return response;
}

export const config = {
  matcher: [
    // Match all routes except static files, APIs, and file extensions
    '/((?!_next/static|_next/image|favicon.ico|api|.*\\.[\\w]+$).*)'
  ],
};
