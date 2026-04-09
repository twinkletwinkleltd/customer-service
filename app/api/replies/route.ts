// app/api/replies/route.ts
import { getAllReplies } from '@/lib/replies'

export async function GET() {
  try {
    const replies = await getAllReplies()
    return Response.json(replies)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
