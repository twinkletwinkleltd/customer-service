'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { fetchInboxFeed, type InboxFeedItem } from '@/lib/inbox-api'
import type { ThreadChannel, ThreadStatus } from '@/lib/inbox-types'
import {
  CHANNEL_BADGE_CLASS,
  CHANNEL_LABEL,
  channelPillActiveClass,
  formatReason,
} from '@/lib/category-labels'

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

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ok'; items: InboxFeedItem[]; unreadTotal: number; total: number }
  | { phase: 'error'; error: string; message: string }

const ALL_CHANNELS: ThreadChannel[] = ['customer', 'promotional', 'spam']

export default function InboxPage() {
  const [search,      setSearch]      = useState('')
  const [statusFilt,  setStatusFilt]  = useState<'all' | ThreadStatus>('all')
  // Phase 2a.1 — default to Customer per Q2 operator decision.
  // Promotional / Spam are separate pills, not hidden by default.
  const [channelFilt, setChannelFilt] = useState<'all' | ThreadChannel>('customer')
  const [state,       setState]       = useState<LoadState>({ phase: 'loading' })
  const [refreshTok,  setRefreshTok]  = useState(0)

  useEffect(() => {
    let alive = true
    // Flask default limit is 50 (max 200). At 2026-06 the operator
    // has ~66 threads in DB, so the default truncates 16 threads + makes
    // client-side channel counts misleading. Bump to the Flask cap.
    // When DB grows >200 we'll need real pagination — for now this works.
    fetchInboxFeed({ status: statusFilt, limit: 200 }).then((r) => {
      if (!alive) return
      if (r.ok) {
        setState({ phase: 'ok', items: r.items, unreadTotal: r.unreadTotal, total: r.total })
      } else {
        setState({ phase: 'error', error: r.error, message: r.message })
      }
    })
    return () => { alive = false }
  }, [statusFilt, refreshTok])

  const allItems = useMemo(
    () => (state.phase === 'ok' ? state.items : []),
    [state],
  )

  // Per-channel counts derived from the loaded items — no extra API
  // round-trip, no server-side aggregation. With our scale (200-500
  // emails/month) this is negligible.
  const channelCounts: Record<ThreadChannel, number> = useMemo(() => {
    const counts: Record<ThreadChannel, number> = {
      customer: 0, promotional: 0, spam: 0,
    }
    for (const t of allItems) counts[t.channel] = (counts[t.channel] ?? 0) + 1
    return counts
  }, [allItems])

  const filtered = allItems.filter((t) => {
    if (channelFilt !== 'all' && t.channel !== channelFilt) return false
    const q = search.toLowerCase()
    return !q ||
      t.customerName.toLowerCase().includes(q) ||
      t.customerEmail.toLowerCase().includes(q) ||
      t.subject.toLowerCase().includes(q) ||
      t.lastInboundPreview.toLowerCase().includes(q) ||
      (t.orderId ?? '').toLowerCase().includes(q)
  })

  return (
    <div className="p-8 max-w-6xl mx-auto flex flex-col gap-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800">Inbox</h1>
          {state.phase === 'ok' && state.unreadTotal > 0 && (
            <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2.5 py-1 rounded-full">
              {state.unreadTotal} unread
            </span>
          )}
        </div>
        <div className="text-xs text-slate-400 flex items-center gap-2">
          <span>Source: twinkletwinkleltd@gmail.com</span>
          <button
            onClick={() => setRefreshTok((n) => n + 1)}
            className="ml-1 inline-block bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-semibold transition-colors"
            disabled={state.phase === 'loading'}
            title="Reload from portal-web"
          >
            ↻ Refresh
          </button>
        </div>
      </div>

      {/* OAuth / error banner */}
      {state.phase === 'error' && (
        <ErrorBanner error={state.error} message={state.message} />
      )}

      {/* Filter bar — status + channel + search */}
      <div className="flex flex-col gap-3">

        {/* Search + status pills + total */}
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
                {s === 'all' ? 'All status' : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>

          <span className="text-sm text-slate-400 ml-auto">
            {state.phase === 'ok' && `${filtered.length} of ${state.total} threads`}
          </span>
        </div>

        {/* Channel pills (Phase 2a.1) */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mr-1">
            Category
          </span>
          {ALL_CHANNELS.map((c) => (
            <ChannelPill
              key={c}
              channel={c}
              active={channelFilt === c}
              count={channelCounts[c]}
              onClick={() => setChannelFilt(c)}
            />
          ))}
          <ChannelPill
            key="all"
            channel={'all'}
            active={channelFilt === 'all'}
            count={allItems.length}
            onClick={() => setChannelFilt('all')}
          />
        </div>

      </div>

      {/* Body */}
      {state.phase === 'loading' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-sm text-slate-400">
          Loading…
        </div>
      ) : state.phase === 'error' ? null : filtered.length === 0 ? (
        <EmptyState
          hasAnyItems={state.items.length > 0}
          channelFilt={channelFilt}
        />
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden divide-y divide-slate-100">
          {filtered.map((t) => (
            <Link
              key={t.id}
              href={`/inbox/${t.id}`}
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
                        {t.customerName || '(no name)'}
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
                      <ChannelBadge
                        channel={t.channel}
                        reasons={t.categoryReasons}
                      />
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

function ChannelPill({ channel, active, count, onClick }: {
  channel: ThreadChannel | 'all'
  active: boolean
  count: number
  onClick: () => void
}) {
  const label = channel === 'all' ? 'All' : CHANNEL_LABEL[channel]
  const activeCls = channelPillActiveClass(channel)
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-semibold rounded-full border transition-colors ${
        active
          ? `${activeCls} border-current`
          : 'text-slate-500 bg-white border-slate-200 hover:bg-slate-50'
      }`}
    >
      {label}
      <span className={`ml-1.5 text-[10px] font-normal ${active ? 'opacity-80' : 'opacity-60'}`}>
        {count}
      </span>
    </button>
  )
}

function ChannelBadge({ channel, reasons }: {
  channel: ThreadChannel
  reasons: string[]
}) {
  const cls = CHANNEL_BADGE_CLASS[channel]
  const label = CHANNEL_LABEL[channel]
  // First reason becomes the tooltip — keeps the hover hint short.
  const tooltipLines = reasons.slice(0, 3).map(formatReason).filter(Boolean)
  const tooltip = tooltipLines.length > 0
    ? `Classified as ${label} because:\n• ${tooltipLines.join('\n• ')}`
    : `Classified as ${label}`
  return (
    <span
      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cls}`}
      title={tooltip}
    >
      {label}
    </span>
  )
}

function ErrorBanner({ error, message }: { error: string; message: string }) {
  if (error === 'gmail_not_configured') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        <span className="font-semibold">Gmail not configured yet.</span>{' '}
        Set up the OAuth client + token following{' '}
        <code className="text-xs bg-amber-100 px-1 py-0.5 rounded">
          docs/runbooks/gmail-oauth-setup.md
        </code>
        {' '}— the inbox stays empty until the first poll lands.
      </div>
    )
  }
  if (error === 'forbidden') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
        <span className="font-semibold">Access denied.</span>{' '}
        Ask an admin to grant the <code className="text-xs bg-rose-100 px-1 py-0.5 rounded">inquiries.view</code>{' '}
        capability on <code className="text-xs bg-rose-100 px-1 py-0.5 rounded">/admin/users</code>.
      </div>
    )
  }
  return (
    <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
      <span className="font-semibold">Could not load inbox.</span>{' '}
      <span className="text-xs">{error}{message ? ` — ${message}` : ''}</span>
    </div>
  )
}

function EmptyState({ hasAnyItems, channelFilt }: {
  hasAnyItems: boolean
  channelFilt: 'all' | ThreadChannel
}) {
  if (hasAnyItems) {
    const label = channelFilt === 'all' ? 'your filter' : `the ${CHANNEL_LABEL[channelFilt]} category`
    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
        <p className="text-sm text-slate-400">
          No conversations match {label}.
        </p>
      </div>
    )
  }
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center">
      <p className="text-sm font-medium text-slate-700">
        No conversations yet.
      </p>
      <p className="mt-2 text-xs text-slate-500 max-w-md mx-auto">
        Either Gmail polling is not yet configured (see{' '}
        <code className="bg-slate-100 px-1 py-0.5 rounded">
          docs/runbooks/gmail-oauth-setup.md
        </code>
        ), or the inbox owner has not received any customer mail in
        the time window we sync.
      </p>
    </div>
  )
}
