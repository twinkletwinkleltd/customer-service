import { describe, it, expect } from 'vitest'
import { MOCK_FEED_FALLBACK, MOCK_THREAD_FALLBACK } from './inbox-fallback'

describe('inbox fallback payloads', () => {
  it('returns a Flask-shaped feed sorted newest first', () => {
    expect(MOCK_FEED_FALLBACK.ok).toBe(true)
    expect(MOCK_FEED_FALLBACK.total).toBe(MOCK_FEED_FALLBACK.items.length)
    expect(MOCK_FEED_FALLBACK.unread_total).toBeGreaterThan(0)
    expect(MOCK_FEED_FALLBACK._meta.data_source).toBe('mock-fallback')

    const [first, second] = MOCK_FEED_FALLBACK.items
    expect(first.last_inbound_at! >= second.last_inbound_at!).toBe(true)
    expect(first.thread_id).toBeTruthy()
    expect(first.category_reasons.length).toBeGreaterThan(0)
    expect(MOCK_FEED_FALLBACK.items.some((x) => x.channel === 'spam')).toBe(true)
    expect(MOCK_FEED_FALLBACK.items.some((x) => x.channel === 'customer')).toBe(true)
  })

  it('returns thread detail for known ids and null for missing ids', () => {
    const detail = MOCK_THREAD_FALLBACK(MOCK_FEED_FALLBACK.items[0].thread_id)
    expect(detail?.ok).toBe(true)
    expect(detail?.thread.thread_id).toBe(MOCK_FEED_FALLBACK.items[0].thread_id)
    expect(detail?.thread.messages[0].source_record_id).toMatch(/^<mock-/)
    expect(detail?.thread.messages[0].preview.length).toBeGreaterThan(0)

    expect(MOCK_THREAD_FALLBACK('missing-thread')).toBeNull()
  })
})
