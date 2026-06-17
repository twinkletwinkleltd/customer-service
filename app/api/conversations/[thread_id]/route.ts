// app/api/conversations/[thread_id]/route.ts
//
// Step 2b detail-view proxy. Mirrors feed/route.ts: forwards to
// portal-web Flask at /api/conversations/<thread_id>, falls back to
// mock when PORTAL_FLASK_URL is unset (dev workflow). PATCH is
// supported too so status / starred / tags mutations work.
//
// thread_id values from Flask are of the form "gmail:<gmail_thread_id>"
// which contains a ":" character. The Next.js route param decoder
// handles this transparently.

import type { NextRequest } from 'next/server'
import { MOCK_THREAD_FALLBACK } from '@/lib/inbox-fallback'

type Ctx = { params: Promise<{ thread_id: string }> }

export async function GET(request: NextRequest, ctx: Ctx) {
  const { thread_id } = await ctx.params
  const flaskBase = process.env.PORTAL_FLASK_URL?.replace(/\/+$/, '') ?? ''

  if (!flaskBase) {
    const fallback = MOCK_THREAD_FALLBACK(thread_id)
    if (!fallback) {
      return Response.json(
        { ok: false, error: 'not_found', thread_id },
        { status: 404 },
      )
    }
    return Response.json(fallback)
  }

  const url = `${flaskBase}/api/conversations/${encodeURIComponent(thread_id)}`
  try {
    const resp = await fetch(url, {
      method: 'GET',
      headers: forwardedHeaders(request),
      cache: 'no-store',
    })
    const body = await resp.text()
    return new Response(body, {
      status: resp.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  } catch (err: unknown) {
    return Response.json({
      ok: false,
      error: 'flask_unreachable',
      message: (err as Error).message,
    }, { status: 502 })
  }
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { thread_id } = await ctx.params
  const flaskBase = process.env.PORTAL_FLASK_URL?.replace(/\/+$/, '') ?? ''

  // Dev/no-flask: pretend the mutation succeeded.
  if (!flaskBase) {
    const fallback = MOCK_THREAD_FALLBACK(thread_id)
    if (!fallback) {
      return Response.json(
        { ok: false, error: 'not_found', thread_id },
        { status: 404 },
      )
    }
    return Response.json({
      ok: true,
      thread: fallback.thread,
      accepted: await request.json().catch(() => ({})),
      _meta: { data_source: 'mock-fallback', persisted: false },
    })
  }

  const url = `${flaskBase}/api/conversations/${encodeURIComponent(thread_id)}/status`
  try {
    const body = await request.text()
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        ...forwardedHeaders(request),
        'content-type': 'application/json',
      },
      body,
      cache: 'no-store',
    })
    const respBody = await resp.text()
    return new Response(respBody, {
      status: resp.status,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    })
  } catch (err: unknown) {
    return Response.json({
      ok: false,
      error: 'flask_unreachable',
      message: (err as Error).message,
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
