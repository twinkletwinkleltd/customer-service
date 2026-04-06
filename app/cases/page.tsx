'use client'

import { useEffect, useRef, useState } from 'react'
import type { SupportCase } from '@/lib/store'
import type { ImportResult } from '@/app/api/cases/import/route'

const EMPTY_FORM = {
  category: '',
  customerQuestion: '',
  standardReply: '',
  keywords: '',
}

export default function CasesPage() {
  const [cases, setCases] = useState<SupportCase[]>([])
  const [form, setForm] = useState(EMPTY_FORM)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // CSV import state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<ImportResult | null>(null)
  const [importError, setImportError] = useState('')

  async function loadCases() {
    const res = await fetch('/api/cases')
    const data = await res.json()
    setCases(data)
  }

  useEffect(() => {
    loadCases()
  }, [])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setSubmitting(true)

    const keywords = form.keywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)

    const res = await fetch('/api/cases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, keywords }),
    })

    if (!res.ok) {
      setError('Failed to create case. Please fill in all fields.')
      setSubmitting(false)
      return
    }

    setForm(EMPTY_FORM)
    setSubmitting(false)
    loadCases()
  }

  async function handleDelete(id: string) {
    await fetch(`/api/cases/${id}`, { method: 'DELETE' })
    loadCases()
  }

  async function handleImport() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setImporting(true)
    setImportResult(null)
    setImportError('')

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/cases/import', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setImportError(data.error ?? 'Import failed')
    } else {
      setImportResult(data as ImportResult)
      loadCases()
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
    setImporting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">
        <h1 className="text-2xl font-semibold text-gray-800">Case Library</h1>

        {/* Create Form */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4">Add New Case</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Category</label>
                <input
                  type="text"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="e.g. Billing"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Keywords (comma-separated)</label>
                <input
                  type="text"
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="e.g. invoice, receipt, bill"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
                />
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Customer Question</label>
              <textarea
                rows={2}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="Typical customer question for this case..."
                value={form.customerQuestion}
                onChange={(e) => setForm({ ...form, customerQuestion: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Standard Reply</label>
              <textarea
                rows={3}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                placeholder="The standard reply for this case..."
                value={form.standardReply}
                onChange={(e) => setForm({ ...form, standardReply: e.target.value })}
              />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="bg-blue-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? 'Adding...' : 'Add Case'}
              </button>
            </div>
          </form>
        </div>

        {/* CSV Import */}
        <div className="bg-white rounded-2xl shadow-md p-6">
          <h2 className="text-base font-semibold text-gray-700 mb-1">Import from CSV</h2>
          <p className="text-xs text-gray-400 mb-4">
            Required columns: <code className="bg-gray-100 px-1 rounded">category</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">customerQuestion</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">standardReply</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">keywords</code>{' '}
            (keywords are comma-separated within the field)
          </p>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
            />
            <button
              onClick={handleImport}
              disabled={importing}
              className="bg-green-600 text-white rounded-lg px-5 py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 transition-colors shrink-0"
            >
              {importing ? 'Importing...' : 'Import'}
            </button>
          </div>

          {importError && (
            <p className="mt-3 text-sm text-red-500">{importError}</p>
          )}

          {importResult && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col gap-2">
              <div className="flex gap-6 text-sm">
                <span className="text-gray-500">Total rows: <strong className="text-gray-800">{importResult.total}</strong></span>
                <span className="text-green-600">Imported: <strong>{importResult.imported}</strong></span>
                <span className="text-yellow-600">Skipped: <strong>{importResult.skipped}</strong></span>
              </div>
              {importResult.errors.length > 0 && (
                <ul className="mt-1 flex flex-col gap-1">
                  {importResult.errors.map((e, i) => (
                    <li key={i} className="text-xs text-red-500">{e}</li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Cases Table */}
        <div className="bg-white rounded-2xl shadow-md overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-700">All Cases</h2>
            <span className="text-sm text-gray-400">{cases.length} cases</span>
          </div>
          {cases.length === 0 ? (
            <p className="text-sm text-gray-400 p-6">No cases yet.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {cases.map((c) => (
                <div key={c.id} className="p-5 flex flex-col gap-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                        {c.category}
                      </span>
                      <span className="text-xs text-gray-400">{c.id}</span>
                    </div>
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs text-red-400 hover:text-red-600 transition-colors shrink-0"
                    >
                      Delete
                    </button>
                  </div>
                  <p className="text-sm font-medium text-gray-800">{c.customerQuestion}</p>
                  <p className="text-sm text-gray-500 leading-relaxed">{c.standardReply}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {c.keywords.map((kw) => (
                      <span
                        key={kw}
                        className="bg-gray-100 text-gray-500 text-xs px-2 py-0.5 rounded-full"
                      >
                        {kw}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
