import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const REPO_ROOT       = path.join(process.cwd(), '..', '..')
const BUILD_VIEW      = path.join(REPO_ROOT, 'services', 'sku-mapping', 'build_pending_view.py')
const PENDING_VIEW    = path.join(REPO_ROOT, 'services', 'sku-mapping', 'pending', 'pending_view.json')

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
    await execFileAsync('python', [BUILD_VIEW], { cwd: REPO_ROOT })
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
