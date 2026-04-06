export interface ParsedRow {
  [key: string]: string
}

export interface CsvParseResult {
  headers: string[]
  rows: ParsedRow[]
}

/**
 * Parses a CSV string with support for double-quoted fields (RFC 4180).
 * Quoted fields may contain commas and newlines.
 */
export function parseCsv(text: string): CsvParseResult {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const tokens = tokenize(lines)

  if (tokens.length === 0) return { headers: [], rows: [] }

  const headers = tokens[0].map((h) => h.trim().toLowerCase())
  const rows: ParsedRow[] = []

  for (let i = 1; i < tokens.length; i++) {
    const cols = tokens[i]
    // Skip completely blank lines
    if (cols.length === 1 && cols[0].trim() === '') continue
    const row: ParsedRow = {}
    headers.forEach((h, idx) => {
      row[h] = cols[idx]?.trim() ?? ''
    })
    rows.push(row)
  }

  return { headers, rows }
}

/**
 * Splits CSV text into a 2D array of cell values, handling quoted fields.
 */
function tokenize(text: string): string[][] {
  const result: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        // Escaped quote ("")
        if (text[i + 1] === '"') {
          cell += '"'
          i += 2
        } else {
          inQuotes = false
          i++
        }
      } else {
        cell += ch
        i++
      }
    } else {
      if (ch === '"') {
        inQuotes = true
        i++
      } else if (ch === ',') {
        row.push(cell)
        cell = ''
        i++
      } else if (ch === '\n') {
        row.push(cell)
        result.push(row)
        row = []
        cell = ''
        i++
      } else {
        cell += ch
        i++
      }
    }
  }

  // Push the last cell/row
  row.push(cell)
  if (row.some((c) => c.trim() !== '')) {
    result.push(row)
  }

  return result
}
