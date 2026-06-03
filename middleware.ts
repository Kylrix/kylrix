import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

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

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Skip static assets, API routes, and Next.js internals entirely — zero overhead
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.') // static files like .css, .js, .png
  ) {
    return NextResponse.next();
  }

  // Instant Route Forwards
  if (pathname === '/note' || pathname === '/note/') {
    return NextResponse.redirect(new URL('/note/notes', request.url));
  }
  
  if (pathname === '/flow' || pathname === '/flow/') {
    return NextResponse.redirect(new URL('/flow/tasks', request.url));
  }

  if (pathname === '/vault' || pathname === '/vault/') {
    return NextResponse.redirect(new URL('/vault/dashboard', request.url));
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
    // Match all routes except static files and API
    '/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
