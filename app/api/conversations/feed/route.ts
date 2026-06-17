// app/api/conversations/feed/route.ts
//
// Step 2b proxy route: customer-service Next.js -> portal-web Flask.
//
// The Inbox page reads /customer-service/api/conversations/feed via the
// usual `apiPath()` helper. That URL lands here. We forward the request
// to the Flask blueprint at /api/conversations/feed on portal-web,
// passing the SSO cookie + X-Portal-User header + query string so
// RBAC and request context match.
//
// Why a proxy and not a direct browser-to-Flask fetch?
//   * Keeps the apiPath() pattern uniform — every API call in
//     customer-service goes through `/customer-service/api/*`.
//   * Lets us implement a dev-friendly fallback: if PORTAL_FLASK_URL
//     is unset or Flask is unreachable (typical local `npm run dev`
//     workflow), we serve a small mock payload so the UI still
//     functions during front-end work.
//
// Production deploy:
//   Set PORTAL_FLASK_URL in customer-service systemd unit, e.g.
//     Environment="PORTAL_FLASK_URL=https://ordercleaner.twinkletwinkle.uk"
//   The cross-origin trip is short (same VPS, same nginx) but lets
//   us avoid mucking with unix-socket fetch from Node.

import type { NextRequest } from 'next/server'
import { MOCK_FEED_FALLBACK } from '@/lib/inbox-fallback'

export async function GET(request: NextRequest) {
  const search = request.nextUrl.search ?? ''
  const flaskBase = process.env.PORTAL_FLASK_URL?.replace(/\/+$/, '') ?? ''

  // Dev / unconfigured: short-circuit to mock.
  if (!flaskBase) {
    return Response.json(MOCK_FEED_FALLBACK)
  }

  const url = `${flaskBase}/api/conversations/feed${search}`
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: forwardedHeaders(request),
      // We do not cache the inbox feed — operator wants live data.
      cache: 'no-store',
    })
    const body = await resp.text()
    return new Response(body, {
      status: resp.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  } catch (err: unknown) {
    // Flask unreachable. The Inbox UI handles `ok:false` gracefully
    // and surfaces a banner; we still return a usable empty envelope
    // so the page does not error-page out.
    return Response.json({
      ok: false,
      error: 'flask_unreachable',
      message: (err as Error).message,
      items: [],
      total: 0,
      unread_total: 0,
      next_cursor: null,
    }, { status: 502 })
  }
}

function forwardedHeaders(request: NextRequest): HeadersInit {
  const cookie = request.headers.get('cookie') ?? ''
  const xPortalUser = request.headers.get('x-portal-user') ?? ''
  return {
    cookie,
    'x-portal-user': xPortalUser,
    'x-requested-with': 'XMLHttpRequest',
    accept: 'application/json',
  }
}
