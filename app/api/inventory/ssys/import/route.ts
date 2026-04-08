import { NextResponse } from 'next/server'
import fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getPortalSystemRoot, getPythonBin, portalPath } from '@/lib/sharedPortal'

export interface SSYSImportResult {
  success: boolean
  imported_records: number
  skipped_records: number
  pending_added: number
  processed_file: string
  inventory_rebuilt: boolean
  inventory_sku_count: number
  message: string
}

const execFileAsync = promisify(execFile)

const PORTAL_ROOT = getPortalSystemRoot()
const PYTHON_BIN = getPythonBin()
const RUN_IMPORT = portalPath('modules', 'ssys-cleaner', 'run_import.py')
const UPLOADS_DIR = portalPath('modules', 'ssys-cleaner', 'uploads')

const FAILURE_RESULT: SSYSImportResult = {
  success: false,
  imported_records: 0,
  skipped_records: 0,
  pending_added: 0,
  processed_file: '',
  inventory_rebuilt: false,
  inventory_sku_count: 0,
  message: '',
}

function parseRunImportOutput(stdout: string): SSYSImportResult {
  const result: SSYSImportResult = { ...FAILURE_RESULT }

  for (const raw of stdout.split('\n')) {
    const line = raw.trim()
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const val = line.slice(colonIdx + 1).trim()

    switch (key) {
      case 'success':             result.success = val === 'True'; break
      case 'imported_records':    result.imported_records = parseInt(val) || 0; break
      case 'skipped_records':     result.skipped_records = parseInt(val) || 0; break
      case 'pending_added':       result.pending_added = parseInt(val) || 0; break
      case 'processed_file':      result.processed_file = val; break
      case 'inventory_rebuilt':   result.inventory_rebuilt = val === 'True'; break
      case 'inventory_sku_count': result.inventory_sku_count = parseInt(val) || 0; break
      case 'message':             result.message = val; break
    }
  }

  return result
}

export async function POST(request: Request) {
  let fileBuffer: Buffer

  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { ...FAILURE_RESULT, message: 'No file uploaded' },
        { status: 400 }
      )
    }
    const f = file as File
    if (!f.name.toLowerCase().endsWith('.csv')) {
      return NextResponse.json(
        { ...FAILURE_RESULT, message: 'Only .csv files are accepted' },
        { status: 400 }
      )
    }
    fileBuffer = Buffer.from(await f.arrayBuffer())
  } catch {
    return NextResponse.json(
      { ...FAILURE_RESULT, message: 'Failed to read uploaded file' },
      { status: 400 }
    )
  }

  // Save file for traceability
  const ts = new Date().toISOString().replace(/-/g, '').replace(/:/g, '').slice(0, 15) + 'Z'
  const savedPath = portalPath('modules', 'ssys-cleaner', 'uploads', `ssys_upload_${ts}.csv`)

  try {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true })
    fs.writeFileSync(savedPath, fileBuffer)
  } catch {
    return NextResponse.json(
      { ...FAILURE_RESULT, message: 'Failed to save uploaded file' },
      { status: 500 }
    )
  }

  // Invoke run_import.py
  let stdout = ''
  try {
    const result = await execFileAsync(PYTHON_BIN, [RUN_IMPORT, savedPath], { cwd: PORTAL_ROOT })
    stdout = result.stdout
  } catch (err: unknown) {
    stdout =
      err && typeof err === 'object' && 'stdout' in err
        ? String((err as { stdout?: string }).stdout || '')
        : ''
    if (!stdout) {
      const errorMsg =
        err && typeof err === 'object'
          ? String((err as { stderr?: string }).stderr || (err as { message?: string }).message || 'unknown error').trim()
          : 'unknown error'
      return NextResponse.json({ ...FAILURE_RESULT, message: `Import process failed: ${errorMsg}` })
    }
  }

  return NextResponse.json(parseRunImportOutput(stdout))
}
