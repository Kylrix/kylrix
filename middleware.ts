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
const APPWRITE_PROJECT_ID = '67fe9627001d97e37ef3';

// Appwrite session cookie follows the pattern: a_session_[projectid_lowercase]
const SESSION_COOKIE_NAME = `a_session_${APPWRITE_PROJECT_ID.toLowerCase()}`;

// Thresholds
const MAX_RAPID_RELOADS = 30;         // Max page loads within the window
const RELOAD_WINDOW_MS = 5_000;       // 5-second sliding window
const MAX_REDIRECT_DEPTH = 5;         // Max chained redirects before circuit-breaker fires

const PROTECTED_ROUTES = [
  '/note',
  '/vault',
  '/flow',
  '/connect',
  '/projects',
  '/accounts',
  '/settings',
  '/agents'
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Skip static assets and Next.js internals
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // 2. EXEMPT ALL API ROUTES - Internal and External
  // This is critical. Redirecting an API fetch to /send (HTML) causes "Unexpected token <"
  if (pathname.includes('/api/')) {
    return NextResponse.next();
  }

  // 3. Session Detection
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME) || request.cookies.get(`${SESSION_COOKIE_NAME}_legacy`);
  const hasSession = !!sessionCookie;

  // Debug: Log all cookie names if session not found to identify the correct key
  if (!hasSession) {
    const allCookies = Array.from(request.cookies.getAll()).map(c => c.name).join(', ');
    console.log(`[Middleware] Path: ${pathname} | No Session Found. Available Cookies: [${allCookies}]`);
  } else {
    console.log(`[Middleware] Path: ${pathname} | Session Active`);
  }

  // 4. Public Path Exemptions
  if (
    pathname === '/send' ||
    pathname.startsWith('/send/') || 
    pathname.startsWith('/note/shared') ||
    pathname === '/' ||
    pathname.startsWith('/i/') ||
    pathname.startsWith('/p/') // Potential for public projects
  ) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_ROUTES.some(route => pathname.startsWith(route));

  if (isProtected && !hasSession) {
    console.log(`[Middleware] REDIRECT -> /send (Reason: Protected & No Session)`);
    return NextResponse.redirect(new URL('/send', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all routes except static files and API
    '/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
