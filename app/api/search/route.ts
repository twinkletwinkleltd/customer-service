// app/api/search/route.ts
import { search } from '@/lib/search'

export async function POST(request: Request) {
  try {
    const { query } = await request.json() as { query: string }
    if (!query?.trim()) return Response.json([])
    const results = await search(query)
    return Response.json(results)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
