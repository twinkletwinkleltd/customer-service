import { deleteCase } from '@/lib/store'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  try {
    const deleted = await deleteCase(id)
    if (!deleted) {
      return Response.json({ error: 'Case not found' }, { status: 404 })
    }
    return new Response(null, { status: 204 })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
