'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { SearchResult } from '@/lib/types'

export default function AssistantPage() {
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<SearchResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [searched, setSearched] = useState(false)

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true)
    const res  = await fetch('/api/search', {
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
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <input
            className="flex-1 border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white shadow-sm"
            placeholder="Paste or type the customer's message…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="bg-blue-600 text-white rounded-xl px-6 py-3 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            {loading ? 'Searching…' : 'Search'}
          </button>
        </form>

        {/* No results */}
        {searched && results.length === 0 && (
          <div className="bg-white rounded-2xl shadow-sm p-6 text-sm text-gray-400 text-center">
            No matching cases or replies found.{' '}
            <Link href="/cases/new" className="text-blue-500 hover:underline">
              Record this as a new case?
            </Link>
          </div>
        )}

        {/* Past Cases */}
        {caseResults.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Similar Past Cases ({caseResults.length})
            </h2>
            {caseResults.map((r) => {
              const c = r.case!
              return (
                <div key={c.id} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                        {c.category}
                      </span>
                      <span className="text-xs text-gray-400">{c.standardSku}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{c.customer.name}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-400">{c.customer.orderId}</span>
                    </div>
                    <Link
                      href={`/cases/${c.id}`}
                      className="text-xs text-gray-400 hover:text-gray-700 shrink-0"
                    >
                      View ↗
                    </Link>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{c.issue}</p>
                  {c.resolution && (
                    <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                      {c.resolution}
                      <button
                        onClick={() => navigator.clipboard.writeText(c.resolution)}
                        className="ml-2 text-xs text-green-600 hover:text-green-800"
                      >
                        Copy
                      </button>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-1">
                    {c.keywords.map((k) => (
                      <span key={k} className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{k}</span>
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
            <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Standard Replies ({replyResults.length})
            </h2>
            {replyResults.map((r) => {
              const reply = r.reply!
              return (
                <div key={reply.id} className="bg-white rounded-2xl shadow-sm p-5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full">
                      {reply.category}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 italic">{reply.question}</p>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm text-gray-700 leading-relaxed">
                    {reply.reply}
                    <button
                      onClick={() => navigator.clipboard.writeText(reply.reply)}
                      className="ml-2 text-xs text-blue-500 hover:text-blue-700"
                    >
                      Copy
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}
