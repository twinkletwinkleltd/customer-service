import { NextResponse } from 'next/server'
import fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getPortalSystemRoot, getPythonBin, portalPath } from '@/lib/sharedPortal'

const execFileAsync = promisify(execFile)

const PORTAL_ROOT = getPortalSystemRoot()
const PYTHON_BIN = getPythonBin()
const BUILD_VIEW = portalPath('services', 'sku-mapping', 'build_pending_view.py')
const PENDING_VIEW = portalPath('services', 'sku-mapping', 'pending', 'pending_view.json')

export interface PendingEntry {
  original_sku: string
  source: string
  count: number
  last_seen: string
  suggested_sku: string
  status: string
}

export async function GET() {
  // Rebuild view from pending.json before returning — cheap and ensures freshness.
  try {
    await execFileAsync(PYTHON_BIN, [BUILD_VIEW], { cwd: PORTAL_ROOT })
  } catch {
    // Non-fatal: fall through to return whatever is on disk.
  }

  try {
    const raw  = fs.readFileSync(PENDING_VIEW, 'utf-8')
    const data = JSON.parse(raw)
    return NextResponse.json((data.pending_list ?? []) as PendingEntry[])
  } catch {
    return NextResponse.json([])
  }
}
