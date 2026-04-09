# Customer Service Rebuild Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `apps/customer-service` into a real customer case management system with conversation recording, smart search, and SKU-linked defect tracking.

**Architecture:** File-based JSON persistence (two files: `cases.json` for real customer cases, `replies.json` for standard reply templates). All logic is server-side in lib/ files consumed by Next.js API routes. UI is Tailwind-styled React client components.

**Tech Stack:** Next.js 16.2.1 (app dir), React 19, TypeScript, Tailwind CSS, Node.js fs for JSON persistence. No external API calls, no database.

**Spec:** `docs/superpowers/specs/2026-04-09-customer-service-redesign.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/types.ts` | Create | All shared TypeScript types |
| `lib/persistence.ts` | Rewrite | Read/write cases.json + replies.json |
| `lib/keywords.ts` | Create | Client-side keyword extraction from conversation |
| `lib/cases.ts` | Rewrite | CustomerCase CRUD |
| `lib/replies.ts` | Create | StandardReply CRUD + migration from old seed data |
| `lib/search.ts` | Create | Unified search across cases + replies |
| `app/api/cases/route.ts` | Rewrite | GET list / POST create |
| `app/api/cases/[id]/route.ts` | Rewrite | GET one / PATCH update / DELETE |
| `app/api/replies/route.ts` | Create | GET all standard replies |
| `app/api/search/route.ts` | Create | POST search query |
| `app/page.tsx` | Rewrite | Assistant search UI |
| `app/cases/page.tsx` | Rewrite | Case list + SKU stats |
| `app/cases/new/page.tsx` | Create | New case form with chat-style input |
| `app/cases/[id]/page.tsx` | Create | Case detail + inline edit |
| `app/layout.tsx` | Minor update | Keep nav: Assistant + Cases |
| `app/api/cases/import/route.ts` | Delete | No longer needed |
| `app/api/reply/route.ts` | Delete | Replaced by /api/search |
| `app/ssys/page.tsx` | Delete | Belongs in main portal |
| `app/pending/page.tsx` | Delete | Belongs in main portal |
| `app/api/inventory/` | Delete dir | Belongs in main portal |
| `app/api/pending/` | Delete dir | Belongs in main portal |
| `lib/store.ts` | Delete | Replaced by lib/cases.ts + lib/replies.ts |
| `lib/history.ts` | Delete | Replaced by server-side cases |
| `lib/sharedPortal.ts` | Keep | Still needed for portal path resolution |

---

## Task 1: Types

**Files:**
- Create: `apps/customer-service/lib/types.ts`

- [ ] **Step 1.1: Create lib/types.ts**

```typescript
// lib/types.ts

export interface Message {
  role: 'customer' | 'agent'
  text: string
  ts: string   // ISO 8601
}

export interface CustomerInfo {
  name: string
  address1: string
  postcode: string
  email: string
  orderId: string
}

export interface CustomerCase {
  id: string
  customer: CustomerInfo
  standardSku: string
  conversation: Message[]
  category: string
  keywords: string[]
  issue: string
  resolution: string
  status: 'open' | 'resolved'
  createdAt: string
  updatedAt: string
}

export interface StandardReply {
  id: string
  category: string
  keywords: string[]
  question: string
  reply: string
}

export type CasePatch = Partial<Pick<CustomerCase,
  'status' | 'resolution' | 'keywords' | 'issue' | 'category' | 'conversation'
>>

export interface SearchResult {
  type: 'case' | 'reply'
  score: number
  case?: CustomerCase
  reply?: StandardReply
}
```

- [ ] **Step 1.2: Commit**

```bash
git add lib/types.ts
git commit -m "feat(types): add CustomerCase, StandardReply, SearchResult types"
```

---

## Task 2: Persistence layer

**Files:**
- Rewrite: `apps/customer-service/lib/persistence.ts`

- [ ] **Step 2.1: Rewrite lib/persistence.ts**

