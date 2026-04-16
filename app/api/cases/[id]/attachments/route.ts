// app/api/cases/[id]/attachments/route.ts
import { addAttachment, getCaseById } from '@/lib/cases'

type Ctx = { params: Promise<{ id: string }> }

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
])

const MAX_BYTES = 5 * 1024 * 1024 // 5 MB

export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params
  try {
    const c = await getCaseById(id)
    if (!c) return Response.json({ error: 'Case not found' }, { status: 404 })

    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) {
      return Response.json({ error: 'Missing "file" field in multipart body' }, { status: 400 })
    }

    const mime = (file.type || '').toLowerCase()
    if (!ALLOWED_MIME.has(mime)) {
      return Response.json(
        { error: `Unsupported mime type "${mime}". Allowed: jpg, jpeg, png, webp, gif.` },
        { status: 415 },
      )
    }

    if (file.size > MAX_BYTES) {
      return Response.json({ error: `File too large (${file.size} bytes > ${MAX_BYTES}).` }, { status: 413 })
    }

    const bytes = new Uint8Array(await file.arrayBuffer())
    const att = await addAttachment(id, {
      originalName: file.name || 'upload',
      mime,
      bytes,
    })
    if (!att) return Response.json({ error: 'Case not found' }, { status: 404 })

    return Response.json(att, { status: 201 })
  } catch (err: unknown) {
    return Response.json({ error: (err as Error).message }, { status: 500 })
  }
}
