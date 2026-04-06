import { getAllCases, addCase } from '@/lib/store'

export async function GET() {
  try {
    const cases = await getAllCases()
    return Response.json(cases)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const { category, customerQuestion, standardReply, keywords } = body

  if (!category || !customerQuestion || !standardReply || !Array.isArray(keywords)) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    const newCase = await addCase({ category, customerQuestion, standardReply, keywords })
    return Response.json(newCase, { status: 201 })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
