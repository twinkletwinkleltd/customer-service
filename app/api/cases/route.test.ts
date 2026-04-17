// app/api/cases/route.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { setupTmpDataRoot, cleanupTmpDataRoot, makeNewCaseData } from '../_test-helpers'
import type { CustomerCase } from '@/lib/types'

let tmpRoot: string

beforeEach(async () => {
  tmpRoot = await setupTmpDataRoot()
})

afterEach(async () => {
  await cleanupTmpDataRoot(tmpRoot)
})

describe('POST /api/cases', () => {
  // I1: POST — happy path: valid NewCaseData → 201 with id assigned
  it('I1 creates a case on valid body and returns 201 with id', async () => {
    const { POST } = await import('./route')
    const req = new Request('http://test/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(makeNewCaseData()),
    })
    const res = await POST(req)
    expect(res.status).toBe(201)
    const body = (await res.json()) as CustomerCase
    expect(body.id).toBe('case-001')
    expect(body.customer.name).toBe('Alice')
    expect(body.account).toBe('gorble')
    expect(body.creator).toBe('star001')
    expect(body.createdAt).toBeTruthy()
    expect(body.updatedAt).toBeTruthy()
    expect(body.attachments).toEqual([])
  })

  // I2: POST — missing required fields (no customer.name) → 400 with field list
  it('I2 returns 400 with list of missing fields when customer.name is absent', async () => {
    const { POST } = await import('./route')
    const payload = makeNewCaseData({
      customer: { name: '', address1: '', postcode: '', email: '', salesRecordNo: 'SR-7' },
    })
    const req = new Request('http://test/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('Missing required fields')
    expect(body.error).toContain('customer.name')
  })

  // I2b: invalid account value → 400 with "invalid account" error
  it('I2b returns 400 when account is not a valid enum value', async () => {
    const { POST } = await import('./route')
    const payload = { ...makeNewCaseData(), account: 'notreal' }
    const req = new Request('http://test/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const res = await POST(req)
    expect(res.status).toBe(400)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('invalid account')
  })
})

describe('GET /api/cases', () => {
  // I3: GET — returns all cases; with ?account=gorble filter returns only that account
  it('I3 returns all cases; ?account= filter returns only matching account', async () => {
    const { POST, GET } = await import('./route')

    // Seed three cases on different accounts
    for (const payload of [
      makeNewCaseData({ account: 'gorble', customer: { name: 'A', address1: '', postcode: '', email: '', salesRecordNo: 'SR-1' } }),
      makeNewCaseData({ account: 'ssys', customer: { name: 'B', address1: '', postcode: '', email: '', salesRecordNo: 'SR-2' } }),
      makeNewCaseData({ account: 'gorble', customer: { name: 'C', address1: '', postcode: '', email: '', salesRecordNo: 'SR-3' } }),
    ]) {
      const req = new Request('http://test/api/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const res = await POST(req)
      expect(res.status).toBe(201)
    }

    // Unfiltered GET returns all three
    const allReq = new Request('http://test/api/cases')
    // GET uses NextRequest typing; a plain Request works at runtime because
    // the handler only reads `.url`.
    const allRes = await GET(allReq as unknown as Parameters<typeof GET>[0])
    expect(allRes.status).toBe(200)
    const all = (await allRes.json()) as CustomerCase[]
    expect(all).toHaveLength(3)

    // ?account=gorble filter → 2 cases
    const filteredReq = new Request('http://test/api/cases?account=gorble')
    const filteredRes = await GET(filteredReq as unknown as Parameters<typeof GET>[0])
    expect(filteredRes.status).toBe(200)
    const gorbleOnly = (await filteredRes.json()) as CustomerCase[]
    expect(gorbleOnly).toHaveLength(2)
    expect(gorbleOnly.every((c) => c.account === 'gorble')).toBe(true)
  })
})
