'use client'

import { useRef, useState } from 'react'
import type { SSYSImportResult } from '@/app/api/inventory/ssys/import/route'

export default function SSYSPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<SSYSImportResult | null>(null)
  const [error, setError] = useState('')

  async function handleImport() {
    const file = fileInputRef.current?.files?.[0]
    if (!file) return
    setImporting(true)
    setResult(null)
    setError('')

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/inventory/ssys/import', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setError(data.message ?? 'Import failed')
    } else {
      setResult(data as SSYSImportResult)
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
    setImporting(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-8">
        <h1 className="text-2xl font-semibold text-gray-800">SSYS</h1>

        <div className="bg-white rounded-2xl shadow-md p-6 flex flex-col gap-4">
          <h2 className="text-base font-semibold text-gray-700">Import Source File</h2>
          <p className="text-xs text-gray-400">
            Accepts <code className="bg-gray-100 px-1 rounded">.csv</code> — eBay Orders export
            format. Imported records feed into the shared inventory view.
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

          {error && <p className="text-sm text-red-500">{error}</p>}

          {result && (
            <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-4 flex flex-col gap-3">
              <span
                className={`self-start text-xs font-semibold px-2 py-0.5 rounded-full ${
                  result.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}
              >
                {result.success ? 'Success' : 'Failed'}
              </span>

              <p className="text-sm text-gray-700">{result.message}</p>

              <div className="flex flex-wrap gap-6 text-sm">
                <span className="text-green-600">
                  Imported: <strong>{result.imported_records}</strong>
                </span>
                <span className="text-yellow-600">
                  Skipped: <strong>{result.skipped_records}</strong>
                </span>
                <span className="text-yellow-600">
                  Pending added: <strong>{result.pending_added}</strong>
                </span>
              </div>

              <div className="flex flex-wrap gap-6 text-sm text-gray-500">
                <span>
                  Inventory rebuilt:{' '}
                  <strong className={result.inventory_rebuilt ? 'text-green-600' : 'text-red-500'}>
                    {result.inventory_rebuilt ? 'Yes' : 'No'}
                  </strong>
                </span>
                <span>
                  SKUs in inventory: <strong className="text-gray-800">{result.inventory_sku_count}</strong>
                </span>
              </div>

              {result.processed_file && (
                <p className="text-xs text-gray-400 font-mono break-all">{result.processed_file}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
