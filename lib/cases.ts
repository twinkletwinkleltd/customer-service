// lib/cases.ts
import fs from 'fs/promises'
import path from 'path'
import { readCases, writeCases, mutateCases, getCaseImagesDir } from './persistence'
import type { Attachment, CustomerCase, CasePatch } from './types'

function nextId(cases: CustomerCase[]): string {
  const max = cases.reduce((acc, c) => {
    const n = parseInt(c.id.replace('case-', ''), 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 0)
  return `case-${String(max + 1).padStart(3, '0')}`
}

/**
 * Read-compat helper — returns salesRecordNo, falling back to legacy orderId.
 */
export function getSalesRecordNo(c: Pick<CustomerCase, 'customer'>): string {
  return c.customer.salesRecordNo || c.customer.orderId || ''
}

export async function getAllCases(): Promise<CustomerCase[]> {
  return readCases()
}

export async function getCaseById(id: string): Promise<CustomerCase | null> {
  const cases = await readCases()
  return cases.find((c) => c.id === id) ?? null
}

/**
 * Payload accepted by the create-case API. Matches what the New Case page
 * posts: no id / createdAt / updatedAt / attachments — those are assigned
 * server-side.
 */
export type NewCaseData = Omit<CustomerCase, 'id' | 'createdAt' | 'updatedAt' | 'attachments'>

export async function createCase(data: NewCaseData): Promise<CustomerCase> {
  let newCase: CustomerCase | null = null
  await mutateCases((cases) => {
    const now = new Date().toISOString()
    newCase = {
      id: nextId(cases),
      ...data,
      attachments: [],
      createdAt: now,
      updatedAt: now,
    }
    return [...cases, newCase]
  })
  return newCase!
}

export async function patchCase(id: string, patch: CasePatch): Promise<CustomerCase | null> {
  let updated: CustomerCase | null = null
  await mutateCases((cases) => {
    const idx = cases.findIndex((c) => c.id === id)
    if (idx === -1) return cases
    updated = {
      ...cases[idx],
      ...patch,
      updatedAt: new Date().toISOString(),
    }
    cases[idx] = updated
    return cases
  })
  return updated
}

export async function deleteCase(id: string): Promise<boolean> {
  let removed = false
  await mutateCases((cases) => {
    const filtered = cases.filter((c) => c.id !== id)
    removed = filtered.length !== cases.length
    return filtered
  })
  if (!removed) return false
  // Wipe any stored images for this case. Best-effort: ignore ENOENT.
  const imagesDir = path.join(getCaseImagesDir(), id)
  try {
    await fs.rm(imagesDir, { recursive: true, force: true })
  } catch {
    // Ignore — directory may not exist.
  }
  return true
}

// ─── Attachments ──────────────────────────────────────────────────────────

interface AddAttachmentInput {
  originalName: string
  mime: string
  bytes: Uint8Array
}

/**
 * Store an attachment on disk and record its metadata on the case.
 * Returns the new attachment, or null if the case does not exist.
 */
export async function addAttachment(
  caseId: string,
  file: AddAttachmentInput,
): Promise<Attachment | null> {
  // Pre-compute attachment ID + write the file to disk first (outside the
  // lock). The lock only wraps the cases.json read-modify-write, so disk
  // I/O for the image doesn't block other case mutations.
  const cases = await readCases()
  const idx = cases.findIndex((c) => c.id === caseId)
  if (idx === -1) return null

  const existing = cases[idx].attachments ?? []
  const attId = nextAttachmentId(existing)
  const safeOriginal = sanitizeFilename(file.originalName)
  const ext = path.extname(safeOriginal).toLowerCase()
  const onDiskName = `${attId}${ext}`

  const dir = path.join(getCaseImagesDir(), caseId)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(path.join(dir, onDiskName), file.bytes)

  const now = new Date().toISOString()
  const att: Attachment = {
    id: attId,
    filename: onDiskName,
    originalName: safeOriginal,
    mime: file.mime,
    size: file.bytes.byteLength,
    createdAt: now,
  }

  // Now acquire lock and update cases.json
  let success = false
  await mutateCases((current) => {
    const i = current.findIndex((c) => c.id === caseId)
    if (i === -1) return current
    const ex = current[i].attachments ?? []
    current[i] = {
      ...current[i],
      attachments: [...ex, att],
      updatedAt: now,
    }
    success = true
    return current
  })
  if (!success) {
    // Case was deleted during our write — clean up the orphan file
    try { await fs.unlink(path.join(dir, onDiskName)) } catch { /* ignore */ }
    return null
  }
  return att
}

export async function removeAttachment(caseId: string, attId: string): Promise<boolean> {
  // Read once outside lock to find the disk file path
  const cases = await readCases()
  const idx = cases.findIndex((c) => c.id === caseId)
  if (idx === -1) return false
  const existing = cases[idx].attachments ?? []
  const att = existing.find((a) => a.id === attId)
  if (!att) return false

  const diskPath = path.join(getCaseImagesDir(), caseId, att.filename)
  try {
    await fs.unlink(diskPath)
  } catch {
    // Ignore missing-file errors; still clean up metadata.
  }

  let removed = false
  await mutateCases((current) => {
    const i = current.findIndex((c) => c.id === caseId)
    if (i === -1) return current
    const ex = current[i].attachments ?? []
    const next = ex.filter((a) => a.id !== attId)
    if (next.length === ex.length) return current
    current[i] = {
      ...current[i],
      attachments: next,
      updatedAt: new Date().toISOString(),
    }
    removed = true
    return current
  })
  return removed
}

export async function getAttachment(
  caseId: string,
  attId: string,
): Promise<{ att: Attachment; diskPath: string } | null> {
  const cases = await readCases()
  const c = cases.find((x) => x.id === caseId)
  if (!c) return null
  const att = (c.attachments ?? []).find((a) => a.id === attId)
  if (!att) return null
  return { att, diskPath: path.join(getCaseImagesDir(), caseId, att.filename) }
}

function nextAttachmentId(existing: Attachment[]): string {
  const max = existing.reduce((acc, a) => {
    const n = parseInt(a.id.replace('att-', ''), 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 0)
  return `att-${String(max + 1).padStart(3, '0')}`
}

function sanitizeFilename(name: string): string {
  const base = name.replace(/[\\/]/g, '_').replace(/[^\w.\-]/g, '_')
  return base || 'file'
}
