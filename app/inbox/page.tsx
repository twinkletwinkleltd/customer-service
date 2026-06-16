'use client'

import { useState } from 'react'
import Link from 'next/link'
import { appPath } from '@/lib/api-path'
import { MOCK_THREADS } from '@/lib/mock-inbox'
import type { ThreadStatus } from '@/lib/inbox-types'

const STATUS_COLORS: Record<ThreadStatus, string> = {
  open:     'bg-amber-50 text-amber-700',
  resolved: 'bg-green-50 text-green-700',
}

function timeAgo(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return ''
  const sec = Math.max(0, Math.floor((Date.now() - t) / 1000))
  if (sec < 60)        return `${sec}s ago`
  if (sec < 3600)      return `${Math.floor(sec / 60)}m ago`
  if (sec < 86400)     return `${Math.floor(sec / 3600)}h ago`
  if (sec < 604800)    return `${Math.floor(sec / 86400)}d ago`
  return new Date(t).toISOString().slice(0, 10)
}

export default function InboxPage() {
  const [search,     setSearch]     = useState('')
  const [statusFilt, setStatusFilt] = useState<'all' | ThreadStatus>('all')

  const threads = [...MOCK_THREADS]
    .sort((a, b) => b.lastInboundAt.localeCompare(a.lastInboundAt))

  const filtered = threads.filter((t) => {
    if (statusFilt !== 'all' && t.status !== statusFilt) return false
    const q = search.toLowerCase()
    return !q ||
      t.customerName.toLowerCase().includes(q) ||
      t.customerEmail.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.lastInboundPreview.toLowerCase().includes(q) ||
      (t.orderId ?? '').toLowerCase().includes(q)
  })

  const unreadCount = threads.filter((t) => t.unread).length

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Inbox</h1>
          {unreadCount > 0 && (
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {unreadCount} unread
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400">
          Source: twinkletwinkleltd@gmail.com
          <span className="ml-2 inline-block bg-amber-50 text-amber-700 px-2 py-0.5 rounded font-semibold">
            MOCK DATA
          </span>
        </div>
      </div>

      {/* Phase 1 banner */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span className="font-semibold">Phase 1 scaffold:</span> the conversations
        below are hard-coded mock data so you can review the UI. Step 2 will
        replace this with live Gmail messages.
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white w-72 placeholder-slate-400"
          placeholder="Search name / email / subject / order…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

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

        <span className="text-sm text-slate-400 ml-auto">
          {filtered.length} of {threads.length} threads
        </span>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-400">
          No conversations match your filter.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={appPath(`/inbox/${t.id}`)}
              className="block px-5 py-4 hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start gap-3">
                <div className="pt-1.5">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      t.unread ? 'bg-rose-500' : 'bg-transparent'
                    }`}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`text-sm font-semibold truncate ${t.unread ? 'text-slate-900' : 'text-slate-700'}`}>
                        {t.customerName}
                      </span>
                      <span className="text-xs text-slate-400 truncate">
                        {t.customerEmail}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.orderId && (
                        <span className="text-xs font-mono text-slate-400">
                          {t.orderId}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[t.status]}`}>
                        {t.status}
                      </span>
                      <span className="text-xs text-slate-400 w-16 text-right">
                        {timeAgo(t.lastInboundAt)}
                      </span>
                    </div>
                  </div>
                  <div className={`mt-1 text-sm truncate ${t.unread ? 'text-slate-800 font-medium' : 'text-slate-600'}`}>
                    {t.subject}
                  </div>
                  <div className="mt-1 text-xs text-slate-400 truncate">
                    {t.lastInboundPreview}
                  </div>
                  {t.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {t.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

    </div>
  )
}
