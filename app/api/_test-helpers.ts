// app/api/_test-helpers.ts
//
// Shared helpers for integration tests against route handlers. NOT a .test.ts
// file so vitest's test runner won't try to collect tests from it.
import os from 'os'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import type { NewCaseData } from '@/lib/cases'

export async function setupTmpDataRoot(): Promise<string> {
  const dir = path.join(os.tmpdir(), `cs-test-${crypto.randomUUID()}`)
  await fs.mkdir(dir, { recursive: true })
  process.env.PORTAL_DATA_ROOT = dir
  return dir
}

export async function cleanupTmpDataRoot(dir: string): Promise<void> {
  try {
    await fs.rm(dir, { recursive: true, force: true })
  } catch {
    // ignore
  }
  delete process.env.PORTAL_DATA_ROOT
}

/**
 * Build a NewCaseData payload with sensible defaults. The handler validates
 * customer.name / customer.salesRecordNo / account / creator / standardSku /
 * issue / conversation, so all of those must be present by default.
 */
export function makeNewCaseData(overrides: Partial<NewCaseData> = {}): NewCaseData {
  const { customer: customerOverride, ...rest } = overrides
  return {
    account: 'gorble',
    creator: 'star001',
    standardSku: 'R140_Black_150',
    conversation: [
      { role: 'customer', text: 'My glasses arrived cracked', ts: '2026-01-01T00:00:00.000Z' },
    ],
    category: 'Product Issue',
    keywords: ['broken'],
    issue: 'Item received broken',
    resolution: '',
    status: 'open',
    ...rest,
    customer: {
      name: 'Alice',
      address1: '1 High Street',
      postcode: 'SW1A 1AA',
      email: 'alice@example.com',
      salesRecordNo: 'SR-001',
      ...(customerOverride ?? {}),
    },
  }
}

/**
 * Construct a context object for dynamic route handlers. Next.js 16.2 passes
 * `{ params: Promise<...> }` as the second argument.
 */
export function makeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> } {
  return { params: Promise.resolve(params) }
}

/**
 * Minimal 1x1 JPEG bytes for happy-path upload tests.
 */
export const TINY_JPEG_BYTES = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xdb, 0x00, 0x43,
  0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
  0x09, 0x08, 0x0a, 0x0c, 0x14, 0x0d, 0x0c, 0x0b, 0x0b, 0x0c, 0x19, 0x12,
  0x13, 0x0f, 0x14, 0x1d, 0x1a, 0x1f, 0x1e, 0x1d, 0x1a, 0x1c, 0x1c, 0x20,
  0x24, 0x2e, 0x27, 0x20, 0x22, 0x2c, 0x23, 0x1c, 0x1c, 0x28, 0x37, 0x29,
  0x2c, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1f, 0x27, 0x39, 0x3d, 0x38, 0x32,
  0x3c, 0x2e, 0x33, 0x34, 0x32, 0xff, 0xd9,
])
