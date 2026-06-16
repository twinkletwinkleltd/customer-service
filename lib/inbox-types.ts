// lib/inbox-types.ts
//
// Types for the Inbox view (Step 1: UI scaffold with mock data).
//
// Phase 1 scope per operator decision 2026-06-16:
//   - single Gmail inbox source (twinkletwinkleltd@gmail.com)
//   - read-only display, no reply composer yet
//   - no multi-channel classifier (no Amazon/eBay/Shopify split for now)
//
// `source` is kept on the type so the multi-channel UI plan (see
// docs Gmail Universal Inbox plan §3.2) can light it up later without a
// schema change — Phase 1 ignores it in rendering.

export type ThreadStatus = 'open' | 'resolved'

export type MessageDirection = 'in' | 'out'

export interface InboxMessage {
  id: string
  direction: MessageDirection      // 'in' = customer, 'out' = us
  text: string
  sentAt: string                    // ISO 8601
  senderLabel: string               // display name; for 'out' usually operator id
  hasAttachment?: boolean
}

export interface InboxThread {
  id: string
  customerName: string
  customerEmail: string
  subject: string
  status: ThreadStatus
  unread: boolean
  lastInboundAt: string             // ISO 8601 — used for list sort
  lastInboundPreview: string        // first ~80 chars for list view
  orderId?: string                  // optional linked order id
  tags: string[]
  source?: string                   // 'gmail' (default); reserved for future
  messages: InboxMessage[]
}
