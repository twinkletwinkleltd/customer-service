// lib/inbox-api.ts
//
// Step 2b client-side API helpers. Components call these and receive
// the UI-friendly camelCase shape from lib/inbox-types.ts. The
// snake_case Flask envelope (relayed via the Next.js proxy at
// /customer-service/api/conversations/*) is mapped here.
//
// Error envelope: each function returns either `{ ok: true, ... }` or
// `{ ok: false, error, message }`. The Inbox pages surface
// `error === 'gmail_not_configured'` as a friendly banner pointing at
// the runbook; everything else gets a generic "failed to load" bar.

import { apiPath } from './api-path'
import type {
  CategoryReason,
  InboxMessage,
  InboxThread,
  ThreadChannel,
  ThreadStatus,
} from './inbox-types'

// ---------------------------------------------------------------------------
// Wire envelopes (what the Flask backend returns)
// ---------------------------------------------------------------------------

interface WireFeedItem {
  thread_id: string
  channel: string
  subject: string
  status: string
  starred: boolean
  unread: boolean
  tags: string[]
  category_reasons?: string[] | null
  source?: string | null
  last_inbound_at: string | null
  last_inbound_preview: string | null
  customer_name: string | null
  customer_email: string | null
  order_id: string | null
}

interface WireFeedResponse {
  ok: boolean
  items?: WireFeedItem[]
  total?: number
  unread_total?: number
  next_cursor?: string | null
  error?: string
  message?: string
  _meta?: Record<string, unknown>
}

interface WireMessage {
  id: string | number
  source_record_id?: string
  channel?: string
  message_text?: string
  created_at?: string
  sender_name?: string | null
  sender_email?: string | null
  direction: 'in' | 'out'
  subject?: string
  preview?: string
}

interface WireThreadDetail {
  thread_id: string
  channel: string
  subject: string
  status: string
  starred?: boolean
  tags?: string[]
  category_reasons?: string[] | null
  source?: string | null
  last_inbound_at: string | null
  last_outbound_at?: string | null
  customer_name?: string | null
  customer_email?: string | null
  order_id?: string | null
  messages: WireMessage[]
}

interface WireDetailResponse {
  ok: boolean
  thread?: WireThreadDetail
  error?: string
  message?: string
  _meta?: Record<string, unknown>
}

// ---------------------------------------------------------------------------
// UI-side return types
// ---------------------------------------------------------------------------

export type InboxFeedItem = Pick<
  InboxThread,
  'id' | 'customerName' | 'customerEmail' | 'subject'
  | 'status' | 'unread' | 'lastInboundAt' | 'lastInboundPreview'
  | 'orderId' | 'tags' | 'source' | 'channel' | 'categoryReasons'
>

export type FeedResult =
  | { ok: true; items: InboxFeedItem[]; unreadTotal: number; total: number }
  | { ok: false; error: string; message: string }

export type ThreadResult =
  | { ok: true; thread: InboxThread }
  | { ok: false; error: string; message: string }

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function mapFeedItem(w: WireFeedItem): InboxFeedItem {
  return {
    id:                  w.thread_id,
    customerName:        w.customer_name ?? '',
    customerEmail:       w.customer_email ?? '',
    subject:             w.subject ?? '',
    status:              normaliseStatus(w.status),
    unread:              Boolean(w.unread),
    lastInboundAt:       w.last_inbound_at ?? '',
    lastInboundPreview:  w.last_inbound_preview ?? '',
    orderId:             w.order_id ?? undefined,
    tags:                Array.isArray(w.tags) ? w.tags : [],
    source:              w.source ?? undefined,
    channel:             normaliseChannel(w.channel),
    categoryReasons:     Array.isArray(w.category_reasons) ? w.category_reasons : [],
  }
}

function mapMessage(w: WireMessage): InboxMessage {
  return {
    id:           String(w.id),
    direction:    w.direction,
    text:         w.message_text ?? '',
    sentAt:       w.created_at ?? '',
    senderLabel:  w.sender_name || w.sender_email || '(unknown)',
  }
}

function mapThreadDetail(w: WireThreadDetail): InboxThread {
  return {
    id:                  w.thread_id,
    customerName:        w.customer_name ?? '',
    customerEmail:       w.customer_email ?? '',
    subject:             w.subject,
    status:              normaliseStatus(w.status),
    unread:              false,                 // detail view doesn't track this
    lastInboundAt:       w.last_inbound_at ?? '',
    lastInboundPreview:  '',
    orderId:             w.order_id ?? undefined,
    tags:                Array.isArray(w.tags) ? w.tags : [],
    source:              w.source ?? undefined,
    channel:             normaliseChannel(w.channel),
    categoryReasons:     Array.isArray(w.category_reasons) ? w.category_reasons : [],
    messages:            Array.isArray(w.messages) ? w.messages.map(mapMessage) : [],
  }
}

function normaliseStatus(s: string): ThreadStatus {
  return s === 'resolved' ? 'resolved' : 'open'
}

// 2026-06-17 (Phase 2a.1) — backend writes ``customer`` / ``promotional``
// / ``spam`` now, but pre-migration rows may still carry ``gmail`` or
// other legacy values. Anything we don't recognise falls back to
// ``customer`` (high-recall default — same heuristic the backend uses).
function normaliseChannel(c: string | undefined | null): ThreadChannel {
  if (c === 'promotional' || c === 'spam' || c === 'customer') return c
  return 'customer'
}

