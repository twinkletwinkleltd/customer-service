// lib/keywords.ts
// Pure client-safe — no Node.js imports, runs in browser.

const STOPWORDS = new Set([
  'i','my','the','a','an','is','it','was','were','have','has','been',
  'this','that','to','in','of','and','or','but','for','not','with',
  'on','at','are','do','did','we','you','your','me','us','our','its',
  'be','can','will','just','so','get','got','they','their','there',
  'what','how','when','why','which','who','would','could','should',
  'hi','hello','dear','please','thank','thanks','sir','madam','am','im',
])

/**
 * Extract up to 8 keywords from a list of customer message texts.
 * Frequency-ranked, stopwords removed, minimum 3 chars.
 */
export function extractKeywords(customerTexts: string[]): string[] {
  const freq: Record<string, number> = {}

  for (const text of customerTexts) {
    const tokens = text
      .toLowerCase()
      .replace(/[^a-z0-9\s'-]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !STOPWORDS.has(t))

    for (const t of tokens) {
      freq[t] = (freq[t] ?? 0) + 1
    }
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([word]) => word)
}
