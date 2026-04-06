import { findTopCases } from '@/lib/store'

export async function POST(request: Request) {
  try {
    const { question } = await request.json()
    const result = await findTopCases(question as string)
    return Response.json(result)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
