'use client'

import { useState } from 'react'
import Link from 'next/link'
import { apiPath } from '@/lib/api-path'
import type { SearchResult } from '@/lib/types'

export default function AssistantPage() {
  const [query,    setQuery]    = useState('')
  const [results,  setResults]  = useState<SearchResult[]>([])
  const [loading,  setLoading]  = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    const res  = await fetch(apiPath('/search'), {
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
    <div className="p-8 max-w-3xl mx-auto flex flex-col gap-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Assistant</h1>
        <p className="text-sm text-slate-400 mt-1">搜索客户问题，匹配相似案例与标准回复</p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSearch} className="flex gap-3">
        <input
          className="flex-1 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm placeholder-slate-400"
          placeholder="Paste or type the customer's message…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="bg-blue-600 text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-blue-700 disabled:opacity-40 transition-colors shadow-sm"
        >
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      {/* No results */}
      {searched && results.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-sm text-slate-400 text-center">
          No matching cases or replies found.{' '}
          <Link href="/cases/new" className="text-blue-500 hover:underline">
            Record this as a new case?
          </Link>
        </div>
      )}

      {/* Past Cases */}
      {caseResults.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Similar Past Cases ({caseResults.length})
          </h2>
          {caseResults.map((r) => {
            const c = r.case!
            return (
              <div key={c.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                      {c.category}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">{c.standardSku}</span>
                    <span className="text-slate-200">·</span>
                    <span className="text-xs text-slate-400">{c.customer.name}</span>
                    <span className="text-slate-200">·</span>
                    <span className="text-xs text-slate-400">{c.customer.salesRecordNo || c.customer.orderId || ''}</span>
                  </div>
                  <Link href={`/cases/${c.id}`} className="text-xs text-slate-400 hover:text-slate-700 shrink-0">
                    View ↗
                  </Link>
                </div>
                <p className="text-sm font-semibold text-slate-800">{c.issue}</p>
                {c.resolution && (
                  <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex flex-col gap-2">
                    <p className="text-sm text-slate-700 leading-relaxed">{c.resolution}</p>
                    <div className="flex justify-end">
                      <button
                        onClick={() => navigator.clipboard.writeText(c.resolution)}
                        className="text-xs font-semibold text-green-700 bg-white border border-green-200 rounded-lg px-3 py-1 hover:bg-green-50 transition-colors"
                      >
                        📋 Copy
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap gap-1">
                  {c.keywords.map((k) => (
                    <span key={k} className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{k}</span>
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
          <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
            Standard Replies ({replyResults.length})
          </h2>
          {replyResults.map((r) => {
            const reply = r.reply!
            return (
              <div key={reply.id} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3">
                <span className="text-xs font-semibold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-full self-start">
                  {reply.category}
                </span>
                <p className="text-xs text-slate-400 italic">{reply.question}</p>
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex flex-col gap-2">
                  <p className="text-sm text-slate-700 leading-relaxed">{reply.reply}</p>
                  <div className="flex justify-end">
                    <button
                      onClick={() => navigator.clipboard.writeText(reply.reply)}
                      className="text-xs font-semibold text-blue-600 bg-white border border-blue-200 rounded-lg px-3 py-1 hover:bg-blue-50 transition-colors"
                    >
                      📋 Copy
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
