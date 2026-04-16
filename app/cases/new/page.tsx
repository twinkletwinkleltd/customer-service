'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { extractKeywords } from '@/lib/keywords'
import {
  ACCOUNT_DISPLAY,
  ACCOUNT_VALUES,
  CREATOR_VALUES,
  type Account,
  type Creator,
  type CustomerInfo,
  type Message,
  type SearchResult,
} from '@/lib/types'
import type { NewCaseData } from '@/lib/cases'

const CATEGORIES = ['Product Issue', 'Order & Shipping', 'Refunds & Returns', 'Billing', 'Other']

const EMPTY_CUSTOMER: CustomerInfo = {
  name: '', address1: '', postcode: '', email: '', salesRecordNo: '',
}

export default function NewCasePage() {
  const router = useRouter()

  const [customer,   setCustomer]   = useState<CustomerInfo>(EMPTY_CUSTOMER)
  const [account,    setAccount]    = useState<Account | ''>('')
  const [creator,    setCreator]    = useState<Creator | ''>('')
  const [sku,        setSku]        = useState('')
  const [messages,   setMessages]   = useState<Message[]>([])
  const [drafts,     setDrafts]     = useState<{ customer: string; agent: string }>({ customer: '', agent: '' })
  const [issue,      setIssue]      = useState('')
  const [category,   setCategory]   = useState(CATEGORIES[0])
  const [keywords,   setKeywords]   = useState<string[]>([])
  const [kwInput,    setKwInput]    = useState('')
  const [resolution, setResolution] = useState('')
  const [status,     setStatus]     = useState<'open' | 'resolved'>('open')
  const [saving,     setSaving]     = useState(false)
  const [error,      setError]      = useState('')

  // Similar-case drawer state
  const [drawerOpen,    setDrawerOpen]    = useState(false)
  const [drawerLoading, setDrawerLoading] = useState(false)
  const [drawerResults, setDrawerResults] = useState<SearchResult[]>([])

  // Try to pre-fill creator from /api/me
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/me', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json() as { creator: Creator | null }
        if (!cancelled && data.creator) setCreator(data.creator)
      } catch {
        // Silent — user will pick from dropdown.
      }
    })()
    return () => { cancelled = true }
  }, [])

  function addMessage(role: 'customer' | 'agent') {
    const text = drafts[role].trim()
    if (!text) return
    const msg: Message = { role, text, ts: new Date().toISOString() }
    const updated = [...messages, msg]
    setMessages(updated)
    setDrafts((d) => ({ ...d, [role]: '' }))
    if (role === 'customer') {
      const auto = extractKeywords(updated.filter((m) => m.role === 'customer').map((m) => m.text))
      setKeywords((prev) => Array.from(new Set([...prev, ...auto])))
    }
  }

  function addKeyword() {
    const k = kwInput.trim().toLowerCase()
    if (k && !keywords.includes(k)) setKeywords((prev) => [...prev, k])
    setKwInput('')
  }

  async function findSimilar() {
    const customerText = messages
      .filter((m) => m.role === 'customer')
      .map((m) => m.text)
      .join(' ')
    const query = [issue, customerText].filter(Boolean).join(' ').trim()
    if (!query) {
      setError('Enter an issue summary or at least one customer message to find similar cases.')
      return
    }
    setDrawerOpen(true)
    setDrawerLoading(true)
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          skuHint: sku || undefined,
          accountHint: account || undefined,
        }),
      })
      const data = await res.json() as SearchResult[]
      setDrawerResults(Array.isArray(data) ? data : [])
    } catch {
      setDrawerResults([])
    } finally {
      setDrawerLoading(false)
    }
  }

  async function handleSave() {
    const missing: string[] = []
    if (!customer.name)          missing.push('Name')
    if (!customer.salesRecordNo) missing.push('Sales record no.')
    if (!account)                missing.push('Account')
    if (!creator)                missing.push('Creator')
    if (!sku)                    missing.push('SKU')
    if (!issue)                  missing.push('Issue')
    if (messages.length === 0)   missing.push('At least one conversation message')

    if (missing.length > 0) {
      setError(`Required: ${missing.join(', ')}`)
      return
    }

    setSaving(true)
    setError('')
    const body: NewCaseData = {
      customer,
      account: account as Account,
      creator: creator as Creator,
      standardSku: sku,
      conversation: messages,
      category,
      keywords,
      issue,
      resolution,
      status,
    }
    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
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
    <div className="flex h-full min-h-screen">

      {/* ── LEFT PANEL: fields ── */}
      <div className="w-[420px] shrink-0 bg-white border-r border-slate-200 flex flex-col">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-800">New Case</h1>
        </div>

        {/* Scrollable fields */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Account + Creator */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-slate-400">Account <span className="text-red-400">*</span></label>
              <select
                value={account}
                onChange={(e) => setAccount(e.target.value as Account | '')}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-slate-700 bg-white"
              >
                <option value="">— Select —</option>
                {ACCOUNT_VALUES.map((a) => (
                  <option key={a} value={a}>{ACCOUNT_DISPLAY[a]}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-slate-400">Creator <span className="text-red-400">*</span></label>
              <select
                value={creator}
                onChange={(e) => setCreator(e.target.value as Creator | '')}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-slate-700 bg-white"
              >
                <option value="">— Select —</option>
                {CREATOR_VALUES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Customer */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'name',          label: 'Name',             required: true  },
                { key: 'salesRecordNo', label: 'Sales record no.', required: true  },
                { key: 'address1',      label: 'Address',          required: false },
                { key: 'postcode',      label: 'Postcode',         required: false },
                { key: 'email',         label: 'Email',            required: false },
              ] as { key: keyof CustomerInfo; label: string; required: boolean }[]).map(({ key, label, required }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">
                    {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <input
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={(customer[key] as string | undefined) ?? ''}
                    onChange={(e) => setCustomer({ ...customer, [key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* SKU */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Standard SKU <span className="text-red-400">*</span></label>
            <input
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-56"
              placeholder="e.g. RX224-PINK-000"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </div>

          {/* Issue */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Issue summary <span className="text-red-400">*</span></label>
            <input
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="One line: what is the problem?"
              value={issue}
              onChange={(e) => setIssue(e.target.value)}
            />
          </div>

          {/* Find Similar */}
          <button
            type="button"
            onClick={findSimilar}
            className="self-start text-xs font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 rounded-lg px-3 py-1.5 transition-colors"
          >
            Find similar / 查找相似案例
          </button>

          {/* Category + Status */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-slate-400">Category</label>
              <select
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-slate-700"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-slate-400">Status</label>
              <select
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-slate-700"
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
            <label className="text-xs text-slate-400">
              Keywords <span className="text-slate-300">(auto-extracted)</span>
            </label>
            <div className="flex flex-wrap gap-1 min-h-6">
              {keywords.map((k) => (
                <span key={k} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                  {k}
                  <button onClick={() => setKeywords((prev) => prev.filter((x) => x !== k))} className="text-slate-400 hover:text-red-400">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                className="border border-slate-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 flex-1"
                placeholder="Add keyword…"
                value={kwInput}
                onChange={(e) => setKwInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeyword() } }}
              />
              <button onClick={addKeyword} className="text-xs text-blue-500 hover:text-blue-700 font-medium">Add</button>
            </div>
          </div>

          {/* Resolution */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Resolution / final reply sent</label>
            <textarea
              rows={3}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="What was the final reply or outcome?"
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
            />
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {/* Sticky save bar */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? 'Saving…' : 'Save Case'}
          </button>
          <button
            onClick={() => router.push('/cases')}
            className="border border-slate-200 text-slate-500 rounded-xl px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL: conversation ── */}
      <div className="flex-1 flex flex-col bg-slate-50">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-800">Conversation</h2>
          <span className="text-xs text-slate-400">{messages.length} messages</span>
        </div>

        {/* Chat bubbles */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {messages.length === 0 && (
            <p className="text-sm text-slate-400 text-center mt-8">No messages yet. Add the first message below.</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-sm rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                m.role === 'customer'
                  ? 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                  : 'bg-blue-600 text-white rounded-tr-sm'
              }`}>
                <div className={`text-xs mb-1 ${m.role === 'customer' ? 'text-slate-400' : 'text-blue-200'}`}>
                  {m.role === 'customer' ? 'Customer' : 'Me'}
                </div>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* Input area */}
        <div className="bg-white border-t border-slate-200 px-6 py-4 flex flex-col gap-3">
          <textarea
            rows={2}
            className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-slate-50 placeholder-slate-400"
            placeholder="Type or paste a message, then click Add below…"
            value={drafts.customer || drafts.agent}
            onChange={(e) => {
              setDrafts({ customer: e.target.value, agent: e.target.value })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                addMessage('customer')
              }
            }}
          />
          <div className="flex gap-3">
            <button
              onClick={() => addMessage('customer')}
              className="flex-1 border border-slate-200 text-slate-600 rounded-xl py-2 text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              + Customer says
            </button>
            <button
              onClick={() => addMessage('agent')}
              className="flex-1 bg-blue-600 text-white rounded-xl py-2 text-xs font-semibold hover:bg-blue-700 transition-colors"
            >
              + I replied
            </button>
          </div>
          {messages.length > 0 && (
            <button
              onClick={() => setMessages((prev) => prev.slice(0, -1))}
              className="self-start text-xs text-red-400 hover:text-red-600"
            >
              ✕ Remove last message
            </button>
          )}
        </div>
      </div>

      {/* ── Similar cases drawer ── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 flex">
          <div
            className="flex-1 bg-slate-900/30"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <aside className="w-[420px] bg-white shadow-xl border-l border-slate-200 flex flex-col">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-800">Similar cases</h3>
              <button
                onClick={() => setDrawerOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm"
              >
                ✕
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
              {drawerLoading && <p className="text-sm text-slate-400">Searching…</p>}
              {!drawerLoading && drawerResults.length === 0 && (
                <p className="text-sm text-slate-400">No similar cases or replies yet.</p>
              )}
              {!drawerLoading && drawerResults.map((r, i) => {
                if (r.type === 'case' && r.case) {
                  const c = r.case
                  return (
                    <Link
                      key={`case-${c.id}-${i}`}
                      href={`/cases/${c.id}`}
                      target="_blank"
                      className="block bg-white border border-slate-200 hover:border-blue-300 rounded-xl p-3 flex flex-col gap-1 transition-colors"
                    >
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="font-mono">{c.id}</span>
                        <span className="text-slate-300">·</span>
                        <span className="font-mono">{c.standardSku}</span>
                        <span className="text-slate-300">·</span>
                        <span>score {r.score}</span>
                      </div>
                      <p className="text-sm font-semibold text-slate-800 leading-snug">{c.issue}</p>
                      {c.resolution && (
                        <p className="text-xs text-slate-500 line-clamp-2">{c.resolution}</p>
                      )}
                    </Link>
                  )
                }
                if (r.type === 'reply' && r.reply) {
                  const reply = r.reply
                  return (
                    <div
                      key={`reply-${reply.id}-${i}`}
                      className="bg-violet-50 border border-violet-100 rounded-xl p-3 flex flex-col gap-1"
                    >
                      <div className="text-xs text-violet-500 font-semibold">
                        Standard reply · score {r.score}
                      </div>
                      <p className="text-xs text-slate-500 italic">{reply.question}</p>
                      <p className="text-sm text-slate-700 leading-snug line-clamp-3">{reply.reply}</p>
                    </div>
                  )
                }
                return null
              })}
            </div>
          </aside>
        </div>
      )}

    </div>
  )
}
