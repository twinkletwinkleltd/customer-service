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