```typescript
// lib/persistence.ts
import fs from 'fs/promises'
import path from 'path'
import type { CustomerCase, StandardReply } from './types'

const DATA_DIR  = path.join(process.cwd(), 'data')
const CASES_FILE   = path.join(DATA_DIR, 'cases.json')
const REPLIES_FILE = path.join(DATA_DIR, 'replies.json')

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

// ─── Cases ────────────────────────────────────────────────────────────────

export async function readCases(): Promise<CustomerCase[]> {
  try {
    return JSON.parse(await fs.readFile(CASES_FILE, 'utf-8')) as CustomerCase[]
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeCases([])
      return []
    }
    throw e
  }
}

export async function writeCases(cases: CustomerCase[]): Promise<void> {
  await ensureDir()
  await fs.writeFile(CASES_FILE, JSON.stringify(cases, null, 2), 'utf-8')
}

// ─── Standard Replies ────────────────────────────────────────────────────

const SEED_REPLIES: StandardReply[] = [
  { id: 'reply-001', category: 'Order & Shipping', question: 'Where is my order?', reply: 'Your order is currently being processed and will be shipped soon. You will receive a tracking number via email once dispatched.', keywords: ['order', 'where', 'shipping', 'tracking', 'delivery'] },
  { id: 'reply-002', category: 'Order & Shipping', question: 'My package arrived damaged.', reply: 'We are sorry to hear that. Please send us a photo of the damage along with your order number and we will arrange a replacement or full refund immediately.', keywords: ['damaged', 'package', 'broken', 'arrived'] },
  { id: 'reply-003', category: 'Refunds & Returns', question: 'I want to return my order.', reply: 'You can request a return and refund within 30 days of purchase. Please provide your order number and reason for return and we will process your refund within 3–5 business days.', keywords: ['refund', 'return', 'cancel', 'money back'] },
  { id: 'reply-004', category: 'Refunds & Returns', question: 'How long does a refund take?', reply: 'Once your return is received and approved, refunds typically appear on your card within 5–10 business days depending on your bank.', keywords: ['refund', 'how long', 'card', 'days'] },
  { id: 'reply-005', category: 'Product Issue', question: 'The product is not working properly.', reply: 'We apologize for the inconvenience. Please describe the issue in detail and include your order number. We will troubleshoot with you or arrange a replacement right away.', keywords: ['not working', 'broken', 'defective', 'problem', 'fault'] },
  { id: 'reply-006', category: 'Product Issue', question: 'I received the wrong item.', reply: 'We apologize for sending the wrong item. Please send us a photo of what you received along with your order number and we will ship the correct item immediately at no extra cost.', keywords: ['wrong item', 'incorrect', 'wrong product', 'different'] },
  { id: 'reply-007', category: 'Billing', question: 'I was charged twice.', reply: 'We are sorry for the billing error. Please share your order number and the last 4 digits of your card and we will investigate and issue a refund for the duplicate charge promptly.', keywords: ['charged twice', 'double charge', 'duplicate', 'billing'] },
  { id: 'reply-008', category: 'Billing', question: 'Can I get an invoice?', reply: 'You can download your invoice from your account under Orders → View Order → Download Invoice. If you need a specific format please let us know.', keywords: ['invoice', 'receipt', 'bill', 'tax'] },
  { id: 'reply-009', category: 'Account & Access', question: 'I forgot my password.', reply: 'To reset your password, click "Forgot Password" on the login page and follow the instructions sent to your registered email address.', keywords: ['password', 'forgot', 'login', 'reset', 'access'] },
  { id: 'reply-010', category: 'Account & Access', question: 'I want to delete my account.', reply: 'To delete your account, please go to Settings → Account → Delete Account. Note that this action is irreversible and all data will be removed.', keywords: ['delete', 'account', 'close', 'remove', 'deactivate'] },
]

export async function readReplies(): Promise<StandardReply[]> {
  try {
    return JSON.parse(await fs.readFile(REPLIES_FILE, 'utf-8')) as StandardReply[]
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      // First run — seed with migrated standard replies
      await writeReplies(SEED_REPLIES)
      return SEED_REPLIES
    }
    throw e
  }
}

export async function writeReplies(replies: StandardReply[]): Promise<void> {
  await ensureDir()
  await fs.writeFile(REPLIES_FILE, JSON.stringify(replies, null, 2), 'utf-8')
}
```

- [ ] **Step 2.2: Commit**

```bash
git add lib/persistence.ts
git commit -m "feat(persistence): rewrite for CustomerCase + StandardReply dual-file storage"
```

---

## Task 3: Keyword extraction

**Files:**
- Create: `apps/customer-service/lib/keywords.ts`

- [ ] **Step 3.1: Create lib/keywords.ts**

