import { NextResponse } from 'next/server'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getPortalSystemRoot, getPythonBin, portalPath } from '@/lib/sharedPortal'

const execFileAsync = promisify(execFile)

const PORTAL_ROOT = getPortalSystemRoot()
const PYTHON_BIN = getPythonBin()
const APPLY_MAPPING = portalPath('services', 'sku-mapping', 'apply_mapping.py')

interface ConfirmBody {
  original_sku: string
  source: string
  standard_sku: string
}

const FAILURE = {
  success: false,
  original_sku: '',
  source: '',
  standard_sku: '',
  removed_count: 0,
  message: '',
}

export async function POST(request: Request) {
  let body: ConfirmBody
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ ...FAILURE, message: 'Invalid request body' }, { status: 400 })
  }

  const { original_sku, source, standard_sku } = body

  if (!original_sku || !source || !standard_sku) {
    return NextResponse.json(
      { ...FAILURE, message: 'original_sku, source, and standard_sku are required' },
      { status: 400 }
    )
  }

  // Use execFile (no shell) — args are passed as array, no injection risk.
  let stdout = ''
  try {
    const result = await execFileAsync(
      PYTHON_BIN,
      [APPLY_MAPPING, '--sku', original_sku, '--source', source, '--standard-sku', standard_sku],
      { cwd: PORTAL_ROOT }
    )
    stdout = result.stdout
  } catch (err: any) {
    // apply_mapping.py exits 1 on validation failures but still writes JSON to stdout.
    stdout = err.stdout || ''
    if (!stdout) {
      const msg = (err.stderr || err.message || 'unknown error').trim()
      return NextResponse.json({ ...FAILURE, original_sku, source, message: msg })
    }
  }

  try {
    return NextResponse.json(JSON.parse(stdout.trim()))
  } catch {
    return NextResponse.json({
      ...FAILURE,
      original_sku,
      source,
      message: `Unexpected script output: ${stdout.trim().slice(0, 200)}`,
    })
  }
}
