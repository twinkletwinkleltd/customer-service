// lib/cases.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import fsSync from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'
import type { NewCaseData } from './cases'

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

function sampleCase(salesRecordNo = 'SR-1', name = 'Alice'): NewCaseData {
  return {
    customer: {
      name,
      address1: '1 High Street',
      postcode: 'SW1A 1AA',
      email: 'alice@example.com',
      salesRecordNo,
    },
    account: 'ssys',
    creator: 'star001',
    standardSku: 'R140_Black_125',
    conversation: [{ role: 'customer', text: 'Where is my order?', ts: '2026-01-01T00:00:00.000Z' }],
    category: 'Order',
    keywords: ['missing'],
    issue: 'Order not arrived',
    resolution: '',
    status: 'open',
  }
}

describe('cases', () => {
  // U-7: createCase assigns sequential ID (case-001, case-002, ...)
  it('U-7 createCase assigns sequential IDs', async () => {
    const { createCase } = await import('./cases')
    const a = await createCase(sampleCase('SR-A', 'Alice'))
    const b = await createCase(sampleCase('SR-B', 'Bob'))
    const c = await createCase(sampleCase('SR-C', 'Carol'))
    expect(a.id).toBe('case-001')
    expect(b.id).toBe('case-002')
    expect(c.id).toBe('case-003')
    expect(a.createdAt).toBeTruthy()
    expect(a.updatedAt).toBeTruthy()
    expect(a.attachments).toEqual([])
  })

  // U-8: patchCase returns null for missing id, updates for existing
  it('U-8 patchCase returns null for missing id, updates existing', async () => {
    const { createCase, patchCase, getCaseById } = await import('./cases')

    const missing = await patchCase('case-999', { status: 'resolved' })
    expect(missing).toBeNull()

    const created = await createCase(sampleCase())
    const updated = await patchCase(created.id, { status: 'resolved', resolution: 'Refunded' })
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe('resolved')
    expect(updated!.resolution).toBe('Refunded')
    expect(updated!.updatedAt >= created.updatedAt).toBe(true)

    const fetched = await getCaseById(created.id)
    expect(fetched?.status).toBe('resolved')
  })

  // U-9: deleteCase returns false for missing id, true for existing,
  //      also wipes case-images dir
  it('U-9 deleteCase removes case and its images dir', async () => {
    const { createCase, deleteCase, addAttachment } = await import('./cases')
    const { getCaseImagesDir } = await import('./persistence')

    expect(await deleteCase('case-missing')).toBe(false)

    const created = await createCase(sampleCase())
    // Attach something so we have an on-disk dir to wipe
    await addAttachment(created.id, {
      originalName: 'photo.png',
      mime: 'image/png',
      bytes: new Uint8Array([1, 2, 3]),
    })

    const imagesDir = path.join(getCaseImagesDir(), created.id)
    expect(fsSync.existsSync(imagesDir)).toBe(true)

    const ok = await deleteCase(created.id)
    expect(ok).toBe(true)
    expect(fsSync.existsSync(imagesDir)).toBe(false)
  })

  // U-10: addAttachment increments att-NNN ID per case (independent counter per case)
  it('U-10 addAttachment assigns sequential att-NNN per case independently', async () => {
    const { createCase, addAttachment } = await import('./cases')

    const a = await createCase(sampleCase('SR-A', 'Alice'))
    const b = await createCase(sampleCase('SR-B', 'Bob'))

    const a1 = await addAttachment(a.id, {
      originalName: 'one.png',
      mime: 'image/png',
      bytes: new Uint8Array([1]),
    })
    const a2 = await addAttachment(a.id, {
      originalName: 'two.png',
      mime: 'image/png',
      bytes: new Uint8Array([2]),
    })
    const b1 = await addAttachment(b.id, {
      originalName: 'three.png',
      mime: 'image/png',
      bytes: new Uint8Array([3]),
    })

    expect(a1?.id).toBe('att-001')
    expect(a2?.id).toBe('att-002')
    // Counter is per-case, so case-b starts over from 001
    expect(b1?.id).toBe('att-001')

    // Missing case returns null
    const none = await addAttachment('case-nope', {
      originalName: 'x.png',
      mime: 'image/png',
      bytes: new Uint8Array([0]),
    })
    expect(none).toBeNull()
  })

  // U-11: getSalesRecordNo falls back to legacy orderId if salesRecordNo missing
  it('U-11 getSalesRecordNo falls back to legacy orderId', async () => {
    const { getSalesRecordNo } = await import('./cases')

    expect(
      getSalesRecordNo({ customer: { name: '', address1: '', postcode: '', email: '', salesRecordNo: 'SR-123' } }),
    ).toBe('SR-123')

    expect(
      getSalesRecordNo({ customer: { name: '', address1: '', postcode: '', email: '', salesRecordNo: '', orderId: 'OLD-1' } }),
    ).toBe('OLD-1')

    expect(
      getSalesRecordNo({ customer: { name: '', address1: '', postcode: '', email: '', salesRecordNo: '' } }),
    ).toBe('')
  })

  // U-11b: removeAttachment + getAttachment (bonus coverage)
  it('U-11b removeAttachment + getAttachment', async () => {
    const { createCase, addAttachment, removeAttachment, getAttachment } = await import('./cases')

    const c = await createCase(sampleCase())
    const att = await addAttachment(c.id, {
      originalName: 'pic.jpg',
      mime: 'image/jpeg',
      bytes: new Uint8Array([9, 9, 9]),
    })
    expect(att).not.toBeNull()

    const fetched = await getAttachment(c.id, att!.id)
    expect(fetched).not.toBeNull()
    expect(fetched!.att.filename).toBe('att-001.jpg')
    expect(fsSync.existsSync(fetched!.diskPath)).toBe(true)

    expect(await removeAttachment('case-none', 'att-001')).toBe(false)
    expect(await removeAttachment(c.id, 'att-999')).toBe(false)
    expect(await removeAttachment(c.id, att!.id)).toBe(true)
    expect(fsSync.existsSync(fetched!.diskPath)).toBe(false)

    // After removal, getAttachment returns null
    expect(await getAttachment(c.id, att!.id)).toBeNull()
  })

  // U-11c: getAllCases returns all + getCaseById null on miss (bonus coverage)
  it('U-11c getAllCases / getCaseById', async () => {
    const { createCase, getAllCases, getCaseById } = await import('./cases')
    expect(await getAllCases()).toEqual([])
    const created = await createCase(sampleCase())
    const all = await getAllCases()
    expect(all).toHaveLength(1)
    expect(all[0].id).toBe(created.id)
    expect(await getCaseById(created.id)).not.toBeNull()
    expect(await getCaseById('case-missing')).toBeNull()
  })
})
