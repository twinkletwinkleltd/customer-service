// lib/portal-links.test.ts
import { describe, it, expect } from 'vitest'
import {
  PORTAL_HOST,
  extractEbayUsername,
  isRelayEmail,
  portraitUrl,
  customerLookupUrl,
} from './portal-links'

describe('portal-links', () => {
  describe('extractEbayUsername', () => {
    it('extracts local part from members.ebay.com relay', () => {
      expect(extractEbayUsername('abcde12345@members.ebay.com')).toBe('abcde12345')
    })

    it('lowercases the username', () => {
      expect(extractEbayUsername('ABCDE12345@MEMBERS.EBAY.COM')).toBe('abcde12345')
    })

    it('trims surrounding whitespace', () => {
      expect(extractEbayUsername('  abc@members.ebay.com  ')).toBe('abc')
    })

    it('returns null for real email / empty / nullish', () => {
      expect(extractEbayUsername('real@gmail.com')).toBeNull()
      expect(extractEbayUsername('')).toBeNull()
      expect(extractEbayUsername(undefined)).toBeNull()
      expect(extractEbayUsername(null)).toBeNull()
      expect(extractEbayUsername('not-an-email')).toBeNull()
    })
  })

  describe('isRelayEmail', () => {
    it('recognises relay emails', () => {
      expect(isRelayEmail('foo@members.ebay.com')).toBe(true)
      expect(isRelayEmail('FOO@MEMBERS.EBAY.COM')).toBe(true)
    })
    it('rejects real emails and nullish', () => {
      expect(isRelayEmail('real@gmail.com')).toBe(false)
      expect(isRelayEmail('')).toBe(false)
      expect(isRelayEmail(undefined)).toBe(false)
      expect(isRelayEmail(null)).toBe(false)
    })
  })

  describe('portraitUrl', () => {
    it('builds portrait URL with encoded username', () => {
      expect(portraitUrl('foo')).toBe(`${PORTAL_HOST}/customer-lookup/portrait/foo`)
      // special chars encoded
      expect(portraitUrl('a b')).toBe(`${PORTAL_HOST}/customer-lookup/portrait/a%20b`)
    })
    it('returns null for falsy username', () => {
      expect(portraitUrl(null)).toBeNull()
      expect(portraitUrl(undefined)).toBeNull()
      expect(portraitUrl('')).toBeNull()
    })
  })

  describe('customerLookupUrl', () => {
    it('builds lookup URL for real email', () => {
      expect(customerLookupUrl('real@gmail.com'))
        .toBe(`${PORTAL_HOST}/customer-lookup?q=real%40gmail.com`)
    })
    it('returns null for relay emails', () => {
      expect(customerLookupUrl('foo@members.ebay.com')).toBeNull()
    })
    it('returns null for empty/nullish', () => {
      expect(customerLookupUrl('')).toBeNull()
      expect(customerLookupUrl(undefined)).toBeNull()
      expect(customerLookupUrl(null)).toBeNull()
    })
  })
})
