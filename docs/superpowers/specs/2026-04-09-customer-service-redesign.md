# Customer Service Redesign — Spec

Date: 2026-04-09

## Goal

Rebuild `apps/customer-service` from a static Q&A template library into a real customer case management system with:
1. Manual case recording (real customer conversations, order + customer identity)
2. Smart search / similar-case suggestion when handling new queries
3. Customer + SKU linkage enabling product defect-rate inference

---

## Data Model

### CustomerCase (`data/cases.json`)

Real customer interactions. Every entry has a full conversation transcript.

```typescript
interface Message {
  role: 'customer' | 'agent'
  text: string
  ts: string          // ISO 8601
}

interface CustomerCase {
  id: string          // "case-001", "case-002" …

  customer: {
    name: string
    address1: string
    postcode: string
    email: string     // optional, default ""
    orderId: string
  }

  standardSku: string   // product SKU (e.g. "RX224-PINK-000")

  conversation: Message[]   // ordered, alternating customer / agent

  category: string          // "Product Issue" | "Order & Shipping" | "Refunds & Returns" | "Billing" | "Other"
  keywords: string[]        // auto-extracted from customer messages + manual edits
  issue: string             // one-line summary written by agent
  resolution: string        // final reply or outcome
  status: 'open' | 'resolved'

  createdAt: string
  updatedAt: string
}
```

### StandardReply (`data/replies.json`)

Template answers — migrated from the current `cases.json` seed data. Used as the second source for the Assistant search.

```typescript
interface StandardReply {
  id: string
  category: string
  keywords: string[]
  question: string    // example customer question
  reply: string       // standard reply text
}
```

---

## Pages

### 1. Assistant (`/`) — redesigned

**Purpose:** When handling a live customer query, quickly find similar past cases or standard replies.

- Search bar (full width, prominent)
- On input: search both `cases.json` (resolved) and `replies.json` by keyword match
- Results split into two sections:
  - **Past Cases** — shows: customer name masked, SKU, issue summary, resolution
  - **Standard Replies** — shows: category, question template, reply
- Click any result to expand and copy the reply text
- No AI API required — pure keyword scoring (existing `findTopCases` logic, extended)

### 2. Cases (`/cases`) — rebuilt

**Purpose:** Browse, filter, and manage all recorded customer cases.

- Filter bar: by `category` | `status` | `standardSku` | free-text search
- Table columns: ID · Customer name · Order ID · SKU · Issue summary · Status · Date
- Click row → go to `/cases/[id]`
- "New Case" button → go to `/cases/new`
- SKU stats strip at bottom: most-reported SKUs and their case counts (defect-rate indicator)

### 3. New Case (`/cases/new`) — new page

**Purpose:** Record a new customer interaction while it's happening or immediately after.

Four sections in order:

**Section A — Customer Info**
- Name, Address Line 1, Postcode, Email (optional), Order ID

**Section B — Product**
- Standard SKU (free text input)

**Section C — Conversation**
- Chat-style message log
- Two buttons: `+ Customer says` / `+ I replied`
- Each click appends a new text area in the correct role
- Messages display alternately: customer (left-aligned, grey) / agent (right-aligned, blue)
- No editing after adding (to preserve record integrity) — only delete last message

**Section D — Case Meta**
- Issue (one-line summary, required)
- Category (dropdown: Product Issue / Order & Shipping / Refunds & Returns / Billing / Other)
- Keywords (auto-filled from customer messages after any text is entered; editable chip list)
- Resolution (textarea — final reply sent or outcome)
- Status toggle: Open / Resolved

Save button → POST `/api/cases` → redirect to `/cases/[id]`

### 4. Case Detail (`/cases/[id]`) — new page

**Purpose:** Read a recorded case in full. Edit status/resolution. See the full conversation.

- Customer info block
- SKU + category + keywords chips
- Conversation transcript (chat bubble style)
- Issue + Resolution fields (editable inline)
- Status toggle (Open ↔ Resolved)
- "Find similar" button → opens Assistant pre-filled with the issue text
- Delete button (with confirmation)

---

## Keyword Auto-Extraction

Runs client-side, no API. Triggered whenever any customer message text changes.

Algorithm:
1. Collect all `role: 'customer'` message texts, lowercase
2. Tokenise: split on whitespace + punctuation
3. Remove stopwords: `['i','my','the','a','an','is','it','was','were','have','has','been','this','that','to','in','of','and','or','but','for','not','with','on','at','are','do','did','we','you','your','me','us','our','its','be','can','will']`
4. Keep tokens with length ≥ 3
5. Deduplicate, sort by frequency descending, take top 8
6. Merge with any existing manual keywords (user can add/remove chips)

---

## Migration

The 10 seed `SupportCase` records in `persistence.ts` are converted to `StandardReply` format and written to `data/replies.json`. The `cases.json` file starts empty (no fake customer data). Migration runs once at startup if `replies.json` doesn't exist.

---

## API Routes

| Method | Path | Action |
|--------|------|--------|
| GET | `/api/cases` | list all cases (optional `?status=` `?sku=` `?q=`) |
| POST | `/api/cases` | create new case |
| GET | `/api/cases/[id]` | get single case |
| PATCH | `/api/cases/[id]` | update status / resolution / keywords |
| DELETE | `/api/cases/[id]` | delete case |
| GET | `/api/replies` | list standard replies |
| POST | `/api/search` | search cases + replies by query string → scored results |

---

## File Map

| File | Action |
|------|--------|
| `lib/types.ts` | New — CustomerCase, Message, StandardReply types |
| `lib/cases.ts` | Rewrite — CRUD for CustomerCase |
| `lib/replies.ts` | New — CRUD + migration for StandardReply |
| `lib/keywords.ts` | New — extractKeywords() |
| `lib/search.ts` | New — unified search across cases + replies |
| `lib/persistence.ts` | Rewrite — two files: cases.json + replies.json |
| `app/page.tsx` | Rewrite — Assistant search UI |
| `app/cases/page.tsx` | Rewrite — case list + SKU stats |
| `app/cases/new/page.tsx` | New — case creation form |
| `app/cases/[id]/page.tsx` | New — case detail + edit |
| `app/api/cases/route.ts` | Rewrite |
| `app/api/cases/[id]/route.ts` | Rewrite |
| `app/api/replies/route.ts` | New |
| `app/api/search/route.ts` | New |
| `app/api/cases/import/route.ts` | Delete (no longer needed) |
| `app/layout.tsx` | Minor — nav stays: Assistant + Cases |

---

## Navigation

```
← APPs  |  Customer Service  |  Assistant  |  Cases
```

---

## Success Criteria

- Can record a full customer case (info + conversation + resolution) in under 2 minutes
- Searching a customer question returns relevant past cases and standard replies
- Cases page shows cases grouped/filterable by SKU so defect clustering is visible
- No external API calls required for any of the above
