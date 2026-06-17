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
import type { InboxMessage, InboxThread, ThreadStatus } from './inbox-types'

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
  | 'orderId' | 'tags' | 'source'
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
    messages:            Array.isArray(w.messages) ? w.messages.map(mapMessage) : [],
  }
}

function normaliseStatus(s: string): ThreadStatus {
  return s === 'resolved' ? 'resolved' : 'open'
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
  const url = apiPath(`/conversations/${encodeURIComponent(threadId)}`)
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
  const url = apiPath(`/conversations/${encodeURIComponent(threadId)}`)
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
