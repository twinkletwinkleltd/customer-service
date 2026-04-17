// app/api/search/route.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  setupTmpDataRoot,
  cleanupTmpDataRoot,
  makeNewCaseData,
} from '../_test-helpers'
import type { SearchResult } from '@/lib/types'

let tmpRoot: string

beforeEach(async () => {
  tmpRoot = await setupTmpDataRoot()
})

afterEach(async () => {
  await cleanupTmpDataRoot(tmpRoot)
})

describe('POST /api/search', () => {
  // I10: returns top 5 cases sorted by score, includes both case and reply hits
  it('I10 returns up to 5 results sorted by score; includes case + reply hits', async () => {
    const { createCase } = await import('@/lib/cases')
    // Seed a case whose issue mentions "damaged" so it scores against both
    // the seeded "damaged package" reply (reply-002) and its own issue body.
    await createCase(
      makeNewCaseData({
        issue: 'Package arrived damaged in transit',
        keywords: ['damaged', 'broken'],
        conversation: [
          { role: 'customer', text: 'My package was damaged when it arrived', ts: '2026-02-01T00:00:00.000Z' },
        ],
        customer: {
          name: 'Carol',
          address1: '',
          postcode: '',
          email: '',
          salesRecordNo: 'SR-CAROL',
        },
      }),
    )

    const { POST } = await import('./route')
    const req = new Request('http://test/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: 'damaged package' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const results = (await res.json()) as SearchResult[]

    // Cap of 5
    expect(results.length).toBeGreaterThan(0)
    expect(results.length).toBeLessThanOrEqual(5)

    // Scores are descending
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score)
    }

    // Includes both types
    const types = new Set(results.map((r) => r.type))
    expect(types.has('case')).toBe(true)
    expect(types.has('reply')).toBe(true)

    // The case result carries a case, the reply result carries a reply
    const caseHit = results.find((r) => r.type === 'case')
    expect(caseHit?.case).toBeDefined()
    expect(caseHit?.case?.issue).toContain('damaged')
    const replyHit = results.find((r) => r.type === 'reply')
    expect(replyHit?.reply).toBeDefined()
  })

  // I10b: empty query → empty array (no 500)
  it('I10 returns [] for an empty query without invoking search', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://test/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '   ' }),
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as SearchResult[]
    expect(body).toEqual([])
  })
})
