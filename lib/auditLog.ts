// lib/auditLog.ts
//
// Append-only audit log for sensitive CS actions (currently just
// case deletion). Writes JSONL lines matching the format produced
// by the portal's Flask auth module so a single grep over the file
// shows cross-module history.
//
// Never include the attempted password in an event payload.

import fs from 'fs/promises'
import path from 'path'
import { getPortalSystemRoot } from './sharedPortal'

export interface AuditEvent {
  event: string
  username: string | null
  // Any extra structured context. Must NOT contain secrets.
  [key: string]: unknown
}

function getAuditLogFile(): string {
  const explicit = process.env.PORTAL_AUDIT_LOG?.trim()
  if (explicit) return explicit
  return path.join(
    getPortalSystemRoot(),
    'modules',
    'amazon-cleaner',
    'output',
    '_auth',
    'activity_log.jsonl',
  )
}

function formatTimestamp(d: Date): string {
  // Match the portal's "YYYY-MM-DD HH:MM:SS" format (UTC-agnostic local).
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
    `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
  )
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  const file = getAuditLogFile()
  const line =
    JSON.stringify({
      event: event.event,
      timestamp: formatTimestamp(new Date()),
      username: event.username ?? null,
      ...Object.fromEntries(
        Object.entries(event).filter(
          ([k]) => k !== 'event' && k !== 'username',
        ),
      ),
    }) + '\n'
  try {
    await fs.mkdir(path.dirname(file), { recursive: true })
    await fs.appendFile(file, line, 'utf-8')
  } catch (err) {
    // Audit log failure must not break the API response.
    // eslint-disable-next-line no-console
    console.error('[audit] failed to write event', event.event, err)
  }
}
