// app/api/cases/[id]/attachments/[attId]/route.ts
import fs from 'fs/promises'
import { getAttachment, removeAttachment } from '@/lib/cases'

type Ctx = { params: Promise<{ id: string; attId: string }> }

export async function GET(_req: Request, { params }: Ctx) {
  const { id, attId } = await params
  try {
    const found = await getAttachment(id, attId)
    if (!found) return Response.json({ error: 'Attachment not found' }, { status: 404 })

    const data = await fs.readFile(found.diskPath)
    // Copy into a fresh ArrayBuffer so the Response body gets a plain ArrayBuffer,
    // not a SharedArrayBuffer or Node Buffer slice.
    const body = new ArrayBuffer(data.byteLength)
    new Uint8Array(body).set(data)
    return new Response(body, {
      status: 200,
      headers: {
        'Content-Type': found.att.mime,
        'Content-Length': String(found.att.size),
        'Cache-Control': 'private, max-age=0, must-revalidate',
        'Content-Disposition': `inline; filename="${encodeURIComponent(found.att.originalName)}"`,
      },
    })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const { id, attId } = await params
  try {
    const ok = await removeAttachment(id, attId)
    if (!ok) return Response.json({ error: 'Attachment not found' }, { status: 404 })
    return new Response(null, { status: 204 })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
