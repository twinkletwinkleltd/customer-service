'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { appPath } from '@/lib/api-path'
import { fetchInboxThread } from '@/lib/inbox-api'
import type {
  InboxMessage,
  InboxThread,
  ThreadChannel,
  ThreadStatus,
} from '@/lib/inbox-types'
import {
  CHANNEL_BADGE_CLASS,
  CHANNEL_LABEL,
  formatReason,
} from '@/lib/category-labels'

const STATUS_COLORS: Record<ThreadStatus, string> = {
  open:     'bg-amber-50 text-amber-700 border-amber-200',
  resolved: 'bg-green-50 text-green-700 border-green-200',
}

function fmtTime(iso: string): string {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return iso
  const d = new Date(t)
  return d.toISOString().slice(0, 16).replace('T', ' ')
}

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ok'; thread: InboxThread }
  | { phase: 'error'; error: string; message: string }

interface PageProps {
  params: Promise<{ thread_id: string }>
}

export default function ThreadPage({ params }: PageProps) {
  const { thread_id } = use(params)
  const [state, setState] = useState<LoadState>({ phase: 'loading' })

  useEffect(() => {
    let alive = true
    fetchInboxThread(thread_id).then((r) => {
      if (!alive) return
      if (r.ok) {
        setState({ phase: 'ok', thread: r.thread })
      } else {
        setState({ phase: 'error', error: r.error, message: r.message })
      }
    })
    return () => { alive = false }
  }, [thread_id])

  if (state.phase === 'loading') {
    return <Shell><div className="text-sm text-slate-400">Loading…</div></Shell>
  }
  if (state.phase === 'error') {
    return (
      <Shell>
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <span className="font-semibold">
            {state.error === 'not_found'
              ? 'Conversation not found.'
              : 'Could not load conversation.'}
          </span>{' '}
          <span className="text-xs">{state.message}</span>
        </div>
      </Shell>
    )
  }

  const thread = state.thread
  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-5">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link
          href={appPath('/inbox')}
          className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          ← Back to Inbox
        </Link>
        <div className="flex items-center gap-2">
          <ChannelBadge
            channel={thread.channel}
            reasons={thread.categoryReasons}
          />
          <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${STATUS_COLORS[thread.status]}`}>
            {thread.status}
          </span>
        </div>
      </div>

      {/* Subject + customer */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">
          {thread.subject || '(no subject)'}
        </h1>
        <div className="mt-1 text-sm text-slate-500">
          <span className="font-medium text-slate-700">
            {thread.customerName || '(no name)'}
          </span>
          <span className="text-slate-400 ml-2">{thread.customerEmail}</span>
        </div>
      </div>

      {/* Context card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Order</div>
          <div className="mt-1 font-mono text-slate-700">
            {thread.orderId ?? <span className="text-slate-300">—</span>}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Tags</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {thread.tags.length === 0 ? (
              <span className="text-slate-300">—</span>
            ) : thread.tags.map((tag) => (
              <span
                key={tag}
                className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">Source</div>
          <div className="mt-1 text-slate-700">
            {thread.source ?? 'gmail'} · twinkletwinkleltd@gmail.com
          </div>
        </div>
      </div>

      {/* Classifier explanation — always-visible expansion of the
          channel badge tooltip (Q3 explainability). */}
      <ClassificationCard
        channel={thread.channel}
        reasons={thread.categoryReasons}
      />

      {/* Messages */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-6 flex flex-col gap-5">
        {thread.messages.length === 0 ? (
          <div className="text-sm text-slate-400 text-center">
            No messages on this thread yet.
          </div>
        ) : thread.messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
      </div>

      {/* Read-only footer */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-sm text-slate-600">
        <div className="font-semibold text-slate-700 mb-1">Phase 1 read-only</div>
        <p>
          The reply composer + &ldquo;Open in Gmail&rdquo; deep link arrive
          in a future step. For now the inbox is one-way — operator
          reads here, replies in Gmail.
        </p>
      </div>

    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="p-8 max-w-4xl mx-auto flex flex-col gap-5">
      <Link
        href={appPath('/inbox')}
        className="text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        ← Back to Inbox
      </Link>
      {children}
    </div>
  )
}

function MessageBubble({ message }: { message: InboxMessage }) {
  const isIn = message.direction === 'in'
  return (
    <div className={`flex ${isIn ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[78%] ${isIn ? 'items-start' : 'items-end'} flex flex-col gap-1`}>
        <div className={`text-[10px] uppercase tracking-wider text-slate-400 ${isIn ? 'pl-2' : 'pr-2'}`}>
          <span className="font-semibold text-slate-500">{message.senderLabel}</span>
          <span className="ml-2">{fmtTime(message.sentAt)}</span>
        </div>
        <div
          className={`px-4 py-3 rounded-2xl text-sm whitespace-pre-wrap break-words border ${
            isIn
              ? 'bg-slate-100 text-slate-800 border-slate-200 rounded-tl-sm'
              : 'bg-blue-50 text-slate-800 border-blue-100 rounded-tr-sm'
          }`}
        >
          {message.text}
        </div>
      </div>
    </div>
  )
}

function ChannelBadge({ channel, reasons }: {
  channel: ThreadChannel
  reasons: string[]
}) {
  const cls = CHANNEL_BADGE_CLASS[channel]
  const label = CHANNEL_LABEL[channel]
  // Tooltip for quick hover; the full reasons list is shown below in
  // <ClassificationCard> for keyboard / accessibility friendliness.
  const tooltipLines = reasons.slice(0, 3).map(formatReason).filter(Boolean)
  const tooltip = tooltipLines.length > 0
    ? `Classified as ${label} because:\n• ${tooltipLines.join('\n• ')}`
    : `Classified as ${label}`
  return (
    <span
      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${cls}`}
      title={tooltip}
    >
      {label}
    </span>
  )
}

function ClassificationCard({ channel, reasons }: {
  channel: ThreadChannel
  reasons: string[]
}) {
  const visibleReasons = reasons.map(formatReason).filter(Boolean)
  const label = CHANNEL_LABEL[channel]

  return (
    <details
      className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-3 text-sm"
      open={false}
    >
      <summary className="cursor-pointer text-slate-600 hover:text-slate-800 transition-colors flex items-center gap-2 select-none">
        <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-400">
          Why {label}?
        </span>
        <span className="text-xs text-slate-400">
          {visibleReasons.length === 0
            ? '(no classifier reasons recorded)'
            : `${visibleReasons.length} signal${visibleReasons.length === 1 ? '' : 's'}`}
        </span>
      </summary>
      {visibleReasons.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 text-sm text-slate-700 list-disc pl-5">
          {visibleReasons.map((reason, idx) => (
            <li key={idx}>{reason}</li>
          ))}
        </ul>
      )}
    </details>
  )
}
