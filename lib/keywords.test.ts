// lib/keywords.test.ts
import { describe, it, expect } from 'vitest'
import { extractKeywords } from './keywords'

describe('keywords', () => {
  // U-14: extractKeywords filters stopwords, normalizes case, returns terms >=3 chars
  it('U-14 filters stopwords, normalizes case, minimum 3 chars', async () => {
    const out = extractKeywords([
      'I have a broken ORDER and it arrived damaged',
      'my order is broken broken broken',
    ])

    // Lowercased
    expect(out).toContain('broken')
    expect(out).toContain('order')
    expect(out).toContain('arrived')
    expect(out).toContain('damaged')

    // Stopwords removed
    expect(out).not.toContain('i')
    expect(out).not.toContain('have')
    expect(out).not.toContain('a')
    expect(out).not.toContain('and')
    expect(out).not.toContain('is')
    expect(out).not.toContain('my')
    expect(out).not.toContain('it')

    // Short tokens (<3 chars) removed
    for (const t of out) {
      expect(t.length).toBeGreaterThanOrEqual(3)
    }

    // Frequency-ranked: 'broken' appears 4 times across inputs -> rank #1
    expect(out[0]).toBe('broken')
  })

  // U-14b: empty input returns empty array
  it('U-14b empty / stopword-only input returns empty array', () => {
    expect(extractKeywords([])).toEqual([])
    expect(extractKeywords(['the a an is it'])).toEqual([])
    expect(extractKeywords([''])).toEqual([])
  })

  // U-14c: caps at 8 keywords
  it('U-14c caps at 8 keywords', () => {
    const input = [
      'alpha beta gamma delta epsilon zeta eta theta iota kappa lambda mu nu',
    ]
    const out = extractKeywords(input)
    expect(out.length).toBeLessThanOrEqual(8)
  })

  // U-14d: punctuation stripped
  it('U-14d strips punctuation', () => {
    const out = extractKeywords(['Order: broken! Arrived, damaged.'])
    expect(out).toContain('broken')
    expect(out).toContain('damaged')
    // Apostrophes/hyphens are kept per the allowed-char regex
    expect(out).toContain('order')
  })
})
