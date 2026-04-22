// app/api/cases/[id]/route.ts
import { getCaseById, patchCase, deleteCase } from '@/lib/cases'
import type { CasePatch } from '@/lib/types'
import { verifyPortalPassword } from '@/lib/portalPassword'
import { logAuditEvent } from '@/lib/auditLog'

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

export async function DELETE(request: Request, { params }: Ctx) {
  const { id } = await params

  const username = (request.headers.get('x-portal-user') || '').trim()
  if (!username) {
    return Response.json({ error: 'Login required' }, { status: 401 })
  }

  let password = ''
  try {
    const body = await request.json().catch(() => null) as { password?: string } | null
    password = (body?.password || '').toString()
  } catch {
    password = ''
  }
  if (!password) {
    return Response.json({ error: 'Password required' }, { status: 400 })
  }

  // Validate the password BEFORE checking case existence so a 404 doesn't
  // leak info to an attacker without credentials.
  const ok = await verifyPortalPassword(username, password)
  if (!ok) {
    await logAuditEvent({ event: 'case_delete_denied', username, case_id: id })
    return Response.json({ error: 'Incorrect password' }, { status: 403 })
  }

  try {
    const deleted = await deleteCase(id)
    if (!deleted) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }
    await logAuditEvent({ event: 'case_deleted', username, case_id: id })
    return new Response(null, { status: 204 })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
