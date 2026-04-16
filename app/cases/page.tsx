'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { CustomerCase } from '@/lib/types'
import { ACCOUNT_DISPLAY } from '@/lib/types'

const STATUS_COLORS = {
  open:     'bg-amber-50 text-amber-700',
  resolved: 'bg-green-50 text-green-700',
}

const ACCOUNT_COLORS: Record<string, string> = {
  gorble:   'bg-purple-50 text-purple-700',
  ssys:     'bg-blue-50 text-blue-700',
  ama_tktk: 'bg-orange-50 text-orange-700',
}

const CATEGORIES = ['All', 'Product Issue', 'Order & Shipping', 'Refunds & Returns', 'Billing', 'Other']

function salesNo(c: CustomerCase): string {
  return c.customer.salesRecordNo || c.customer.orderId || ''
}

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
      salesNo(c).toLowerCase().includes(q) ||
      c.standardSku.toLowerCase().includes(q) ||
      c.issue.toLowerCase().includes(q) ||
      (c.account ?? '').toLowerCase().includes(q) ||
      (c.creator ?? '').toLowerCase().includes(q)
  })

  const skuCounts: Record<string, number> = {}
  for (const c of cases) skuCounts[c.standardSku] = (skuCounts[c.standardSku] ?? 0) + 1
  const topSkus = Object.entries(skuCounts).sort((a, b) => b[1] - a[1]).slice(0, 5)

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">Cases</h1>
        <Link href="/cases/new">
          <button className="bg-blue-600 text-white rounded-xl px-5 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm">
            + New Case
          </button>
        </Link>
      </div>

      {/* SKU stats strip */}
      {topSkus.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 flex flex-wrap gap-2 items-center">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Top SKUs</span>
          {topSkus.map(([sku, count]) => (
            <button
              key={sku}
              onClick={() => setSearch(sku)}
              className="text-xs bg-orange-50 text-orange-600 border border-orange-100 px-3 py-1 rounded-full hover:bg-orange-100 transition-colors font-medium"
            >
              {sku} <span className="font-bold">{count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-72 placeholder-slate-400"
          placeholder="Search name / sales record / SKU / issue / account…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Status pills */}
        <div className="flex bg-white border border-slate-200 rounded-lg overflow-hidden text-sm">
          {(['all', 'open', 'resolved'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilt(s)}
              className={`px-4 py-2 text-xs font-semibold border-r last:border-r-0 border-slate-200 transition-colors ${
                statusFilt === s
                  ? s === 'open'
                    ? 'bg-amber-50 text-amber-700'
                    : s === 'resolved'
                      ? 'bg-green-50 text-green-700'
                      : 'bg-blue-50 text-blue-700'
                  : 'text-slate-500 hover:bg-slate-50'
              }`}
            >
              {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>

        <select
          value={catFilt}
          onChange={(e) => setCatFilt(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600 focus:outline-none bg-white"
        >
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>

        <span className="text-sm text-slate-400 ml-auto">{filtered.length} cases</span>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-400">
          No cases found.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-400 uppercase tracking-wider">
                <th className="px-5 py-3 text-left font-semibold">ID</th>
                <th className="px-5 py-3 text-left font-semibold">Account</th>
                <th className="px-5 py-3 text-left font-semibold">Creator</th>
                <th className="px-5 py-3 text-left font-semibold">Customer</th>
                <th className="px-5 py-3 text-left font-semibold">Sales record no.</th>
                <th className="px-5 py-3 text-left font-semibold">SKU</th>
                <th className="px-5 py-3 text-left font-semibold">Issue</th>
                <th className="px-5 py-3 text-left font-semibold">Status</th>
                <th className="px-5 py-3 text-left font-semibold">Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                  onClick={() => window.location.href = `/cases/${c.id}`}
                >
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-400">{c.id}</td>
                  <td className="px-5 py-3.5">
                    {c.account ? (
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${ACCOUNT_COLORS[c.account] ?? 'bg-slate-100 text-slate-600'}`}>
                        {ACCOUNT_DISPLAY[c.account]}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-500 font-mono">{c.creator ?? '—'}</td>
                  <td className="px-5 py-3.5 text-slate-700 font-medium">{c.customer.name}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-500">{salesNo(c) || '—'}</td>
                  <td className="px-5 py-3.5 font-mono text-xs text-slate-600">{c.standardSku}</td>
                  <td className="px-5 py-3.5 text-slate-600 max-w-xs truncate">{c.issue}</td>
                  <td className="px-5 py-3.5">
                    <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STATUS_COLORS[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-xs text-slate-400">{c.createdAt.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  )
}