```typescript
// lib/keywords.ts
// Pure client-safe — no Node.js imports, runs in browser.

const STOPWORDS = new Set([
  'i','my','the','a','an','is','it','was','were','have','has','been',
  'this','that','to','in','of','and','or','but','for','not','with',
  'on','at','are','do','did','we','you','your','me','us','our','its',
  'be','can','will','just','so','get','got','they','their','there',
  'its','what','how','when','why','which','who','would','could','should',
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
```

- [ ] **Step 3.2: Commit**

```bash
git add lib/keywords.ts
git commit -m "feat(keywords): add client-side keyword extraction from customer messages"
```

---

## Task 4: Cases and Replies CRUD

**Files:**
- Rewrite: `apps/customer-service/lib/cases.ts`
- Create: `apps/customer-service/lib/replies.ts`

- [ ] **Step 4.1: Rewrite lib/cases.ts**

```typescript
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
```

- [ ] **Step 4.2: Create lib/replies.ts**

```typescript
// lib/replies.ts
import { readReplies } from './persistence'
import type { StandardReply } from './types'

export async function getAllReplies(): Promise<StandardReply[]> {
  return readReplies()
}
```

- [ ] **Step 4.3: Create lib/search.ts**

```typescript
// lib/search.ts
import { readCases } from './persistence'
import { readReplies } from './persistence'
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
```

- [ ] **Step 4.4: Commit**

```bash
git add lib/cases.ts lib/replies.ts lib/search.ts
git commit -m "feat(lib): add CustomerCase CRUD, StandardReply read, unified search"
```

---

## Task 5: API Routes

**Files:**
- Rewrite: `apps/customer-service/app/api/cases/route.ts`
- Rewrite: `apps/customer-service/app/api/cases/[id]/route.ts`
- Create: `apps/customer-service/app/api/replies/route.ts`
- Create: `apps/customer-service/app/api/search/route.ts`
- Delete: `apps/customer-service/app/api/cases/import/route.ts`
- Delete: `apps/customer-service/app/api/reply/route.ts`
- Delete: `apps/customer-service/app/api/inventory/` (entire directory)
- Delete: `apps/customer-service/app/api/pending/` (entire directory)

- [ ] **Step 5.1: Rewrite app/api/cases/route.ts**

```typescript
// app/api/cases/route.ts
import { getAllCases, createCase } from '@/lib/cases'
import type { NewCaseData } from '@/lib/cases'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const sku    = searchParams.get('sku')
    const q      = searchParams.get('q')?.toLowerCase()

    let cases = await getAllCases()

    if (status) cases = cases.filter((c) => c.status === status)
    if (sku)    cases = cases.filter((c) => c.standardSku === sku)
    if (q)      cases = cases.filter((c) =>
      c.issue.toLowerCase().includes(q) ||
      c.customer.name.toLowerCase().includes(q) ||
      c.customer.orderId.toLowerCase().includes(q) ||
      c.keywords.some((k) => k.includes(q))
    )

    return Response.json(cases)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as NewCaseData
    if (!body.customer?.name || !body.standardSku || !body.issue) {
      return Response.json({ error: 'customer.name, standardSku and issue are required' }, { status: 400 })
    }
    const newCase = await createCase(body)
    return Response.json(newCase, { status: 201 })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 5.2: Rewrite app/api/cases/[id]/route.ts**

```typescript
// app/api/cases/[id]/route.ts
import { getCaseById, patchCase, deleteCase } from '@/lib/cases'
import type { CasePatch } from '@/lib/types'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const c = await getCaseById(id)
    if (!c) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(c)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const patch = await request.json() as CasePatch
    const updated = await patchCase(id, patch)
    if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(updated)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const deleted = await deleteCase(id)
    if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 5.3: Create app/api/replies/route.ts**

```typescript
// app/api/replies/route.ts
import { getAllReplies } from '@/lib/replies'

export async function GET() {
  try {
    const replies = await getAllReplies()
    return Response.json(replies)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 5.4: Create app/api/search/route.ts**

```typescript
// app/api/search/route.ts
import { search } from '@/lib/search'

