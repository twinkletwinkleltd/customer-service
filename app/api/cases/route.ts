// app/api/cases/route.ts
import { getAllCases, createCase } from '@/lib/cases'
import type { NewCaseData } from '@/lib/cases'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const sku    = searchParams.get('sku')
    const q      = searchParams.get('q')?.toLowerCase()

    let cases = await getAllCases()

    if (status) cases = cases.filter((c) => c.status === status)
    if (sku)    cases = cases.filter((c) => c.standardSku === sku)
    if (q)      cases = cases.filter((c) =>
      c.issue.toLowerCase().includes(q) ||
      c.customer.name.toLowerCase().includes(q) ||
      c.customer.orderId.toLowerCase().includes(q) ||
      c.keywords.some((k) => k.includes(q))
    )

    return Response.json(cases)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as NewCaseData
    if (!body.customer?.name || !body.standardSku || !body.issue) {
      return Response.json({ error: 'customer.name, standardSku and issue are required' }, { status: 400 })
    }
    const newCase = await createCase(body)
    return Response.json(newCase, { status: 201 })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
