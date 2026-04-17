// app/api/cases/[id]/route.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  setupTmpDataRoot,
  cleanupTmpDataRoot,
  makeNewCaseData,
  makeCtx,
} from '../../_test-helpers'
import type { CustomerCase } from '@/lib/types'

let tmpRoot: string

beforeEach(async () => {
  tmpRoot = await setupTmpDataRoot()
})

afterEach(async () => {
  await cleanupTmpDataRoot(tmpRoot)
})

async function seedOne(): Promise<CustomerCase> {
  const { createCase } = await import('@/lib/cases')
  return createCase(makeNewCaseData())
}

describe('GET /api/cases/[id]', () => {
  // I4a: existing id → 200 with case
  it('I4 returns 200 with the case when it exists', async () => {
    const c = await seedOne()
    const { GET } = await import('./route')
    const req = new Request(`http://test/api/cases/${c.id}`)
    const res = await GET(req, makeCtx({ id: c.id }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as CustomerCase
    expect(body.id).toBe(c.id)
    expect(body.customer.name).toBe('Alice')
  })

  // I4b: missing id → 404
  it('I4 returns 404 when case does not exist', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://test/api/cases/case-999')
    const res = await GET(req, makeCtx({ id: 'case-999' }))
    expect(res.status).toBe(404)
    const body = (await res.json()) as { error: string }
    expect(body.error).toBe('Not found')
  })
})

describe('PATCH /api/cases/[id]', () => {
  // I5a: applies patch and updates updatedAt
  it('I5 applies patch and bumps updatedAt', async () => {
    const c = await seedOne()
    // Small delay so updatedAt definitely differs
    await new Promise((r) => setTimeout(r, 5))

    const { PATCH } = await import('./route')
    const req = new Request(`http://test/api/cases/${c.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved', resolution: 'Refunded in full' }),
    })
    const res = await PATCH(req, makeCtx({ id: c.id }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as CustomerCase
    expect(body.status).toBe('resolved')
    expect(body.resolution).toBe('Refunded in full')
    expect(body.updatedAt >= c.updatedAt).toBe(true)
    expect(body.updatedAt !== c.updatedAt).toBe(true)
  })

  // I5b: missing case → 404
  it('I5 returns 404 when patching a missing case', async () => {
    const { PATCH } = await import('./route')
    const req = new Request('http://test/api/cases/case-999', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    })
    const res = await PATCH(req, makeCtx({ id: 'case-999' }))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/cases/[id]', () => {
  // I6a: removes case and returns 204
  it('I6 returns 204 and removes the case', async () => {
    const c = await seedOne()
    const { DELETE } = await import('./route')
    const { getCaseById } = await import('@/lib/cases')

    const req = new Request(`http://test/api/cases/${c.id}`, { method: 'DELETE' })
    const res = await DELETE(req, makeCtx({ id: c.id }))
    expect(res.status).toBe(204)
    // 204 must have no body
    const text = await res.text()
    expect(text).toBe('')
    // And the case is gone
    expect(await getCaseById(c.id)).toBeNull()
  })

  // I6b: missing id → 404
  it('I6 returns 404 when deleting a missing case', async () => {
    const { DELETE } = await import('./route')
    const req = new Request('http://test/api/cases/case-999', { method: 'DELETE' })
    const res = await DELETE(req, makeCtx({ id: 'case-999' }))
    expect(res.status).toBe(404)
  })
})
