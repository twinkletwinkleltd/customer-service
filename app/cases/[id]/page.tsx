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
