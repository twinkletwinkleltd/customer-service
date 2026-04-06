import { addCase } from '@/lib/store'
import { parseCsv } from '@/lib/csv'

export interface ImportResult {
  total: number
  imported: number
  skipped: number
  errors: string[]
}

const REQUIRED_COLUMNS = ['category', 'customerquestion', 'standardreply', 'keywords']

export async function POST(request: Request) {
  let text: string

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return Response.json({ error: 'No file uploaded' }, { status: 400 })
    }
    text = await (file as File).text()
  } catch {
    return Response.json({ error: 'Failed to read uploaded file' }, { status: 400 })
  }

  const { headers, rows } = parseCsv(text)
  const result: ImportResult = { total: rows.length, imported: 0, skipped: 0, errors: [] }

  // Validate headers
  const missing = REQUIRED_COLUMNS.filter((col) => !headers.includes(col))
  if (missing.length > 0) {
    return Response.json(
      { error: `CSV is missing required columns: ${missing.join(', ')}` },
      { status: 400 }
    )
  }

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2 // 1-indexed, +1 for header row
    const row = rows[i]

    const category = row['category']
    const customerQuestion = row['customerquestion']
    const standardReply = row['standardreply']
    const keywordsRaw = row['keywords']

    const rowErrors: string[] = []
    if (!category) rowErrors.push('category is empty')
    if (!customerQuestion) rowErrors.push('customerQuestion is empty')
    if (!standardReply) rowErrors.push('standardReply is empty')
    if (!keywordsRaw) rowErrors.push('keywords is empty')

    if (rowErrors.length > 0) {
      result.skipped++
      result.errors.push(`Row ${rowNum}: skipped — ${rowErrors.join(', ')}`)
      continue
    }

    const keywords = keywordsRaw
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean)

    try {
      await addCase({ category, customerQuestion, standardReply, keywords })
      result.imported++
    } catch {
      result.skipped++
      result.errors.push(`Row ${rowNum}: failed to save`)
    }
  }

  return Response.json(result)
}