function decodeThreadId(threadId: string): string {
  try {
    return decodeURIComponent(threadId)
  } catch {
    return threadId
  }
}

// Re-export the type so consumers can import it from a single place.
export type { ThreadChannel, CategoryReason }


// ---------------------------------------------------------------------------
// Phase 2a.2 — Mark not spam (rescue)
// ---------------------------------------------------------------------------

interface WireMarkNotSpamResponse {
  ok: boolean
  thread?: WireThreadDetail
  error?: string
  message?: string
  gmail_response?: { id?: string | null; message_count?: number }
  _meta?: Record<string, unknown>
}

export type MarkNotSpamResult =
  | { ok: true; thread: InboxThread; gmailMessageCount: number }
  | { ok: false; error: string; message: string }

/** Rescue a spam-tagged thread: tell the backend to call Gmail
 *  ``threads.modify`` (SPAM → INBOX) + flip the local channel to
 *  ``customer``. Returns the updated thread on success.
 *
 *  Failure surfacing:
 *    - ``error === 'gmail_not_configured'``: token blob missing.
 *    - ``error === 'gmail_modify_failed'``: Gmail returned an error
 *      (most commonly a 403 because the operator still has the old
 *      ``gmail.readonly`` scope token — they need to re-run
 *      ``scripts/ops/gmail_oauth_setup.py``).
 *    - ``error === 'not_a_gmail_thread'``: Thread ID lacks ``gmail:``
 *      prefix; non-Gmail threads can't be rescued via this route.
 *    - ``error === 'forbidden'``: User lacks ``inquiries.rescue_spam``
 *      capability. */
export async function markNotSpam(threadId: string): Promise<MarkNotSpamResult> {
  const url = apiPath(`/conversations/${encodeURIComponent(decodeThreadId(threadId))}/mark-not-spam`)
  let json: WireMarkNotSpamResponse
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'x-requested-with': 'XMLHttpRequest',
        'content-type':     'application/json',
      },
      body: JSON.stringify({}),
      cache: 'no-store',
    })
    json = await resp.json() as WireMarkNotSpamResponse
  } catch (err: unknown) {
    return {
      ok: false,
      error: 'network_error',
      message: (err as Error).message,
    }
  }
  if (!json.ok || !json.thread) {
    return {
      ok: false,
      error: json.error ?? 'unknown',
      message: json.message ?? '',
    }
  }
  return {
    ok: true,
    thread: mapThreadDetail(json.thread),
    gmailMessageCount: Number(json.gmail_response?.message_count ?? 0),
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function fetchInboxFeed(params?: {
  status?: 'all' | ThreadStatus
  channel?: string
  limit?: number
}): Promise<FeedResult> {
  const search = new URLSearchParams()
  if (params?.status)  search.set('status',  params.status)
  if (params?.channel) search.set('channel', params.channel)
  if (params?.limit)   search.set('limit',   String(params.limit))
  const qs = search.toString()
  const url = apiPath('/conversations/feed') + (qs ? `?${qs}` : '')

  let json: WireFeedResponse
  try {
    const resp = await fetch(url, {
      headers: { 'x-requested-with': 'XMLHttpRequest' },
      cache: 'no-store',
    })
    json = await resp.json() as WireFeedResponse
  } catch (err: unknown) {
    return {
      ok: false,
      error: 'network_error',
      message: (err as Error).message,
    }
  }
  if (!json.ok) {
    return {
      ok: false,
      error: json.error ?? 'unknown',
      message: json.message ?? '',
    }
  }
  return {
    ok: true,
    items: (json.items ?? []).map(mapFeedItem),
    unreadTotal: Number(json.unread_total ?? 0),
    total:       Number(json.total ?? (json.items?.length ?? 0)),
  }
}

export async function fetchInboxThread(threadId: string): Promise<ThreadResult> {
  const url = apiPath(`/conversations/${encodeURIComponent(decodeThreadId(threadId))}`)
  let json: WireDetailResponse
  try {
    const resp = await fetch(url, {
      headers: { 'x-requested-with': 'XMLHttpRequest' },
      cache: 'no-store',
    })
    json = await resp.json() as WireDetailResponse
  } catch (err: unknown) {
    return {
      ok: false,
      error: 'network_error',
      message: (err as Error).message,
    }
  }
  if (!json.ok || !json.thread) {
    return {
      ok: false,
      error: json.error ?? 'unknown',
      message: json.message ?? '',
    }
  }
  return { ok: true, thread: mapThreadDetail(json.thread) }
}

export async function patchThreadStatus(threadId: string, patch: {
  status?: ThreadStatus
  starred?: boolean
  tags?: string[]
  assignee?: string | null
}): Promise<ThreadResult> {
  const url = apiPath(`/conversations/${encodeURIComponent(decodeThreadId(threadId))}`)
  let json: WireDetailResponse
  try {
    const resp = await fetch(url, {
      method: 'PATCH',
      headers: {
        'x-requested-with': 'XMLHttpRequest',
        'content-type':     'application/json',
      },
      body: JSON.stringify(patch),
      cache: 'no-store',
    })
    json = await resp.json() as WireDetailResponse
  } catch (err: unknown) {
    return {
      ok: false,
      error: 'network_error',
      message: (err as Error).message,
    }
  }
  if (!json.ok || !json.thread) {
    return {
      ok: false,
      error: json.error ?? 'unknown',
      message: json.message ?? '',
    }
  }
  return { ok: true, thread: mapThreadDetail(json.thread) }
}
