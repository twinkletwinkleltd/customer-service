// lib/persistence.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import fsSync from 'fs'
import os from 'os'
import path from 'path'
import crypto from 'crypto'

// NOTE: We must set PORTAL_DATA_ROOT before importing persistence because
// `getPortalDataRoot()` reads the env var at call time, not import time.
// Still, we reset per-test for isolation.

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

describe('persistence', () => {
  // U-1: getPortalDataRoot reads PORTAL_DATA_ROOT env var when set
  it('U-1 getPortalDataRoot reads PORTAL_DATA_ROOT env var when set', async () => {
    const { getPortalDataRoot } = await import('./persistence')
    expect(getPortalDataRoot()).toBe(tmpRoot)
  })

  // U-2: getPortalDataRoot falls back to process.cwd()/data when env unset
  it('U-2 getPortalDataRoot falls back when env unset', async () => {
    delete process.env.PORTAL_DATA_ROOT
    // Also clear PORTAL_SYSTEM_ROOT so sharedPortal fallback is predictable
    const prevSys = process.env.PORTAL_SYSTEM_ROOT
    delete process.env.PORTAL_SYSTEM_ROOT

    const { getPortalDataRoot } = await import('./persistence')
    const result = getPortalDataRoot()
    // sharedPortal's default is cwd/../../data; persistence falls back to
    // that shared default first. Either way it should be an absolute path
    // ending with "data".
    expect(path.isAbsolute(result)).toBe(true)
    expect(result.endsWith('data')).toBe(true)

    if (prevSys !== undefined) process.env.PORTAL_SYSTEM_ROOT = prevSys
  })

  // U-3: withCasesLock serialises concurrent writes
  it('U-3 withCasesLock serialises concurrent writes', async () => {
    const { withCasesLock } = await import('./persistence')
    const order: string[] = []

    const a = withCasesLock(async () => {
      order.push('a:start')
      await new Promise((r) => setTimeout(r, 30))
      order.push('a:end')
      return 'a'
    })
    const b = withCasesLock(async () => {
      order.push('b:start')
      await new Promise((r) => setTimeout(r, 10))
      order.push('b:end')
      return 'b'
    })

    const [ra, rb] = await Promise.all([a, b])
    expect(ra).toBe('a')
    expect(rb).toBe('b')
    // A must finish before B begins — no interleaving
    expect(order).toEqual(['a:start', 'a:end', 'b:start', 'b:end'])
  })

  // U-4: mutateCases reads, applies mutator, writes atomically
  it('U-4 mutateCases applies mutator and persists', async () => {
    const { mutateCases, readCases } = await import('./persistence')

    await mutateCases((cases) => {
      cases.push({
        id: 'case-001',
        customer: { name: 'Alice', address1: '', postcode: 'SW1', email: '', salesRecordNo: 'S1' },
        standardSku: 'R140_Black_125',
        conversation: [],
        category: 'Order',
        keywords: [],
        issue: 'Missing',
        resolution: '',
        status: 'open',
        attachments: [],
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      })
      return cases
    })

    const after = await readCases()
    expect(after).toHaveLength(1)
    expect(after[0].id).toBe('case-001')
    expect(after[0].customer.name).toBe('Alice')
  })

  // U-5: atomicWriteJson (via writeCases) writes to .tmp then renames
  it('U-5 writeCases does not leave .tmp files behind', async () => {
    const { writeCases, getCasesFile } = await import('./persistence')
    await writeCases([])
    const file = getCasesFile()
    expect(fsSync.existsSync(file)).toBe(true)

    // Scan the directory for any residual .tmp files
    const dir = path.dirname(file)
    const entries = await fs.readdir(dir)
    const leftovers = entries.filter((e) => e.endsWith('.tmp'))
    expect(leftovers).toEqual([])
  })

  // U-6: readCases returns empty array + creates file when ENOENT
  it('U-6 readCases creates empty cases.json on first read', async () => {
    const { readCases, getCasesFile } = await import('./persistence')
    const file = getCasesFile()
    expect(fsSync.existsSync(file)).toBe(false)

    const result = await readCases()
    expect(result).toEqual([])
    expect(fsSync.existsSync(file)).toBe(true)
    const parsed = JSON.parse(await fs.readFile(file, 'utf-8'))
    expect(parsed).toEqual([])
  })

  // U-6b: readReplies seeds the 10 standard replies on first read (bonus coverage)
  it('U-6b readReplies seeds standard replies on first read', async () => {
    const { readReplies, getRepliesFile } = await import('./persistence')
    const file = getRepliesFile()
    expect(fsSync.existsSync(file)).toBe(false)

    const replies = await readReplies()
    expect(replies.length).toBeGreaterThanOrEqual(10)
    expect(fsSync.existsSync(file)).toBe(true)

    // Reading again returns the same set (now from disk, not seed path)
    const again = await readReplies()
    expect(again.length).toBe(replies.length)
  })
})
