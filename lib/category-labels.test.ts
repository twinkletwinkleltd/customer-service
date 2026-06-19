// lib/category-labels.test.ts

import { describe, it, expect } from 'vitest'
import {
  CHANNEL_BADGE_CLASS,
  CHANNEL_LABEL,
  channelPillActiveClass,
  formatReason,
} from './category-labels'

describe('CHANNEL_LABEL', () => {
  it('covers all 3 visible channels', () => {
    expect(CHANNEL_LABEL.customer).toBe('Customer')
    expect(CHANNEL_LABEL.promotional).toBe('Promotional')
    expect(CHANNEL_LABEL.spam).toBe('Spam')
  })
})

describe('CHANNEL_BADGE_CLASS', () => {
  it('returns Tailwind class strings for each channel', () => {
    for (const c of ['customer', 'promotional', 'spam'] as const) {
      expect(CHANNEL_BADGE_CLASS[c]).toMatch(/bg-\w+/)
    }
  })

  it('uses distinct colours per channel for visual differentiation', () => {
    const cs = [
      CHANNEL_BADGE_CLASS.customer,
      CHANNEL_BADGE_CLASS.promotional,
      CHANNEL_BADGE_CLASS.spam,
    ]
    // No two channels share an identical class string.
    expect(new Set(cs).size).toBe(3)
  })
})

describe('channelPillActiveClass', () => {
  it('returns class for each variant including "all"', () => {
    expect(channelPillActiveClass('customer')).toMatch(/bg-\w+/)
    expect(channelPillActiveClass('promotional')).toMatch(/bg-\w+/)
    expect(channelPillActiveClass('spam')).toMatch(/bg-\w+/)
    expect(channelPillActiveClass('all')).toMatch(/bg-\w+/)
  })
})

describe('formatReason', () => {
  // ---- Exact-match keys ---------------------------------------------------

  it('formats list-unsubscribe-header with RFC context', () => {
    const out = formatReason('promotional:list-unsubscribe-header')
    expect(out).toContain('List-Unsubscribe')
    expect(out).toContain('RFC 2369')
  })

  it('formats rfc8058-one-click-unsubscribe with bulk-sender context', () => {
    const out = formatReason('promotional:rfc8058-one-click-unsubscribe')
    expect(out).toContain('One-Click')
    expect(out).toContain('bulk')
  })

  it('formats precedence-bulk', () => {
    const out = formatReason('promotional:precedence-bulk')
    expect(out).toContain('Precedence')
    expect(out).toContain('bulk')
  })

  it('formats gmail-label (spam) without ambiguity', () => {
    const out = formatReason('spam:gmail-label')
    expect(out).toContain('Gmail')
    expect(out.toLowerCase()).toContain('spam')
  })

  it('formats no-promotional-signal as the friendly customer message', () => {
    const out = formatReason('customer:no-promotional-signal')
    expect(out).toContain('No marketing')
  })

  // ---- Prefix-driven (esp-domain-* / link-density-* / cta-keywords-*) -----

  it('formats esp-domain-<vendor> as friendly sentence', () => {
    const out = formatReason('promotional:esp-domain-mailchimp')
    expect(out).toContain('Mailchimp')
    expect(out).toContain('ESP')
  })

  it('formats esp-domain with multi-word vendor names', () => {
    const out = formatReason('promotional:esp-domain-constant-contact')
    expect(out).toContain('Constant Contact')
  })

  it('formats link-density-<n>', () => {
    const out = formatReason('promotional:link-density-7')
    expect(out).toContain('7')
    expect(out.toLowerCase()).toContain('links')
  })

  it('formats cta-keywords-<list>', () => {
    const out = formatReason('promotional:cta-keywords-shop now,sale ends,limited time')
    expect(out).toContain('shop now')
    expect(out).toContain('sale ends')
  })

  // ---- Backfill prefix ----------------------------------------------------

  it('formats backfill:degraded-headers-unavailable', () => {
    const out = formatReason('backfill:degraded-headers-unavailable')
    expect(out).toContain('Re-classified')
  })

  it('formats backfill:noise-promoted-to-spam', () => {
    const out = formatReason('backfill:noise-promoted-to-spam')
    expect(out).toContain('noise')
  })

  // ---- Fallback / edge cases ----------------------------------------------

  it('title-cases unknown rules as last resort', () => {
    const out = formatReason('promotional:totally-new-rule-name')
    expect(out).toBe('Totally New Rule Name')
  })

  it('handles a missing colon', () => {
    const out = formatReason('orphan-rule-without-colon')
    expect(out).toBe('Orphan Rule Without Colon')
  })

  it('returns empty string for null / undefined input', () => {
    // @ts-expect-error — testing runtime resilience to bad input.
    expect(formatReason(null)).toBe('')
    // @ts-expect-error - testing runtime resilience to bad input.
    expect(formatReason(undefined)).toBe('')
    expect(formatReason('')).toBe('')
  })
})
