// lib/cases.ts
import { readCases, writeCases } from './persistence'
import type { CustomerCase, CasePatch } from './types'

function nextId(cases: CustomerCase[]): string {
  const max = cases.reduce((acc, c) => {
    const n = parseInt(c.id.replace('case-', ''), 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 0)
  return `case-${String(max + 1).padStart(3, '0')}`
}

export async function getAllCases(): Promise<CustomerCase[]> {
  return readCases()
}

export async function getCaseById(id: string): Promise<CustomerCase | null> {
  const cases = await readCases()
  return cases.find((c) => c.id === id) ?? null
}

export type NewCaseData = Omit<CustomerCase, 'id' | 'createdAt' | 'updatedAt'>

export async function createCase(data: NewCaseData): Promise<CustomerCase> {
  const cases = await readCases()
  const now = new Date().toISOString()
  const newCase: CustomerCase = {
    id: nextId(cases),
    ...data,
    createdAt: now,
    updatedAt: now,
  }
  await writeCases([...cases, newCase])
  return newCase
}

export async function patchCase(id: string, patch: CasePatch): Promise<CustomerCase | null> {
  const cases = await readCases()
  const idx = cases.findIndex((c) => c.id === id)
  if (idx === -1) return null
  const updated: CustomerCase = {
    ...cases[idx],
    ...patch,
    updatedAt: new Date().toISOString(),
  }
  cases[idx] = updated
  await writeCases(cases)
  return updated
}

export async function deleteCase(id: string): Promise<boolean> {
  const cases = await readCases()
  const filtered = cases.filter((c) => c.id !== id)
  if (filtered.length === cases.length) return false
  await writeCases(filtered)
  return true
}
