// lib/search.ts
import { readCases, readReplies } from './persistence'
import type { SearchResult } from './types'

export async function search(query: string, topN = 5): Promise<SearchResult[]> {
  const lower = query.toLowerCase()
  const terms = lower.split(/\s+/).filter((t) => t.length >= 2)

  const [cases, replies] = await Promise.all([readCases(), readReplies()])

  const results: SearchResult[] = []

  // Score resolved cases
  for (const c of cases) {
    if (c.status !== 'resolved') continue
    const text = [c.issue, c.resolution, ...c.keywords, c.category].join(' ').toLowerCase()
    const customerText = c.conversation
      .filter((m) => m.role === 'customer')
      .map((m) => m.text)
      .join(' ')
      .toLowerCase()
    const combined = text + ' ' + customerText
    const score = terms.filter((t) => combined.includes(t)).length
    if (score > 0) results.push({ type: 'case', score, case: c })
  }

  // Score standard replies
  for (const r of replies) {
    const text = [r.question, r.reply, ...r.keywords, r.category].join(' ').toLowerCase()
    const score = terms.filter((t) => text.includes(t)).length
    if (score > 0) results.push({ type: 'reply', score, reply: r })
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
}
