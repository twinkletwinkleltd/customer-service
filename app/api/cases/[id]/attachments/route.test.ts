// app/api/cases/[id]/attachments/route.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  setupTmpDataRoot,
  cleanupTmpDataRoot,
  makeNewCaseData,
  makeCtx,
  TINY_JPEG_BYTES,
} from '../../../_test-helpers'
import type { Attachment, CustomerCase } from '@/lib/types'

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

describe('POST /api/cases/[id]/attachments', () => {
  // I7: valid jpg under 5MB → 201 with attachment metadata
  it('I7 accepts a small jpg and returns 201 with attachment metadata', async () => {
    const c = await seedOne()
    const { POST } = await import('./route')

    const form = new FormData()
    form.append('file', new Blob([TINY_JPEG_BYTES], { type: 'image/jpeg' }), 'photo.jpg')

    const req = new Request(`http://test/api/cases/${c.id}/attachments`, {
      method: 'POST',
      body: form,
    })
    const res = await POST(req, makeCtx({ id: c.id }))
    expect(res.status).toBe(201)
    const body = (await res.json()) as Attachment
    expect(body.id).toBe('att-001')
    expect(body.mime).toBe('image/jpeg')
    expect(body.size).toBe(TINY_JPEG_BYTES.byteLength)
    expect(body.originalName).toBe('photo.jpg')
    expect(body.filename).toBe('att-001.jpg')
    expect(body.createdAt).toBeTruthy()
  })

  // I8a: over 5MB → 413
  it('I8 returns 413 when the upload exceeds 5 MB', async () => {
    const c = await seedOne()
    const { POST } = await import('./route')

    // 5 MB + 1 byte of zeros; valid image/jpeg mime so we hit the size guard
    const big = new Uint8Array(5 * 1024 * 1024 + 1)
    const form = new FormData()
    form.append('file', new Blob([big], { type: 'image/jpeg' }), 'big.jpg')

    const req = new Request(`http://test/api/cases/${c.id}/attachments`, {
      method: 'POST',
      body: form,
    })
    const res = await POST(req, makeCtx({ id: c.id }))
    expect(res.status).toBe(413)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('too large')
  })

  // I8b: non-image mime → 415
  it('I8 returns 415 when the mime type is not an allowed image', async () => {
    const c = await seedOne()
    const { POST } = await import('./route')

    const form = new FormData()
    form.append('file', new Blob([new Uint8Array([1, 2, 3])], { type: 'text/plain' }), 'note.txt')

    const req = new Request(`http://test/api/cases/${c.id}/attachments`, {
      method: 'POST',
      body: form,
    })
    const res = await POST(req, makeCtx({ id: c.id }))
    expect(res.status).toBe(415)
    const body = (await res.json()) as { error: string }
    expect(body.error).toContain('Unsupported mime type')
  })

  // I8c: unknown case id → 404
  it('I8 returns 404 when the parent case does not exist', async () => {
    const { POST } = await import('./route')
    const form = new FormData()
    form.append('file', new Blob([TINY_JPEG_BYTES], { type: 'image/jpeg' }), 'photo.jpg')

    const req = new Request('http://test/api/cases/case-999/attachments', {
      method: 'POST',
      body: form,
    })
    const res = await POST(req, makeCtx({ id: 'case-999' }))
    expect(res.status).toBe(404)
  })
})
