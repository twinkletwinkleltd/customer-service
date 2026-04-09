'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import type { CustomerCase } from '@/lib/types'

export default function SidebarClient() {
  const pathname = usePathname()
  const [cases, setCases] = useState<CustomerCase[]>([])

  useEffect(() => {
    fetch('/api/cases')
      .then((r) => r.json())
      .then(setCases)
      .catch(() => {})
  }, [])

  const openCount = cases.filter((c) => c.status === 'open').length

  // Weekly stats
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 7)
  const weekCases    = cases.filter((c) => new Date(c.createdAt) >= cutoff)
  const weekResolved = weekCases.filter((c) => c.status === 'resolved').length

  // Top SKU
  const skuCounts: Record<string, number> = {}
  for (const c of cases) skuCounts[c.standardSku] = (skuCounts[c.standardSku] ?? 0) + 1
  const topSku = Object.entries(skuCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null

  function navCls(href: string) {
    const active = href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(href + '/')
    return active
      ? 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-blue-600 bg-blue-50 transition-colors'
      : 'flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-50 hover:text-slate-800 transition-colors'
  }

  return (
    <aside className="w-52 bg-white border-r border-slate-200 flex flex-col shrink-0 h-screen sticky top-0">

      {/* Brand */}
      <div className="px-4 py-5 border-b border-slate-100">
        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Customer Service</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-2 flex flex-col gap-1 overflow-y-auto">

        <Link href="/" className={navCls('/')}>
          <span className="text-base">🔍</span>
          <span>Assistant</span>
        </Link>

        <Link href="/cases" className={`${navCls('/cases')} justify-between`}>
          <span className="flex items-center gap-2">
            <span className="text-base">📋</span>
            <span>Cases</span>
          </span>
          {openCount > 0 && (
            <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">
              {openCount}
            </span>
          )}
        </Link>

        <Link
          href="/cases/new"
          className="mt-1.5 flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg px-3 py-2 text-sm font-semibold transition-colors shadow-sm"
        >
          <span className="text-base font-light">＋</span>
          <span>New Case</span>
        </Link>

        <div className="flex-1 min-h-4" />

        {/* Mini stats */}
        {cases.length > 0 && (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-1">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">本周</p>
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs text-slate-500">新案例</span>
              <span className="text-sm font-bold text-slate-800">{weekCases.length}</span>
            </div>
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-slate-500">已结案</span>
              <span className="text-sm font-bold text-green-600">{weekResolved}</span>
            </div>
            {topSku && (
              <div className="border-t border-slate-200 pt-2 flex justify-between items-center">
                <span className="text-xs text-slate-500">Top SKU</span>
                <span className="text-xs font-bold text-orange-500 truncate max-w-[90px]">{topSku}</span>
              </div>
            )}
          </div>
        )}

        {/* Back */}
        <div className="border-t border-slate-100 pt-1">
          <a
            href="https://ordercleaner.twinkletwinkle.uk/apps"
            className="flex items-center gap-1 px-3 py-2 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            ← Back to APPs
          </a>
        </div>

      </nav>
    </aside>
  )
}
