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
