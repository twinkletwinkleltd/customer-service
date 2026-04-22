// lib/portalPassword.ts
//
// Validate a portal user's password against the shared portal
// `users.json` file written by the Flask admin UI. Mirrors
// `werkzeug.security.check_password_hash`.
//
// Supported hash formats (both produced by Werkzeug >= 2.x):
//   scrypt:<N>:<r>:<p>$<salt>$<hexhash>
//   pbkdf2:sha256:<iterations>$<salt>$<hexhash>
//
// Any other format returns false (never throws), so a corrupted or
// unexpected hash line cannot accidentally authenticate.

import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { promisify } from 'util'
import { getPortalSystemRoot } from './sharedPortal'

const scryptAsync = promisify(crypto.scrypt) as (
  password: crypto.BinaryLike,
  salt: crypto.BinaryLike,
  keylen: number,
  options: crypto.ScryptOptions,
) => Promise<Buffer>

interface UserRecord {
  password: string
  role?: string
}

type UsersFile = Record<string, UserRecord>

/**
 * Resolve the portal users.json path.
 * Override with PORTAL_USERS_FILE for tests / custom deployments.
 */
export function getPortalUsersFile(): string {
  const explicit = process.env.PORTAL_USERS_FILE?.trim()
  if (explicit) return explicit
  return path.join(
    getPortalSystemRoot(),
    'modules',
    'amazon-cleaner',
    'output',
    '_auth',
    'users.json',
  )
}

async function readUsersFile(): Promise<UsersFile> {
  const file = getPortalUsersFile()
  const raw = await fs.readFile(file, 'utf-8')
  return JSON.parse(raw) as UsersFile
}

function constantTimeEqualHex(a: string, b: string): boolean {
  try {
    const aBuf = Buffer.from(a, 'hex')
    const bBuf = Buffer.from(b, 'hex')
    if (aBuf.length === 0 || aBuf.length !== bBuf.length) return false
    return crypto.timingSafeEqual(aBuf, bBuf)
  } catch {
    return false
  }
}

/**
 * Port of werkzeug.security.check_password_hash for the two formats
 * we actually use.
 *
 * Returns false for any malformed / unsupported hash rather than
 * throwing — callers should treat "can't verify" as "wrong password".
 */
export async function checkPortalPasswordHash(
  storedHash: string,
  candidate: string,
): Promise<boolean> {
  if (!storedHash || typeof storedHash !== 'string') return false
  if (typeof candidate !== 'string' || candidate.length === 0) return false

  // Werkzeug format: "<method>$<salt>$<hashhex>"
  const firstDollar = storedHash.indexOf('$')
  if (firstDollar === -1) return false
  const secondDollar = storedHash.indexOf('$', firstDollar + 1)
  if (secondDollar === -1) return false

  const method = storedHash.slice(0, firstDollar)
  const salt = storedHash.slice(firstDollar + 1, secondDollar)
  const hashHex = storedHash.slice(secondDollar + 1)
  if (!method || !salt || !hashHex) return false

  try {
    if (method.startsWith('scrypt:')) {
      // method = "scrypt:N:r:p"
      const parts = method.split(':')
      if (parts.length !== 4) return false
      const N = parseInt(parts[1], 10)
      const r = parseInt(parts[2], 10)
      const p = parseInt(parts[3], 10)
      if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) {
        return false
      }
      // Werkzeug derives 64-byte output (keylen = 64) by default for scrypt.
      const keylen = hashHex.length / 2
      // Node's scrypt requires maxmem big enough for large N; bump it.
      // default maxmem = 32 MiB; scrypt with N=32768,r=8 needs ~32 MiB,
      // so set maxmem explicitly to avoid ERR_CRYPTO_INVALID_SCRYPT_PARAMS.
      const maxmem = Math.max(128 * N * r * 2, 32 * 1024 * 1024)
      const derived = await scryptAsync(candidate, salt, keylen, {
        N,
        r,
        p,
        maxmem,
      })
      return constantTimeEqualHex(derived.toString('hex'), hashHex)
    }

    if (method.startsWith('pbkdf2:sha256')) {
      // method = "pbkdf2:sha256:<iterations>"
      const parts = method.split(':')
      if (parts.length !== 3) return false
      const iterations = parseInt(parts[2], 10)
      if (!Number.isFinite(iterations) || iterations <= 0) return false
      const keylen = hashHex.length / 2
      const derived = crypto.pbkdf2Sync(
        candidate,
        salt,
        iterations,
        keylen,
        'sha256',
      )
      return constantTimeEqualHex(derived.toString('hex'), hashHex)
    }

    // Unknown method
    return false
  } catch {
    return false
  }
}

/**
 * Verify that (username, password) matches the portal users.json entry.
 * Returns false if the file is missing, the user doesn't exist, or the
 * hash doesn't match. Never throws on normal "wrong password" paths.
 */
export async function verifyPortalPassword(
  username: string,
  password: string,
): Promise<boolean> {
  if (!username || !password) return false
  let users: UsersFile
  try {
    users = await readUsersFile()
  } catch {
    return false
  }
  const rec = users[username]
  if (!rec || typeof rec.password !== 'string') return false
  return checkPortalPasswordHash(rec.password, password)
}
