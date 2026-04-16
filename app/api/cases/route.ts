// app/api/cases/route.ts
import { getAllCases, createCase, getSalesRecordNo } from '@/lib/cases'
import type { NewCaseData } from '@/lib/cases'
import { isAccount, isCreator } from '@/lib/types'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status  = searchParams.get('status')
    const sku     = searchParams.get('sku')
    const account = searchParams.get('account')
    const q       = searchParams.get('q')?.toLowerCase()

    let cases = await getAllCases()

    if (status)  cases = cases.filter((c) => c.status === status)
    if (sku)     cases = cases.filter((c) => c.standardSku === sku)
    if (account) cases = cases.filter((c) => c.account === account)
    if (q) {
      cases = cases.filter((c) =>
        c.issue.toLowerCase().includes(q) ||
        c.customer.name.toLowerCase().includes(q) ||
        getSalesRecordNo(c).toLowerCase().includes(q) ||
        c.standardSku.toLowerCase().includes(q) ||
        c.keywords.some((k) => k.toLowerCase().includes(q))
      )
    }

    return Response.json(cases)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json() as Partial<NewCaseData>

    // Required fields — explicit checks so we can give a useful 400.
    const missing: string[] = []
    if (!body.customer?.name)          missing.push('customer.name')
    if (!body.customer?.salesRecordNo) missing.push('customer.salesRecordNo')
    if (!body.account)                 missing.push('account')
    else if (!isAccount(body.account)) return Response.json({ error: `invalid account "${body.account}"` }, { status: 400 })
    if (!body.creator)                 missing.push('creator')
    else if (!isCreator(body.creator)) return Response.json({ error: `invalid creator "${body.creator}"` }, { status: 400 })
    if (!body.standardSku)             missing.push('standardSku')
    if (!body.issue)                   missing.push('issue')
    if (!body.conversation || body.conversation.length === 0) missing.push('conversation')

    if (missing.length > 0) {
      return Response.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 },
      )
    }

    // At this point TS still sees Partial — assert to NewCaseData.
    const newCase = await createCase(body as NewCaseData)
    return Response.json(newCase, { status: 201 })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
