'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import type { CustomerCase } from '@/lib/types'

const CATEGORIES = ['Product Issue', 'Order & Shipping', 'Refunds & Returns', 'Billing', 'Other']

const STATUS_COLORS = {
  open:     'bg-amber-50 text-amber-700 border border-amber-200',
  resolved: 'bg-green-50 text-green-700 border border-green-200',
}

export default function CaseDetailPage() {
  const { id }    = useParams<{ id: string }>()
  const router    = useRouter()
  const [c, setC] = useState<CustomerCase | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [saved,   setSaved]   = useState(false)

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
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleDelete() {
    if (!confirm('Delete this case? This cannot be undone.')) return
    await fetch(`/api/cases/${id}`, { method: 'DELETE' })
    router.push('/cases')
  }

  if (loading) return <div className="p-8 text-sm text-slate-400">Loading…</div>
  if (!c)      return <div className="p-8 text-sm text-slate-400">Case not found.</div>

  return (
    <div className="flex h-full min-h-screen">

      {/* ── LEFT PANEL: info + edit ── */}
      <div className="w-[420px] shrink-0 bg-white border-r border-slate-200 flex flex-col">

        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono text-slate-400 mb-1">{c.id}</p>
              <h1 className="text-base font-bold text-slate-800 leading-snug">{c.issue}</h1>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full shrink-0 mt-1 ${STATUS_COLORS[status]}`}>
              {status}
            </span>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-5">

          {/* Customer info grid */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Customer</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              {([
                ['Name',     c.customer.name],
                ['Order ID', c.customer.orderId],
                ['Address',  c.customer.address1],
                ['Postcode', c.customer.postcode],
                ['Email',    c.customer.email],
                ['SKU',      c.standardSku],
              ] as [string, string][]).map(([label, val]) => (
                <div key={label}>
                  <p className="text-xs text-slate-400">{label}</p>
                  <p className="text-sm text-slate-700 font-medium mt-0.5 truncate">{val || '—'}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Keywords */}
          {c.keywords.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Keywords</p>
              <div className="flex flex-wrap gap-1">
                {c.keywords.map((k) => (
                  <span key={k} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">{k}</span>
                ))}
              </div>
            </div>
          )}

          {/* Status + Category */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-slate-400">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'open' | 'resolved')}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-slate-700"
              >
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
              </select>
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <label className="text-xs text-slate-400">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none text-slate-700"
              >
                {CATEGORIES.map((cat) => <option key={cat}>{cat}</option>)}
              </select>
            </div>
          </div>

          {/* Resolution */}
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-400">Resolution / final reply sent</label>
            <textarea
              rows={4}
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
              placeholder="Final reply sent or outcome…"
            />
          </div>

        </div>

        {/* Sticky action bar */}
        <div className="px-6 py-4 border-t border-slate-100 flex gap-3 items-center">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-blue-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Changes'}
          </button>
          <button
            onClick={() => router.push(`/?q=${encodeURIComponent(c.issue)}`)}
            className="border border-slate-200 text-slate-500 rounded-xl px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors"
            title="Find similar cases"
          >
            Find Similar
          </button>
          <button
            onClick={handleDelete}
            className="text-red-400 hover:text-red-600 text-sm px-2 py-2.5 transition-colors"
            title="Delete case"
          >
            ✕
          </button>
        </div>
      </div>

      {/* ── RIGHT PANEL: conversation ── */}
      <div className="flex-1 flex flex-col bg-slate-50">

        {/* Header */}
        <div className="bg-white border-b border-slate-200 px-6 py-5 flex items-center gap-3">
          <h2 className="text-sm font-bold text-slate-800">Conversation</h2>
          <span className="text-xs text-slate-400">{c.conversation.length} messages</span>
          <span className="text-xs text-slate-300 ml-auto">{c.createdAt.slice(0, 10)}</span>
        </div>

        {/* Chat bubbles */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-3">
          {c.conversation.length === 0 && (
            <p className="text-sm text-slate-400 text-center mt-8">No messages recorded.</p>
          )}
          {c.conversation.map((m, i) => (
            <div key={i} className={`flex ${m.role === 'agent' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-sm rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                m.role === 'customer'
                  ? 'bg-white border border-slate-200 text-slate-700 rounded-tl-sm'
                  : 'bg-blue-600 text-white rounded-tr-sm'
              }`}>
                <div className={`text-xs mb-1 ${m.role === 'customer' ? 'text-slate-400' : 'text-blue-200'}`}>
                  {m.role === 'customer' ? 'Customer' : 'Me'} · {m.ts.slice(0, 10)}
                </div>
                {m.text}
              </div>
            </div>
          ))}
        </div>

        {/* Resolution preview (if set) */}
        {resolution && (
          <div className="bg-white border-t border-slate-200 px-6 py-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Resolution</p>
            <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex flex-col gap-2">
              <p className="text-sm text-slate-700 leading-relaxed">{resolution}</p>
              <div className="flex justify-end">
                <button
                  onClick={() => navigator.clipboard.writeText(resolution)}
                  className="text-xs font-semibold text-green-700 bg-white border border-green-200 rounded-lg px-3 py-1 hover:bg-green-50 transition-colors"
                >
                  📋 Copy
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
