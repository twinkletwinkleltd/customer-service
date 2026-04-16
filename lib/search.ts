// lib/search.ts
import { readCases, readReplies } from './persistence'
import { getSalesRecordNo } from './cases'
import type { CustomerCase, SearchResult, StandardReply } from './types'

export interface SearchHints {
  /** Boost score when a candidate case shares the same standardSku. */
  skuHint?: string
  /** Boost score when a candidate case shares the same account. */
  accountHint?: string
}

/**
 * Deterministic keyword-enhanced search.
 *
 * Per-candidate scoring (summed over all query terms that hit each field):
 *   - issue body match: +3 per term
 *   - customer message match: +2 per term
 *   - keywords / category / resolution / standardSku / account / salesRecordNo: +1 per term
 *   - same SKU as hint: +4 (once)
 *   - same account as hint: +2 (once)
 *   - resolved case bonus: +1 (once)
 *
 * Tie-break by updatedAt desc. Returns top N across cases + replies.
 */
export async function search(
  query: string,
  topN = 5,
  hints: SearchHints = {},
): Promise<SearchResult[]> {
  const lower = query.toLowerCase()
  const terms = lower.split(/\s+/).filter((t) => t.length >= 2)

  const [cases, replies] = await Promise.all([readCases(), readReplies()])

  const caseHits = cases
    .map((c) => ({ c, score: scoreCase(c, terms, hints) }))
    .filter((x) => x.score > 0)

  const replyHits = replies
    .map((r) => ({ r, score: scoreReply(r, terms) }))
    .filter((x) => x.score > 0)

  const combined: Array<SearchResult & { tiebreak: string }> = []

  for (const { c, score } of caseHits) {
    combined.push({ type: 'case', score, case: c, tiebreak: c.updatedAt })
  }
  for (const { r, score } of replyHits) {
    // Standard replies have no updatedAt — use id as stable tiebreak.
    combined.push({ type: 'reply', score, reply: r, tiebreak: r.id })
  }

  combined.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score
    // Later updatedAt (ISO string compares correctly) wins for cases;
    // for reply vs case at same score, cases rank first.
    if (a.type !== b.type) return a.type === 'case' ? -1 : 1
    return b.tiebreak.localeCompare(a.tiebreak)
  })

  return combined.slice(0, topN).map(({ tiebreak: _t, ...rest }) => rest as SearchResult)
}

function scoreCase(c: CustomerCase, terms: string[], hints: SearchHints): number {
  if (terms.length === 0 && !hints.skuHint && !hints.accountHint) return 0

  const issue = (c.issue || '').toLowerCase()
  const customerText = c.conversation
    .filter((m) => m.role === 'customer')
    .map((m) => m.text)
    .join(' ')
    .toLowerCase()
  const metaText = [
    c.resolution || '',
    ...(c.keywords || []),
    c.category || '',
    c.standardSku || '',
    c.account || '',
    getSalesRecordNo(c),
  ].join(' ').toLowerCase()

  let score = 0
  for (const t of terms) {
    if (issue.includes(t))        score += 3
    if (customerText.includes(t)) score += 2
    if (metaText.includes(t))     score += 1
  }

  if (hints.skuHint && c.standardSku && c.standardSku === hints.skuHint) score += 4
  if (hints.accountHint && c.account && c.account === hints.accountHint) score += 2
  if (c.status === 'resolved' && score > 0) score += 1

  return score
}

function scoreReply(r: StandardReply, terms: string[]): number {
  if (terms.length === 0) return 0
  const text = [r.question, r.reply, ...(r.keywords || []), r.category].join(' ').toLowerCase()
  let score = 0
  for (const t of terms) {
    if (text.includes(t)) score += 1
  }
  return score
}
