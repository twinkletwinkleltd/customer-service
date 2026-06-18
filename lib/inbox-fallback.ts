// lib/inbox-fallback.ts
//
// Dev-only mock used by the Next.js route handlers in
// app/api/conversations/* when PORTAL_FLASK_URL is unset. The payload
// matches the **Flask backend shape** (snake_case fields, `ok:true`
// envelope) so the client mapper in lib/inbox-api.ts treats it
// identically to a real response. This keeps the front-end work
// flow unblocked when no portal-web Flask is running locally.
//
// Reuses the 5 sample threads from lib/mock-inbox.ts but reshapes them
// to the snake_case API shape — that file stays untouched as a
// canonical "what the UI types look like" reference.

import { MOCK_THREADS } from './mock-inbox'
import type { InboxMessage, InboxThread } from './inbox-types'

interface FlaskMessage {
  id: string
  source_record_id: string
  channel: string
  message_text: string
  created_at: string
  sender_name: string
  sender_email: string
  direction: 'in' | 'out'
  subject: string
  preview: string
}

interface FlaskThreadDetail {
  thread_id: string
  channel: string
  category_reasons: string[]
  subject: string
  status: string
  starred: boolean
  tags: string[]
  source: string
  last_inbound_at: string | null
  last_outbound_at: string | null
  customer_name: string | null
  customer_email: string | null
  order_id: string | null
  messages: FlaskMessage[]
}

interface FlaskFeedItem {
  thread_id: string
  channel: string
  category_reasons: string[]
  subject: string
  status: string
  starred: boolean
  unread: boolean
  tags: string[]
  source: string
  last_inbound_at: string | null
  last_inbound_preview: string | null
  customer_name: string | null
  customer_email: string | null
  order_id: string | null
}

// 2026-06-17 Phase 2a.1 — distribute mock threads across the 3 visible
// channels so the dev workflow exercises the filter pills. We don't
// want to edit mock-inbox.ts (it's the Step 1 visual reference) so we
// derive a deterministic channel here from the thread id's char-code
// sum: mod 5 gives ~60% customer / 20% promotional / 20% spam, which
// is roughly the realistic distribution operators see.
function mockChannelFor(t: InboxThread): { channel: string; reasons: string[] } {
  let h = 0
  for (let i = 0; i < t.id.length; i++) h += t.id.charCodeAt(i)
  const slot = h % 5
  if (slot === 0) {
    return {
      channel: 'spam',
      reasons: ['spam:noreply-style-sender'],
    }
  }
  if (slot === 1) {
    return {
      channel: 'promotional',
      reasons: ['promotional:list-unsubscribe-header',
                'promotional:esp-domain-mailchimp'],
    }
  }
  return {
    channel: 'customer',
    reasons: ['customer:no-promotional-signal'],
  }
}

function feedItem(t: InboxThread): FlaskFeedItem {
  const { channel, reasons } = mockChannelFor(t)
  return {
    thread_id:           t.id,
    channel,
    category_reasons:    reasons,
    subject:             t.subject,
    status:              t.status,
    starred:             false,
    unread:              t.unread,
    tags:                t.tags,
    source:              t.source ?? 'gmail',
    last_inbound_at:     t.lastInboundAt,
    last_inbound_preview: t.lastInboundPreview,
    customer_name:       t.customerName,
    customer_email:      t.customerEmail,
    order_id:            t.orderId ?? null,
  }
}

function detailMessage(m: InboxMessage): FlaskMessage {
  return {
    id:               m.id,
    source_record_id: `<mock-${m.id}@example.com>`,
    channel:          'gmail',
    message_text:     m.text,
    created_at:       m.sentAt,
    sender_name:      m.senderLabel,
    sender_email:     '',
    direction:        m.direction,
    subject:          '',
    preview:          m.text.slice(0, 120),
  }
}

function detailThread(t: InboxThread): FlaskThreadDetail {
  const { channel, reasons } = mockChannelFor(t)
  return {
    thread_id:        t.id,
    channel,
    category_reasons: reasons,
    subject:          t.subject,
    status:           t.status,
    starred:          false,
    tags:             t.tags,
    source:           t.source ?? 'gmail',
    last_inbound_at:  t.lastInboundAt,
    last_outbound_at: null,
    customer_name:    t.customerName,
    customer_email:   t.customerEmail,
    order_id:         t.orderId ?? null,
    messages:         t.messages.map(detailMessage),
  }
}

export const MOCK_FEED_FALLBACK = {
  ok: true,
  items: [...MOCK_THREADS]
    .sort((a, b) => b.lastInboundAt.localeCompare(a.lastInboundAt))
    .map(feedItem),
  total: MOCK_THREADS.length,
  unread_total: MOCK_THREADS.filter((t) => t.unread).length,
  next_cursor: null,
  _meta: { data_source: 'mock-fallback', step: '2b' },
}

export function MOCK_THREAD_FALLBACK(threadId: string):
  { ok: true, thread: FlaskThreadDetail, _meta: { data_source: string } } | null {
  const t = MOCK_THREADS.find((x) => x.id === threadId)
  if (!t) return null
  return {
    ok: true,
    thread: detailThread(t),
    _meta: { data_source: 'mock-fallback' },
  }
}
