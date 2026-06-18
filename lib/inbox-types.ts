// lib/inbox-types.ts
//
// Types for the Inbox view (Step 1: UI scaffold with mock data).
//
// Phase 1 scope per operator decision 2026-06-16:
//   - single Gmail inbox source (twinkletwinkleltd@gmail.com)
//   - read-only display, no reply composer yet
//
// Phase 2a.1 (2026-06-17) added 3-way channel classification:
//   - customer    : real customer mail (default tab)
//   - promotional : marketing / newsletters / ESP-originated
//   - spam        : Gmail-flagged spam OR noreply-style automation
//                   (rescuable in Phase 2a.2)
//
// `source` is a separate field reserved for cross-channel expansion
// (Shopify / eBay / Amazon ingestion) per the Gmail Universal Inbox
// plan — Phase 2a.1 ignores it in rendering.

export type ThreadStatus = 'open' | 'resolved'

export type ThreadChannel = 'customer' | 'promotional' | 'spam'

/** Reasons strings emitted by services/inquiries/classifier.classify_3way.
 *  Format: ``"<channel>:<rule-name>"`` e.g.
 *  ``"promotional:list-unsubscribe-header"``. Display is mapped via
 *  lib/category-labels.ts. */
export type CategoryReason = string

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
  channel: ThreadChannel            // 3-way: customer | promotional | spam
  categoryReasons: CategoryReason[] // why was this classified this way
  messages: InboxMessage[]
}
