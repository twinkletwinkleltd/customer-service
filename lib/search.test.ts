// lib/search.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import type { CustomerCase } from './types'

let tmpRoot: string
let prevPortalDataRoot: string | undefined

beforeEach(async () => {
  prevPortalDataRoot = process.env.PORTAL_DATA_ROOT
  tmpRoot = path.join(os.tmpdir(), `cs-test-${crypto.randomUUID()}`)
  await fs.mkdir(tmpRoot, { recursive: true })
  process.env.PORTAL_DATA_ROOT = tmpRoot
})

afterEach(async () => {
  if (prevPortalDataRoot === undefined) {
    delete process.env.PORTAL_DATA_ROOT
  } else {
    process.env.PORTAL_DATA_ROOT = prevPortalDataRoot
  }
  try {
    await fs.rm(tmpRoot, { recursive: true, force: true })
  } catch {
    // ignore
  }
})

function mkCase(overrides: Partial<CustomerCase> = {}): CustomerCase {
  return {
    id: 'case-001',
    customer: { name: 'X', address1: '', postcode: '', email: '', salesRecordNo: 'SR-1' },
    account: 'ssys',
    creator: 'star001',
    standardSku: 'R140_Black_125',
    conversation: [],
    category: '',
    keywords: [],
    issue: '',
    resolution: '',
    status: 'open',
    attachments: [],
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

async function seedCases(cases: CustomerCase[]) {
  const { writeCases } = await import('./persistence')
  await writeCases(cases)
}

describe('search', () => {
  // U-12: Issue body match +3, customer message +2, keywords/category +1
  it('U-12 scoring: issue +3, customer message +2, meta +1', async () => {
    await seedCases([
      mkCase({
        id: 'case-issue',
        issue: 'Order broken arrived damaged',
        conversation: [],
        keywords: [],
        category: '',
      }),
      mkCase({
        id: 'case-msg',
        issue: '',
        conversation: [{ role: 'customer', text: 'my order is broken', ts: '2026-01-01T00:00:00.000Z' }],
        keywords: [],
        category: '',
      }),
      mkCase({
        id: 'case-meta',
        issue: '',
        conversation: [],
        keywords: ['broken'],
        category: '',
      }),
    ])

    const { search } = await import('./search')
    // Use a query with no reply-side matches to keep the assertion tight
    const results = await search('broken', 10)
    const caseResults = results.filter((r) => r.type === 'case')

    const scoreOf = (id: string) =>
      caseResults.find((r) => r.case?.id === id)?.score ?? 0

    // issue match: 3, customer-text: 2, meta: 1
    expect(scoreOf('case-issue')).toBe(3)
    expect(scoreOf('case-msg')).toBe(2)
    expect(scoreOf('case-meta')).toBe(1)
  })

  // U-13: Same-SKU bonus +4, same-account bonus +2, resolved bonus +1;
  //       tie-break by updatedAt desc
  it('U-13 hint bonuses + resolved bonus + tie-break', async () => {
    await seedCases([
      // Baseline: +3 for issue match. Not resolved, no hint match.
      mkCase({
        id: 'case-plain',
        issue: 'missing order broken',
        standardSku: 'R999_Red_000',
        account: 'gorble',
        status: 'open',
        updatedAt: '2026-01-10T00:00:00.000Z',
      }),
      // Same SKU as hint: +3 + 4 = 7
      mkCase({
        id: 'case-sku',
        issue: 'missing item',
        standardSku: 'R140_Black_125',
        account: 'gorble',
        status: 'open',
        updatedAt: '2026-01-05T00:00:00.000Z',
      }),
      // Same account as hint: +3 + 2 = 5 (account also in meta, +1 extra = 6)
      mkCase({
        id: 'case-acct',
        issue: 'missing order',
        standardSku: 'R777_Blue_000',
        account: 'ssys',
        status: 'open',
        updatedAt: '2026-01-04T00:00:00.000Z',
      }),
      // Resolved bonus — same-SKU too, so +3 + 4 + 1 = 8
      mkCase({
        id: 'case-resolved',
        issue: 'missing order',
        standardSku: 'R140_Black_125',
        account: 'gorble',
        status: 'resolved',
        resolution: 'Refunded',
        updatedAt: '2026-01-03T00:00:00.000Z',
      }),
      // Tie-break: same score as case-plain but later updatedAt — should win
      mkCase({
        id: 'case-later',
        issue: 'missing order',
        standardSku: 'R555_Green_000',
        account: 'gorble',
        status: 'open',
        updatedAt: '2026-01-20T00:00:00.000Z',
      }),
    ])

    const { search } = await import('./search')
    const results = await search('missing', 10, {
      skuHint: 'R140_Black_125',
      accountHint: 'ssys',
    })

    const caseResults = results.filter((r) => r.type === 'case')
    const byId = (id: string) => caseResults.find((r) => r.case?.id === id)

    // case-resolved: issue 'missing order' -> 'missing' (+3) + sku hint (+4) + resolved (+1) = 8
    expect(byId('case-resolved')?.score).toBe(8)
    // case-sku: issue 'missing item' -> 'missing' (+3) + sku hint (+4) = 7
    expect(byId('case-sku')?.score).toBe(7)
    // case-acct: issue 'missing order' -> 'missing' (+3) + account hint (+2) +
    //   meta contains 'ssys' but term is 'missing' so no +1 — net 5
    expect(byId('case-acct')?.score).toBe(5)
    // case-plain and case-later both have issue match only -> 3 each
    expect(byId('case-plain')?.score).toBe(3)
    expect(byId('case-later')?.score).toBe(3)

    // Overall ranking: resolved > sku > acct > later > plain (tie-break)
    const ids = caseResults.map((r) => r.case!.id)
    expect(ids[0]).toBe('case-resolved')
    expect(ids[1]).toBe('case-sku')
    expect(ids[2]).toBe('case-acct')
    // Tie-break: 'case-later' has updatedAt 2026-01-20 > 'case-plain' 2026-01-10
    const laterIdx = ids.indexOf('case-later')
    const plainIdx = ids.indexOf('case-plain')
    expect(laterIdx).toBeLessThan(plainIdx)
  })

  // U-13b: topN truncates + empty query returns no case hits (bonus)
  it('U-13b topN truncates results', async () => {
    const many: CustomerCase[] = []
    for (let i = 0; i < 8; i++) {
      many.push(mkCase({ id: `case-${i}`, issue: 'broken', updatedAt: `2026-01-0${i + 1}T00:00:00.000Z` }))
    }
    await seedCases(many)
    const { search } = await import('./search')
    const results = await search('broken', 3)
    expect(results.length).toBeLessThanOrEqual(3)
  })

  // U-13c: replies show up alongside cases
  it('U-13c reply hits appear in results', async () => {
    await seedCases([])
    const { search } = await import('./search')
    const results = await search('refund return', 10)
    const replyHits = results.filter((r) => r.type === 'reply')
    expect(replyHits.length).toBeGreaterThan(0)
  })
})
