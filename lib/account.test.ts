// lib/account.test.ts
import { describe, it, expect } from 'vitest'
import { ACCOUNT_DISPLAY, ACCOUNT_VALUES, isAccount } from './account'

describe('account enum', () => {
  it('includes all four expected accounts', () => {
    // Order preserved so the UI dropdown stays stable across releases.
    expect(ACCOUNT_VALUES).toEqual(['gorble', 'ssys', 'ama_tktk', 'shopify'])
  })

  it('has a display label for every account value', () => {
    for (const a of ACCOUNT_VALUES) {
      expect(ACCOUNT_DISPLAY[a]).toBeTruthy()
    }
    expect(ACCOUNT_DISPLAY.shopify).toBe('Shopify')
  })

  it('isAccount accepts all known values and rejects unknown', () => {
    for (const a of ACCOUNT_VALUES) expect(isAccount(a)).toBe(true)
    expect(isAccount('shopify')).toBe(true)
    expect(isAccount('GORBLE')).toBe(false) // case-sensitive
    expect(isAccount('')).toBe(false)
    expect(isAccount(undefined)).toBe(false)
    expect(isAccount(null)).toBe(false)
    expect(isAccount(123)).toBe(false)
  })
})
