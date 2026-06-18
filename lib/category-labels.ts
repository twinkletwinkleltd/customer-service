// lib/category-labels.ts
//
// Display strings for the 3-way channel classification (Phase 2a.1)
// and the per-rule "reasons" that the backend classifier emits.
//
// The reasons strings come from services/inquiries/classifier.py
// as ``"<channel>:<rule-name>"`` tokens (e.g.
// ``"promotional:list-unsubscribe-header"``). The UI translates them
// here so the operator sees a friendly sentence on hover rather than
// a snake-case token.

import type { CategoryReason, ThreadChannel } from './inbox-types'

// Display label + colour token for each channel — used by the filter
// pills and the badge on each thread row.
export const CHANNEL_LABEL: Record<ThreadChannel, string> = {
  customer:    'Customer',
  promotional: 'Promotional',
  spam:        'Spam',
}

// Tailwind utility classes for the channel badge.
export const CHANNEL_BADGE_CLASS: Record<ThreadChannel, string> = {
  customer:    'bg-blue-50 text-blue-700 border-blue-200',
  promotional: 'bg-amber-50 text-amber-700 border-amber-200',
  spam:        'bg-rose-50 text-rose-700 border-rose-200',
}

// Tailwind classes for the *filter pill* (different colour treatment —
// the active pill should pop, inactive ones are neutral).
export function channelPillActiveClass(channel: ThreadChannel | 'all'): string {
  switch (channel) {
    case 'customer':    return 'bg-blue-50 text-blue-700'
    case 'promotional': return 'bg-amber-50 text-amber-700'
    case 'spam':        return 'bg-rose-50 text-rose-700'
    case 'all':         return 'bg-slate-100 text-slate-700'
  }
}

// ---------------------------------------------------------------------------
// Reason translation
// ---------------------------------------------------------------------------

// Hand-curated mapping for the rule names emitted by classify_3way. Any
// reason not in this map is rendered by ``formatReason()`` as a
// best-effort title-cased version of the rule name (so a new rule
// added by the backend without a UI change is not completely opaque).
const REASON_LABEL: Record<string, string> = {
  // Promotional signals
  'list-unsubscribe-header':
    'List-Unsubscribe header (RFC 2369 — marketing list marker)',
  'list-id-header':
    'List-Id header (RFC 2919 — mailing list identifier)',
  'rfc8058-one-click-unsubscribe':
    'List-Unsubscribe-Post: One-Click (mandated for bulk senders)',
  'precedence-bulk':
    'Precedence: bulk header (RFC 2076)',
  'precedence-list':
    'Precedence: list header (RFC 2076)',
  'precedence-junk':
    'Precedence: junk header (RFC 2076)',
  'feedback-id-header':
    'Feedback-ID header (Google bulk-sender marker)',
  'gmail-promotions-category':
    'Gmail tagged as Promotions',

  // Spam signals
  'gmail-label':
    'Gmail tagged as Spam',
  'noreply-style-sender':
    'Automated noreply-style sender',

  // Noise signals (operator never sees these — listed for completeness)
  'dsn-or-bounce-sender':
    'Bounce / delivery failure notification',

  // Customer signals
  'no-promotional-signal':
    'No marketing markers detected',
  'gmail-personal-category':
    'Gmail tagged as Personal',

  // Backfill markers (only present on legacy rows that were
  // re-classified post-hoc).
  'degraded-headers-unavailable':
    'Re-classified from sender + body only (headers not captured)',
  'no-inbound-message':
    'Thread with no inbound message — defaulted to customer',
  'noise-promoted-to-spam':
    'Was noise under old binary classifier — kept as spam for review',
}

/** Convert one ``"channel:rule-name"`` token into an operator-friendly
 *  sentence. Returns the token unchanged if formatting fails. */
export function formatReason(reason: CategoryReason): string {
  if (!reason || typeof reason !== 'string') return ''
  const colonIdx = reason.indexOf(':')
  const tail = colonIdx >= 0 ? reason.slice(colonIdx + 1) : reason

  // 1. Exact match
  if (REASON_LABEL[tail]) return REASON_LABEL[tail]

  // 2. Prefix match for ``esp-domain-<vendor>`` style.
  if (tail.startsWith('esp-domain-')) {
    const vendor = tail.slice('esp-domain-'.length).replace(/-/g, ' ')
    return `Sent via ${titleCase(vendor)} (ESP / marketing platform)`
  }
  // 3. Prefix for ``link-density-<n>``
  if (tail.startsWith('link-density-')) {
    const n = tail.slice('link-density-'.length)
    return `Body has ${n} links (high link density)`
  }
  // 4. Prefix for ``cta-keywords-<list>``
  if (tail.startsWith('cta-keywords-')) {
    const keywords = tail.slice('cta-keywords-'.length).split(',').slice(0, 3)
    return `Marketing CTA keywords: ${keywords.join(', ')}`
  }
  // 5. Backfill prefix (rare)
  if (reason.startsWith('backfill:')) {
    const inner = reason.slice('backfill:'.length)
    if (REASON_LABEL[inner]) return REASON_LABEL[inner]
    return `Backfill: ${titleCase(inner.replace(/-/g, ' '))}`
  }

  // 6. Last resort — title-case the rule name.
  return titleCase(tail.replace(/-/g, ' '))
}

function titleCase(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase())
}
