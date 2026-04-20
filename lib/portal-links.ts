// lib/portal-links.ts
//
// Helpers for deep-linking a customer case to the main Portal
// (ordercleaner.twinkletwinkle.uk) — customer portrait + Customer Lookup.
//
// Extracted out of the case detail page so the logic is unit-testable.

export const PORTAL_HOST = 'https://ordercleaner.twinkletwinkle.uk'

const RELAY_DOMAIN_RE = /@members\.ebay\.com$/i
const EBAY_RELAY_RE   = /^([^@\s]+)@members\.ebay\.com$/i

/**
 * eBay relay emails look like `abcde12345@members.ebay.com`. The local
 * part before the `@` is the eBay username we deep-link into the
 * portrait page. Returns null for non-relay or empty input.
 */
export function extractEbayUsername(email: string | undefined | null): string | null {
  if (!email) return null
  const m = email.trim().match(EBAY_RELAY_RE)
  return m ? m[1].toLowerCase() : null
}

/**
 * True when the email is an `@members.ebay.com` relay address.
 */
export function isRelayEmail(email: string | undefined | null): boolean {
  if (!email) return false
  return RELAY_DOMAIN_RE.test(email.trim())
}

/**
 * Build the portrait URL for a given eBay username, or null when missing.
 */
export function portraitUrl(ebayUsername: string | null | undefined): string | null {
  if (!ebayUsername) return null
  return `${PORTAL_HOST}/customer-lookup/portrait/${encodeURIComponent(ebayUsername)}`
}

/**
 * Build the Customer Lookup search URL for a real (non-relay) email.
 * Returns null for empty or relay emails.
 */
export function customerLookupUrl(email: string | undefined | null): string | null {
  if (!email || isRelayEmail(email)) return null
  return `${PORTAL_HOST}/customer-lookup?q=${encodeURIComponent(email.trim())}`
}
