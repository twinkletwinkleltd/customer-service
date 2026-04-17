// app/api/cases/[id]/attachments/[attId]/route.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  setupTmpDataRoot,
  cleanupTmpDataRoot,
  makeNewCaseData,
  makeCtx,
  TINY_JPEG_BYTES,
} from '../../../../_test-helpers'
import type { Attachment, CustomerCase } from '@/lib/types'

let tmpRoot: string

beforeEach(async () => {
  tmpRoot = await setupTmpDataRoot()
})

afterEach(async () => {
  await cleanupTmpDataRoot(tmpRoot)
})

async function seedCaseWithAttachment(): Promise<{ c: CustomerCase; att: Attachment }> {
  const { createCase, addAttachment } = await import('@/lib/cases')
  const c = await createCase(makeNewCaseData())
  const att = await addAttachment(c.id, {
    originalName: 'photo.jpg',
    mime: 'image/jpeg',
    bytes: TINY_JPEG_BYTES,
  })
  if (!att) throw new Error('seed failed — addAttachment returned null')
  return { c, att }
}

describe('GET /api/cases/[id]/attachments/[attId]', () => {
  // I9a: returns file body with correct Content-Type + Content-Length
  it('I9 returns the file body with correct Content-Type and length', async () => {
    const { c, att } = await seedCaseWithAttachment()
    const { GET } = await import('./route')

    const req = new Request(`http://test/api/cases/${c.id}/attachments/${att.id}`)
    const res = await GET(req, makeCtx({ id: c.id, attId: att.id }))
    expect(res.status).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/jpeg')
    expect(res.headers.get('Content-Length')).toBe(String(TINY_JPEG_BYTES.byteLength))

    const buf = new Uint8Array(await res.arrayBuffer())
    expect(buf.byteLength).toBe(TINY_JPEG_BYTES.byteLength)
    // Byte-equal to the bytes we stored
    expect(Array.from(buf)).toEqual(Array.from(TINY_JPEG_BYTES))
  })

  // I9b: unknown attachment → 404
  it('I9 returns 404 when attachment does not exist', async () => {
    const { c } = await seedCaseWithAttachment()
    const { GET } = await import('./route')
    const req = new Request(`http://test/api/cases/${c.id}/attachments/att-999`)
    const res = await GET(req, makeCtx({ id: c.id, attId: 'att-999' }))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/cases/[id]/attachments/[attId]', () => {
  // I9c: removes file + metadata, returns 204
  it('I9 DELETE removes the file and metadata and returns 204', async () => {
    const { c, att } = await seedCaseWithAttachment()
    const { DELETE } = await import('./route')
    const { getAttachment } = await import('@/lib/cases')

    const req = new Request(`http://test/api/cases/${c.id}/attachments/${att.id}`, {
      method: 'DELETE',
    })
    const res = await DELETE(req, makeCtx({ id: c.id, attId: att.id }))
    expect(res.status).toBe(204)

    // Metadata gone
    expect(await getAttachment(c.id, att.id)).toBeNull()
  })

  // I9d: unknown attachment → 404
  it('I9 DELETE returns 404 for unknown attachment', async () => {
    const { c } = await seedCaseWithAttachment()
    const { DELETE } = await import('./route')
    const req = new Request(`http://test/api/cases/${c.id}/attachments/att-999`, {
      method: 'DELETE',
    })
    const res = await DELETE(req, makeCtx({ id: c.id, attId: 'att-999' }))
    expect(res.status).toBe(404)
  })
})
