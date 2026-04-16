// app/api/search/route.ts
import { search } from '@/lib/search'

export async function POST(request: Request) {
  try {
    const body = await request.json() as {
      query: string
      skuHint?: string
      accountHint?: string
    }
    if (!body.query?.trim()) return Response.json([])
    const results = await search(body.query, 5, {
      skuHint:     body.skuHint?.trim() || undefined,
      accountHint: body.accountHint?.trim() || undefined,
    })
    return Response.json(results)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
