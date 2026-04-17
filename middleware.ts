/**
 * Auth-guard middleware — checks X-Portal-User header (set by nginx from
 * portal_user cookie) on every request to /customer-service/*.
 *
 * Requirements:
 * - All routes (pages + API) require X-Portal-User
 * - Missing/empty header:
 *     - API routes (/customer-service/api/*) → 401 JSON
 *     - Page routes → 302 redirect to portal login
 * - Static assets (/_next/*, favicon) bypass the check
 *
 * Local dev: header may be absent if not running behind nginx.
 *   Set NEXT_PUBLIC_DEV_BYPASS_AUTH=true in .env.local to skip the check.
 */

import { NextRequest, NextResponse } from 'next/server';

const PORTAL_LOGIN_URL = '/login';   // portal-relative path (outside basePath)
const HEADER_NAME = 'x-portal-user';

const ALLOWED_USERS_FALLBACK = ['star000', 'star001', 'star002', 'star003'];

function isAllowedUser(username: string): boolean {
  if (!username) return false;
  // Match the same allowlist enforced by the portal itself
  return ALLOWED_USERS_FALLBACK.includes(username);
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Bypass: Next internals + static assets
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon') ||
    pathname.endsWith('.ico') ||
    pathname.endsWith('.png') ||
    pathname.endsWith('.jpg') ||
    pathname.endsWith('.svg') ||
    pathname.endsWith('.webp')
  ) {
    return NextResponse.next();
  }

  // Local dev bypass
  if (process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === 'true') {
    return NextResponse.next();
  }

  const portalUser = req.headers.get(HEADER_NAME)?.trim() || '';

  if (!isAllowedUser(portalUser)) {
    // API routes return JSON 401
    if (pathname.startsWith('/api/') || pathname.includes('/api/')) {
      return NextResponse.json(
        {
          error: 'unauthenticated',
          message: 'Login to portal first.',
          login_url: PORTAL_LOGIN_URL,
        },
        { status: 401 },
      );
    }
    // Page routes redirect to portal login
    const loginUrl = new URL(PORTAL_LOGIN_URL, req.url);
    loginUrl.searchParams.set('next', req.nextUrl.pathname + req.nextUrl.search);
    return NextResponse.redirect(loginUrl);
  }

  // Pass username through to the app via x-portal-user (already there) +
  // a debug header so the app can confirm middleware ran
  const res = NextResponse.next();
  res.headers.set('x-cs-auth-checked', 'true');
  return res;
}

export const config = {
  // Match every path under the basePath; Next runs this for /customer-service/*
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon
     */
    '/((?!_next/static|_next/image|favicon).*)',
  ],
};
