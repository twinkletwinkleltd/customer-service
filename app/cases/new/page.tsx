'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { extractKeywords } from '@/lib/keywords'
import type { Message, CustomerInfo } from '@/lib/types'
import type { NewCaseData } from '@/lib/cases'

const CATEGORIES = ['Product Issue', 'Order & Shipping', 'Refunds & Returns', 'Billing', 'Other']

const EMPTY_CUSTOMER: CustomerInfo = {
  name: '', address1: '', postcode: '', email: '', orderId: '',
}

export default function NewCasePage() {
  const router = useRouter()

  const [customer,   setCustomer]   = useState<CustomerInfo>(EMPTY_CUSTOMER)
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

  async function handleSave() {
    if (!customer.name || !sku || !issue || messages.length === 0) {
      setError('Customer name, SKU, issue summary, and at least one message are required.')
      return
    }
    setSaving(true)
    setError('')
    const body: NewCaseData = { customer, standardSku: sku, conversation: messages, category, keywords, issue, resolution, status }
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

          {/* Customer */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer</p>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: 'name',     label: 'Name',     required: true  },
                { key: 'orderId',  label: 'Order ID', required: true  },
                { key: 'address1', label: 'Address',  required: false },
                { key: 'postcode', label: 'Postcode', required: false },
                { key: 'email',    label: 'Email',    required: false },
              ] as { key: keyof CustomerInfo; label: string; required: boolean }[]).map(({ key, label, required }) => (
                <div key={key} className="flex flex-col gap-1">
                  <label className="text-xs text-slate-400">
                    {label}{required && <span className="text-red-400 ml-0.5">*</span>}
                  </label>
                  <input
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    value={customer[key]}
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
              // shared textarea — value is used by whichever button is clicked
              setDrafts({ customer: e.target.value, agent: e.target.value })
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                // default to customer on plain Enter
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

    </div>
  )
}
