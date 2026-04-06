'use client'

import { useEffect, useState } from 'react'
import type { PendingEntry } from '@/app/api/pending/route'

interface RowState {
  entry: PendingEntry
  standardSku: string
  confirming: boolean
  confirmed: boolean
  error: string
}

const SOURCE_COLOURS: Record<string, string> = {
  gorblefashion: 'bg-amber-100 text-amber-800',
  ssys:          'bg-blue-100 text-blue-800',
  amazon:        'bg-orange-100 text-orange-800',
}

function sourceTag(source: string) {
  const cls = SOURCE_COLOURS[source] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {source}
    </span>
  )
}

export default function PendingPage() {
  const [rows, setRows]       = useState<RowState[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res  = await fetch('/api/pending')
      const data = await res.json()
      setRows(
        (data as PendingEntry[]).map((entry) => ({
          entry,
          standardSku: '',
          confirming:  false,
          confirmed:   false,
          error:       '',
        }))
      )
    } catch (e: any) {
      setError('Failed to load pending SKUs')
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function updateRow(idx: number, patch: Partial<RowState>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)))
  }

  async function handleConfirm(idx: number) {
    const row = rows[idx]
    if (!row.standardSku.trim()) return

    updateRow(idx, { confirming: true, error: '' })

    const res = await fetch('/api/pending/confirm', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        original_sku: row.entry.original_sku,
        source:       row.entry.source,
        standard_sku: row.standardSku.trim(),
      }),
    })
    const data = await res.json()

    if (data.success) {
      updateRow(idx, { confirming: false, confirmed: true })
    } else {
      updateRow(idx, { confirming: false, error: data.message ?? 'Confirm failed' })
    }
  }

  const unresolved = rows.filter((r) => !r.confirmed)
  const resolved   = rows.filter((r) => r.confirmed)

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto flex flex-col gap-6">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-gray-800">Pending SKU Mappings</h1>
            <p className="text-sm text-gray-400 mt-1">
              Assign a standard SKU to each unmapped entry. Future imports will
              standardize automatically.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors disabled:opacity-40"
          >
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        {/* Stats strip */}
        {!loading && (
          <div className="flex gap-6 text-sm text-gray-500">
            <span>Total: <strong className="text-gray-800">{rows.length}</strong></span>
            <span className="text-yellow-600">
              Unresolved: <strong>{unresolved.length}</strong>
            </span>
            <span className="text-green-600">
              Confirmed this session: <strong>{resolved.length}</strong>
            </span>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : unresolved.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-md p-6 text-sm text-gray-400">
            No unresolved pending SKUs.
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-xs text-gray-400 uppercase tracking-wide">
                  <th className="px-5 py-3 text-left font-medium">Original SKU</th>
                  <th className="px-5 py-3 text-left font-medium">Source</th>
                  <th className="px-5 py-3 text-left font-medium">Count</th>
                  <th className="px-5 py-3 text-left font-medium">Last seen</th>
                  <th className="px-5 py-3 text-left font-medium">Standard SKU</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {unresolved.map((row, i) => {
                  const idx = rows.indexOf(row)
                  return (
                    <tr key={`${row.entry.original_sku}|${row.entry.source}`}
                        className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3 font-mono text-xs text-gray-700 max-w-xs break-all">
                        {row.entry.original_sku}
                      </td>
                      <td className="px-5 py-3">{sourceTag(row.entry.source)}</td>
                      <td className="px-5 py-3 text-gray-500">{row.entry.count}</td>
                      <td className="px-5 py-3 text-gray-400 text-xs">
                        {row.entry.last_seen ? row.entry.last_seen.slice(0, 10) : '—'}
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="text"
                          value={row.standardSku}
                          onChange={(e) => updateRow(idx, { standardSku: e.target.value })}
                          onKeyDown={(e) => { if (e.key === 'Enter') handleConfirm(idx) }}
                          placeholder="e.g. L207"
                          className="border border-gray-300 rounded-lg px-2 py-1 text-xs w-32 focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        {row.error && (
                          <p className="text-xs text-red-500 mt-1">{row.error}</p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => handleConfirm(idx)}
                          disabled={row.confirming || !row.standardSku.trim()}
                          className="bg-blue-600 text-white rounded-lg px-3 py-1 text-xs font-medium hover:bg-blue-700 disabled:opacity-40 transition-colors"
                        >
                          {row.confirming ? '…' : 'Confirm'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Confirmed this session */}
        {resolved.length > 0 && (
          <div className="bg-white rounded-2xl shadow-md overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 text-xs font-medium text-gray-400 uppercase tracking-wide">
              Confirmed this session
            </div>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-50">
                {resolved.map((row) => (
                  <tr key={`done|${row.entry.original_sku}|${row.entry.source}`}
                      className="opacity-60">
                    <td className="px-5 py-2 font-mono text-xs text-gray-500 max-w-xs break-all">
                      {row.entry.original_sku}
                    </td>
                    <td className="px-5 py-2">{sourceTag(row.entry.source)}</td>
                    <td className="px-5 py-2 text-xs font-mono text-gray-500">
                      → {row.standardSku}
                    </td>
                    <td className="px-5 py-2">
                      <span className="text-xs text-green-600 font-medium">✓ mapped</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Rebuild note */}
        <p className="text-xs text-gray-400">
          After confirming mappings, re-run the relevant module import to produce
          processed records for newly mapped SKUs, then rebuild the shared inventory view.
        </p>

      </div>
    </div>
  )
}