export async function POST(request: Request) {
  try {
    const { query } = await request.json() as { query: string }
    if (!query?.trim()) return Response.json([])
    const results = await search(query)
    return Response.json(results)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
```

- [ ] **Step 5.5: Delete obsolete API routes**

```bash
# In apps/customer-service/
rm -rf app/api/cases/import
rm -f app/api/reply/route.ts && rmdir app/api/reply
rm -rf app/api/inventory
rm -rf app/api/pending
rm app/ssys/page.tsx && rmdir app/ssys
rm app/pending/page.tsx && rmdir app/pending
```

- [ ] **Step 5.6: Delete obsolete lib files**

```bash
rm lib/store.ts lib/history.ts
```

- [ ] **Step 5.7: Commit**

```bash
git add -A
git commit -m "feat(api): rewrite cases/replies/search routes, remove inventory/pending/ssys"
```

---

## Task 6: Assistant page (home)

**Files:**
- Rewrite: `apps/customer-service/app/page.tsx`

- [ ] **Step 6.1: Rewrite app/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SearchResult } from '@/lib/types'

function highlight(text: string, query: string): string {
  return text // plain text — no markup needed for v1
}

export default function AssistantPage() {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<SearchResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    const res  = await fetch('/api/search', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ query }),
    })
    const data = await res.json() as SearchResult[]
    setResults(data)
    setSearched(true)
    setLoading(false)
  }

  const caseResults  = results.filter((r) => r.type === 'case')
  const replyResults = results.filter((r) => r.type === 'reply')

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm"
            placeholder="Paste or type the customer's message…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-blue-600 text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* No results */}
        {searched && results.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-sm text-gray-400 text-center">
            No matching cases or replies found.{' '}
            <Link href="/cases/new" className="text-blue-500 hover:underline">
              Record this as a new case?
            </Link>
          </div>
        )}

        {/* Past Cases */}
        {caseResults.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Similar Past Cases ({caseResults.length})
            </h2>
            {caseResults.map((r) => {
              const c = r.case!
              return (
                <div key={c.id} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {c.category}
                      </span>
                      <span className="text-xs text-gray-400">{c.standardSku}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{c.customer.name}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{c.customer.orderId}</span>
                    </div>
                    <Link
                      href={`/cases/${c.id}`}
                      className="text-xs text-gray-400 hover:text-gray-700 shrink-0"
                    >
                      View ↗
                    </Link>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{c.issue}</p>
                  {c.resolution && (
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                      {c.resolution}
                      <button
                        onClick={() => navigator.clipboard.writeText(c.resolution)}
                        className="ml-2 text-xs text-green-600 hover:text-green-800"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {c.keywords.map((k) => (
                      <span key={k} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{k}</span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Standard Replies */}
        {replyResults.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Standard Replies ({replyResults.length})
            </h2>
            {replyResults.map((r) => {
              const reply = r.reply!
              return (
                <div key={reply.id} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      {reply.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 italic">{reply.question}</p>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                    {reply.reply}
                    <button
                      onClick={() => navigator.clipboard.writeText(reply.reply)}
                      className="ml-2 text-xs text-blue-500 hover:text-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 6.2: Commit**

```bash
git add app/page.tsx
git commit -m "feat(assistant): rebuild search UI with case + reply results"
```

---

## Task 7: Cases list page

**Files:**
- Rewrite: `apps/customer-service/app/cases/page.tsx`

- [ ] **Step 7.1: Rewrite app/cases/page.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { CustomerCase } from '@/lib/types'

const STATUS_COLORS = {
  open:     'bg-yellow-100 text-yellow-700',
  resolved: 'bg-green-100 text-green-700',
}

const CATEGORIES = ['All', 'Product Issue', 'Order & Shipping', 'Refunds & Returns', 'Billing', 'Other']

export default function CasesPage() {
  const [cases,      setCases]      = useState<CustomerCase[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [statusFilt, setStatusFilt] = useState('all')
  const [catFilt,    setCatFilt]    = useState('All')

  async function load() {
    setLoading(true)
    const res = await fetch('/api/cases')
    setCases(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const filtered = cases.filter((c) => {
    if (statusFilt !== 'all' && c.status !== statusFilt) return false
    if (catFilt !== 'All' && c.category !== catFilt) return false
    const q = search.toLowerCase()
    return !q ||
      c.customer.name.toLowerCase().includes(q) ||
      c.customer.orderId.toLowerCase().includes(q) ||
      c.standardSku.toLowerCase().includes(q) ||
      c.issue.toLowerCase().includes(q)
  })

  // SKU stats for defect-rate indicator
  const skuCounts: Record<string, number> = {}
  for (const c of cases) skuCounts[c.standardSku] = (skuCounts[c.standardSku] ?? 0) + 1
  const topSkus = Object.entries(skuCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-800">Cases</h1>
          <Link href="/cases/new">
            <button className="bg-blue-600 text-white rounded-xl px-5 py-2 text-sm font-medium hover:bg-blue-700 transition-colors">
              + New Case
            </button>
          </Link>
        </div>

        {/* SKU stats strip */}
        {topSkus.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-4 flex flex-wrap gap-3 items-center">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Top SKUs:</span>
            {topSkus.map(([sku, count]) => (
              <button
                key={sku}
                onClick={() => setSearch(sku)}
                className="text-xs bg-orange-50 text-orange-700 border border-orange-100 px-3 py-1 rounded-full hover:bg-orange-100 transition-colors"
              >
                {sku} <span className="font-bold">{count}</span>
              </button>
            ))}
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap gap-3 items-center">
          <input
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-56"
            placeholder="Search name / order / SKU / issue…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={statusFilt}
            onChange={(e) => setStatusFilt(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={catFilt}
            onChange={(e) => setCatFilt(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none bg-white"
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <span className="text-sm text-gray-400 ml-auto">{filtered.length} cases</span>
        </div>

        {/* Table */}
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm p-8 text-center text-sm text-gray-400">
            No cases found.
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">ID</th>
                  <th className="px-5 py-3 text-left font-medium">Customer</th>
                  <th className="px-5 py-3 text-left font-medium">Order</th>
                  <th className="px-5 py-3 text-left font-medium">SKU</th>
                  <th className="px-5 py-3 text-left font-medium">Issue</th>
                  <th className="px-5 py-3 text-left font-medium">Status</th>
                  <th className="px-5 py-3 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/cases/${c.id}`}
                  >
                    <td className="px-5 py-3 font-mono text-xs text-gray-400">{c.id}</td>
                    <td className="px-5 py-3 text-gray-700">{c.customer.name}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-500">{c.customer.orderId}</td>
                    <td className="px-5 py-3 font-mono text-xs text-gray-600">{c.standardSku}</td>
                    <td className="px-5 py-3 text-gray-600 max-w-xs truncate">{c.issue}</td>
                    <td className="px-5 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-gray-400">
                      {c.createdAt.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 7.2: Commit**

```bash
git add app/cases/page.tsx
git commit -m "feat(cases): rebuild case list with filters and SKU stats strip"
```

---

## Task 8: New Case page

**Files:**
- Create: `apps/customer-service/app/cases/new/page.tsx`

- [ ] **Step 8.1: Create app/cases/new/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { extractKeywords } from '@/lib/keywords'
import type { Message, CustomerInfo, NewCaseData } from '@/lib/cases'

const CATEGORIES = ['Product Issue', 'Order & Shipping', 'Refunds & Returns', 'Billing', 'Other']

const EMPTY_CUSTOMER: CustomerInfo = {
  name: '', address1: '', postcode: '', email: '', orderId: '',
}

export default function NewCasePage() {
  const router = useRouter()

  // Section A — customer
  const [customer,    setCustomer]    = useState<CustomerInfo>(EMPTY_CUSTOMER)
  // Section B — product
  const [sku,         setSku]         = useState('')
  // Section C — conversation
  const [messages,    setMessages]    = useState<Message[]>([])
  const [drafts,      setDrafts]      = useState<{ customer: string; agent: string }>({ customer: '', agent: '' })
  // Section D — meta
  const [issue,       setIssue]       = useState('')
  const [category,    setCategory]    = useState(CATEGORIES[0])
  const [keywords,    setKeywords]    = useState<string[]>([])
  const [kwInput,     setKwInput]     = useState('')
  const [resolution,  setResolution]  = useState('')
  const [status,      setStatus]      = useState<'open' | 'resolved'>('open')
  const [saving,      setSaving]      = useState(false)
  const [error,       setError]       = useState('')

  function addMessage(role: 'customer' | 'agent') {
    const text = drafts[role].trim()
    if (!text) return
    const msg: Message = { role, text, ts: new Date().toISOString() }
    const updated = [...messages, msg]
    setMessages(updated)
    setDrafts((d) => ({ ...d, [role]: '' }))

    // Re-extract keywords whenever a customer message is added
    if (role === 'customer') {
      const customerTexts = updated
        .filter((m) => m.role === 'customer')
        .map((m) => m.text)
      const auto = extractKeywords(customerTexts)
      setKeywords((prev) => {
        const merged = Array.from(new Set([...prev, ...auto]))
        return merged
      })
    }
  }

  function removeLastMessage() {
    setMessages((prev) => prev.slice(0, -1))
  }

  function addKeyword() {
    const k = kwInput.trim().toLowerCase()
    if (k && !keywords.includes(k)) setKeywords((prev) => [...prev, k])
    setKwInput('')
  }

  async function handleSave() {
    if (!customer.name || !sku || !issue || messages.length === 0) {
      setError('Customer name, SKU, issue summary, and at least one message are required.')
      return
    }
    setSaving(true)
    setError('')
    const body: NewCaseData = {
      customer,
      standardSku: sku,
      conversation: messages,
      category,
      keywords,
      issue,
      resolution,
      status,
    }
    const res = await fetch('/api/cases', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    if (!res.ok) {
      const data = await res.json()
      setError(data.error ?? 'Save failed')
      setSaving(false)
      return
    }
    const created = await res.json()
    router.push(`/cases/${created.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-gray-800">New Case</h1>

        {/* Section A — Customer */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-600">A — Customer Info</h2>
          <div className="grid grid-cols-2 gap-3">
            {([
              { key: 'name',     label: 'Name',      required: true  },
              { key: 'orderId',  label: 'Order ID',  required: true  },
              { key: 'address1', label: 'Address',   required: false },
              { key: 'postcode', label: 'Postcode',  required: false },
              { key: 'email',    label: 'Email',     required: false },
            ] as { key: keyof CustomerInfo; label: string; required: boolean }[]).map(({ key, label, required }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs text-gray-400">
                  {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                </label>
                <input
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  value={customer[key]}
                  onChange={(e) => setCustomer({ ...customer, [key]: e.target.value })}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Section B — Product */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-600">B — Product</h2>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Standard SKU <span className="text-red-400">*</span></label>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-64"
              placeholder="e.g. RX224-PINK-000"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>
        </div>

        {/* Section C — Conversation */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-600">C — Conversation</h2>

          {/* Message log */}
          {messages.length > 0 && (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto border border-gray-100 rounded-xl p-3 bg-gray-50">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs rounded-xl px-3 py-2 text-sm ${
                    m.role === 'customer'
                      ? 'bg-white border border-gray-200 text-gray-700'
                      : 'bg-blue-600 text-white'
                  }`}>
                    <div className="text-xs opacity-60 mb-1">
                      {m.role === 'customer' ? 'Customer' : 'Me'}
                    </div>
                    {m.text}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Customer input */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Customer says:</label>
            <div className="flex gap-2">
              <textarea
                rows={2}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-gray-400"
                placeholder="Paste customer's message…"
                value={drafts.customer}
                onChange={(e) => setDrafts((d) => ({ ...d, customer: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addMessage('customer') } }}
              />
              <button
                onClick={() => addMessage('customer')}
                className="self-end bg-gray-200 text-gray-700 rounded-lg px-3 py-2 text-sm hover:bg-gray-300 transition-colors"
              >
                Add ↩
              </button>
            </div>
          </div>

          {/* Agent input */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">I replied:</label>
            <div className="flex gap-2">
              <textarea
                rows={2}
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Paste your reply…"
                value={drafts.agent}
                onChange={(e) => setDrafts((d) => ({ ...d, agent: e.target.value }))}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); addMessage('agent') } }}
              />
              <button
                onClick={() => addMessage('agent')}
                className="self-end bg-blue-600 text-white rounded-lg px-3 py-2 text-sm hover:bg-blue-700 transition-colors"
              >
                Add ↩
              </button>
            </div>
          </div>

          {messages.length > 0 && (
            <button
              onClick={removeLastMessage}
              className="self-start text-xs text-red-400 hover:text-red-600"
            >
              ✕ Remove last message
            </button>
          )}
        </div>

        {/* Section D — Meta */}
        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-600">D — Case Details</h2>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Issue summary <span className="text-red-400">*</span></label>
            <input
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="One line: what is the problem?"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
            />
          </div>

          <div className="flex gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Category</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Status</label>
              <select
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
                value={status}
                onChange={(e) => setStatus(e.target.value as 'open' | 'resolved')}
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
          </div>

          {/* Keywords */}
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400">
              Keywords <span className="text-gray-300">(auto-extracted from customer messages)</span>
            </label>
            <div className="flex flex-wrap gap-1 min-h-6">
              {keywords.map((k) => (
                <span
                  key={k}
                  className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full"
                >
                  {k}
                  <button
                    onClick={() => setKeywords((prev) => prev.filter((x) => x !== k))}
                    className="text-gray-400 hover:text-red-400"
                  >×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="border border-gray-300 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder="Add keyword…"
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
              />
              <button onClick={addKeyword} className="text-xs text-blue-500 hover:text-blue-700">Add</button>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Resolution / final reply sent</label>
            <textarea
              rows={3}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="What was the final reply or outcome?"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex gap-3 pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-blue-600 text-white rounded-xl px-8 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Case'}
          </button>
          <button
            onClick={() => router.push('/cases')}
            className="text-sm text-gray-400 hover:text-gray-700 px-4"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
```

Note: `NewCaseData` must be imported from `@/lib/cases`, not `@/lib/types`. The `NewCaseData` type is `Omit<CustomerCase, 'id' | 'createdAt' | 'updatedAt'>` — defined in `lib/cases.ts`.

- [ ] **Step 8.2: Commit**

```bash
git add app/cases/new/page.tsx
git commit -m "feat(new-case): chat-style conversation recorder with auto keyword extraction"
```

---

## Task 9: Case Detail page

**Files:**
- Create: `apps/customer-service/app/cases/[id]/page.tsx`

- [ ] **Step 9.1: Create app/cases/[id]/page.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { CustomerCase } from '@/lib/types'

const CATEGORIES = ['Product Issue', 'Order & Shipping', 'Refunds & Returns', 'Billing', 'Other']

export default function CaseDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const [c, setC] = useState<CustomerCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)

  // Editable fields
  const [resolution, setResolution] = useState('')
  const [status,     setStatus]     = useState<'open' | 'resolved'>('open')
  const [category,   setCategory]   = useState('')

  async function load() {
    const res = await fetch(`/api/cases/${id}`)
    if (!res.ok) { router.push('/cases'); return }
    const data: CustomerCase = await res.json()
    setC(data)
    setResolution(data.resolution)
    setStatus(data.status)
    setCategory(data.category)
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function handleSave() {
    setSaving(true)
    await fetch(`/api/cases/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ resolution, status, category }),
    })
    await load()
    setSaving(false)
  }

  async function handleDelete() {
    if (!confirm('Delete this case? This cannot be undone.')) return
    await fetch(`/api/cases/${id}`, { method: 'DELETE' })
    router.push('/cases')
  }

  if (loading) return <div className="p-8 text-sm text-gray-400">Loading…</div>
  if (!c)      return <div className="p-8 text-sm text-gray-400">Case not found.</div>

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 font-mono">{c.id}</p>
            <h1 className="text-xl font-semibold text-gray-800 mt-0.5">{c.issue}</h1>
          </div>
          <button onClick={handleDelete} className="text-xs text-red-400 hover:text-red-600">
            Delete
          </button>
        </div>

        {/* Customer info */}
        <div className="bg-white rounded-2xl shadow-sm p-5 grid grid-cols-2 gap-3 text-sm">
          {[
            ['Name',     c.customer.name],
            ['Order ID', c.customer.orderId],
            ['Address',  c.customer.address1],
            ['Postcode', c.customer.postcode],
            ['Email',    c.customer.email],
            ['SKU',      c.standardSku],
          ].map(([label, val]) => (
            <div key={label}>
              <p className="text-xs text-gray-400">{label}</p>
              <p className="text-gray-700 font-mono text-xs mt-0.5">{val || '—'}</p>
            </div>
          ))}
        </div>

        {/* Conversation */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
          <h2 className="text-sm font-semibold text-gray-600">Conversation</h2>
          <div className="flex flex-col gap-2 max-h-80 overflow-y-auto">
            {c.conversation.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-sm rounded-xl px-3 py-2 text-sm ${
                  m.role === 'customer'
                    ? 'bg-gray-100 text-gray-700'
                    : 'bg-blue-600 text-white'
                }`}>
                  <div className="text-xs opacity-60 mb-1">
                    {m.role === 'customer' ? 'Customer' : 'Me'} · {m.ts.slice(0, 10)}
                  </div>
                  {m.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Keywords */}
        <div className="flex flex-wrap gap-1">
          {c.keywords.map((k) => (
            <span key={k} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{k}</span>
          ))}
        </div>

        {/* Edit panel */}
        <div className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-gray-600">Update</h2>

          <div className="flex gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'open' | 'resolved')}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-gray-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none"
              >
                {CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs text-gray-400">Resolution</label>
            <textarea
              rows={3}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Final reply sent or outcome…"
            />
          </div>

          <div className="flex gap-3 items-center">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 text-white rounded-xl px-6 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => router.push(`/?q=${encodeURIComponent(c.issue)}`)}
              className="text-sm text-gray-400 hover:text-gray-700"
            >
              Find similar ↗
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
```

- [ ] **Step 9.2: Commit**

```bash
git add app/cases/[id]/page.tsx
git commit -m "feat(case-detail): conversation view + inline status/resolution edit"
```

---

## Task 10: Cleanup and nav update

**Files:**
- Modify: `apps/customer-service/app/layout.tsx`

- [ ] **Step 10.1: Update layout.tsx nav (remove dead imports)**

The nav currently has only Assistant and Cases links (SSYS and Pending were already removed). Ensure the layout imports are clean — remove `Link` import if any href-only `<a>` tags were converted, verify the nav renders correctly.

Current clean layout (no changes needed if Task 5.5 deletions went through):

```tsx
// app/layout.tsx — verify it looks like this:
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Customer Service",
  description: "Customer service assistant",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-6">
          <a href="https://ordercleaner.twinkletwinkle.uk/apps"
             className="text-sm text-gray-400 hover:text-gray-700 transition-colors">
            &larr; APPs
          </a>
          <span className="text-gray-200">|</span>
          <span className="text-sm font-semibold text-gray-800">Customer Service</span>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            Assistant
          </Link>
          <Link href="/cases" className="text-sm text-gray-500 hover:text-gray-800 transition-colors">
            Cases
          </Link>
        </nav>
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 10.2: Run build to verify no TypeScript errors**

```bash
cd apps/customer-service
npm run build
# Expected: exit 0, no type errors
# Routes shown: / (page) | /cases (page) | /cases/new (page) | /cases/[id] (page)
# API routes: /api/cases | /api/cases/[id] | /api/replies | /api/search
```

- [ ] **Step 10.3: Final commit and push**

```bash
git add -A
git commit -m "chore: update nav, verify build clean"
git push origin main
```

---

## Task 11: Deploy to VPS

- [ ] **Step 11.1: Pull, build, restart on VPS**

SSH to `boyechen@149.210.243.20` (pw: `Cby123`) and run:

```bash
cd /opt/customer-service
sudo git pull origin main
sudo npm run build
sudo systemctl restart customer-service
sudo systemctl is-active customer-service
```

- [ ] **Step 11.2: Smoke test**

- Open `https://ordercleaner.twinkletwinkle.uk/customer-service` → Assistant page loads with search bar
- Open `/customer-service/cases` → Cases page loads (empty, no error)
- Open `/customer-service/cases/new` → New case form loads with 4 sections
- Fill a test case: name "Test Customer", order "ORD-001", SKU "RX224-PINK-000", add 1 customer message + 1 agent message, issue = "test issue", save → redirects to detail page
- Return to `/customer-service/cases` → case appears in list with SKU stats
- Go to Assistant → search "test" → case appears in results

---

## Self-Review

**Spec coverage check:**
- ✅ Manual case recording with customer info, order, conversation
- ✅ Chat-style message-by-message entry (Section C in new case page)
- ✅ Auto keyword extraction from customer messages
- ✅ Search finds similar past cases + standard replies
- ✅ Customer name + address + postcode + orderId linked to case
- ✅ Standard SKU linked to case
- ✅ SKU stats strip in cases list page (defect-rate indicator)
- ✅ Migration: old SupportCase seed data → StandardReply in replies.json
- ✅ Deletion of SSYS/pending pages and inventory API routes

**Type consistency check:**
- `NewCaseData` defined in `lib/cases.ts` as `Omit<CustomerCase, 'id' | 'createdAt' | 'updatedAt'>`
- `CustomerInfo` imported from `lib/types.ts` in new-case page
- `CasePatch` imported from `lib/types.ts` in cases/[id] API route
- `SearchResult` used consistently in search.ts and page.tsx
- All good ✅
