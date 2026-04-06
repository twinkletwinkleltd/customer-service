'use client'

import { useState, useEffect } from 'react'
import { saveHistory, getHistory } from '@/lib/history'
import type { SupportCase } from '@/lib/store'

interface ReplyResponse {
  suggestedReply: string
  matchedCases: SupportCase[]
}

const getInventory = async (sku: string) => {
  const res = await fetch(`/api/inventory?sku=${sku}`)
  return res.json()
}

export default function Home() {
  const [sku, setSku] = useState("")
  const [debouncedSku, setDebouncedSku] = useState("")
  const [inventoryResult, setInventoryResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<any[]>([])

  useEffect(() => {
    setHistory(getHistory())
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSku(sku)
    }, 400)
    return () => clearTimeout(timer)
  }, [sku])

  useEffect(() => {
    if (!debouncedSku) return

    const run = async () => {
      setLoading(true)
      const data = await getInventory(debouncedSku)
      setInventoryResult(data)
      saveHistory(debouncedSku, data)
      setHistory(getHistory())
      setLoading(false)
    }

    run()
  }, [debouncedSku])

  const [question, setQuestion] = useState('')
  const [result, setResult] = useState<ReplyResponse | null>(null)
  const [replyLoading, setReplyLoading] = useState(false)

  async function handleGenerateReply() {
    if (!question.trim()) return
    setReplyLoading(true)
    setResult(null)
    const res = await fetch('/api/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question }),
    })
    const data: ReplyResponse = await res.json()
    setResult(data)
    setReplyLoading(false)
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-md w-full max-w-2xl p-8 flex flex-col gap-6">

        {/* Inventory Lookup */}
        <div>
          <h2>Inventory Lookup</h2>

          <input
            value={sku}
            onChange={(e) => setSku(e.target.value.trim())}
            placeholder="Enter SKU"
          />

          {loading && <p>Checking...</p>}

          {inventoryResult && inventoryResult.sku && (
            <div>
              <p>SKU: {inventoryResult.sku}</p>
              <p>Stock: {inventoryResult.stock}</p>
              <p>
                Status:{" "}
                <span style={{ color: inventoryResult.stock > 0 ? "green" : "red" }}>
                  {inventoryResult.status}
                </span>
              </p>
            </div>
          )}

          <input
            type="file"
            accept=".xlsx"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (!file) return

              const formData = new FormData()
              formData.append("file", file)

              const res = await fetch("/api/inventory/upload", {
                method: "POST",
                body: formData,
              })

              const data = await res.json()

              if (data.success) {
                alert(`Inventory rebuilt: ${data.count} SKU(s). ${data.message}`)
              } else {
                alert(`Rebuild failed: ${data.message}`)
              }

              if (sku) {
                const verify = await getInventory(sku)
                setInventoryResult(verify)
              }
            }}
          />

          <button
            onClick={() => {
              window.open("/api/inventory/export")
            }}
          >
            Export CSV
          </button>

          <div>
            <h3>Recent Searches</h3>
            {history.map((item, i) => (
              <div key={i}>
                <span>{item.sku}</span> -{" "}
                <span>{item.result?.stock}</span>
              </div>
            ))}
          </div>
        </div>

        <hr className="border-gray-200" />

        {/* Customer Support Assistant */}
        <h1 className="text-2xl font-semibold text-gray-800">Customer Support Assistant</h1>

        {/* Input */}
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-600" htmlFor="question">
            Customer Question
          </label>
          <textarea
            id="question"
            className="border border-gray-300 rounded-lg p-3 text-sm text-gray-700 resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
            rows={4}
            placeholder="Paste the customer's question here..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        <button
          onClick={handleGenerateReply}
          disabled={replyLoading || !question.trim()}
          className="bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {replyLoading ? 'Generating...' : 'Generate Reply'}
        </button>

        {result && (
          <>
            {/* Suggested Reply */}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium text-gray-600">Suggested Reply</label>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-gray-700 leading-relaxed">
                {result.suggestedReply}
              </div>
            </div>

            {/* Matched Cases */}
            {result.matchedCases.length > 0 && (
              <div className="flex flex-col gap-3">
                <label className="text-sm font-medium text-gray-600">
                  Matched Historical Cases ({result.matchedCases.length})
                </label>
                <div className="flex flex-col gap-3">
                  {result.matchedCases.map((c) => (
                    <div
                      key={c.id}
                      className="border border-gray-200 rounded-lg p-4 flex flex-col gap-2 bg-gray-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-blue-600 uppercase tracking-wide">
                          {c.category}
                        </span>
                        <span className="text-xs text-gray-400">{c.id}</span>
                      </div>
                      <p className="text-sm text-gray-700 font-medium">{c.customerQuestion}</p>
                      <p className="text-sm text-gray-500 leading-relaxed">{c.standardReply}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
