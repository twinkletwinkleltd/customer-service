// app/api/cases/[id]/route.ts
import { getCaseById, patchCase, deleteCase } from '@/lib/cases'
import type { CasePatch } from '@/lib/types'

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const c = await getCaseById(id)
    if (!c) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(c)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function PATCH(request: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const patch = await request.json() as CasePatch
    const updated = await patchCase(id, patch)
    if (!updated) return Response.json({ error: 'Not found' }, { status: 404 })
    return Response.json(updated)
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const deleted = await deleteCase(id)
    if (!deleted) return Response.json({ error: 'Not found' }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
