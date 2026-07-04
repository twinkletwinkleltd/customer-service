// app/api/conversations/[thread_id]/mark-not-spam/route.ts
//
// Phase 2a.2 — Spam rescue proxy.
//
// Forwards POST to portal-web Flask at
// /api/conversations/<thread_id>/mark-not-spam which calls Gmail
// threads.modify (SPAM -> INBOX) + flips the local channel to
// customer + writes an audit log line.
//
// When PORTAL_FLASK_URL is unset (typical local `npm run dev`), the
// route returns a dev-friendly stub so the UI button can be exercised
// without a real Flask backend.

import type { NextRequest } from 'next/server'

type Ctx = { params: Promise<{ thread_id: string }> }

export async function POST(request: NextRequest, ctx: Ctx) {
  const { thread_id: rawThreadId } = await ctx.params
  const thread_id = decodeThreadId(rawThreadId)
  const flaskBase = process.env.PORTAL_FLASK_URL?.replace(/\/+$/, '') ?? ''

  // Dev / unconfigured: pretend the rescue succeeded so the UI button
  // is testable. Returns a thread shape matching what real Flask
  // would emit so lib/inbox-api.ts's mapper handles it.
  if (!flaskBase) {
    return Response.json({
      ok: true,
      thread: {
        thread_id,
        channel: 'customer',
        subject: '(mock)',
        status: 'open',
        starred: false,
        tags: [],
        category_reasons: ['spam:gmail-label', 'operator:rescued-from-spam'],
        source: 'gmail',
        last_inbound_at: null,
        last_outbound_at: null,
        customer_name: 'Mock customer',
        customer_email: 'mock@example.com',
        order_id: null,
        messages: [],
      },
      gmail_response: { id: 'mock-tid', message_count: 1 },
      _meta: { data_source: 'mock-fallback', step: '2a.2' },
    })
  }

  const url = `${flaskBase}/api/conversations/${encodeURIComponent(thread_id)}/mark-not-spam`
  try {
    const body = await request.text().catch(() => '{}')
    const resp = await fetch(url, {
      method: 'POST',
      headers: forwardedHeaders(request),
      body: body || '{}',
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
    'content-type': 'application/json',
    accept: 'application/json',
  }
}

function decodeThreadId(threadId: string): string {
  try {
    return decodeURIComponent(threadId)
  } catch {
    return threadId
  }
}
