import { describe, it, expect, afterEach } from 'vitest'
import crypto from 'crypto'
import fs from 'fs/promises'
import os from 'os'
import path from 'path'
import {
  checkPortalPasswordHash,
  getPortalUsersFile,
  verifyPortalPassword,
} from './portalPassword'

const OLD_USERS_FILE = process.env.PORTAL_USERS_FILE

afterEach(() => {
  if (OLD_USERS_FILE === undefined) {
    delete process.env.PORTAL_USERS_FILE
  } else {
    process.env.PORTAL_USERS_FILE = OLD_USERS_FILE
  }
})

function pbkdf2Hash(password: string, salt = 'pepper'): string {
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 32, 'sha256').toString('hex')
  return `pbkdf2:sha256:1000$${salt}$${hash}`
}

function scryptHash(password: string, salt = 'salt'): string {
  const hash = crypto.scryptSync(password, salt, 64, {
    N: 16,
    r: 1,
    p: 1,
    maxmem: 32 * 1024 * 1024,
  }).toString('hex')
  return `scrypt:16:1:1$${salt}$${hash}`
}

describe('portal password verification', () => {
  it('resolves an explicit users file path', () => {
    process.env.PORTAL_USERS_FILE = '/tmp/users.json'
    expect(getPortalUsersFile()).toBe('/tmp/users.json')
  })

  it('validates supported Werkzeug hash formats', async () => {
    expect(await checkPortalPasswordHash(pbkdf2Hash('secret'), 'secret')).toBe(true)
    expect(await checkPortalPasswordHash(pbkdf2Hash('secret'), 'wrong')).toBe(false)
    expect(await checkPortalPasswordHash(scryptHash('secret'), 'secret')).toBe(true)
  })

  it('rejects malformed or unsupported hashes without throwing', async () => {
    expect(await checkPortalPasswordHash('', 'secret')).toBe(false)
    expect(await checkPortalPasswordHash('not-a-hash', 'secret')).toBe(false)
    expect(await checkPortalPasswordHash('md5$salt$abcd', 'secret')).toBe(false)
    expect(await checkPortalPasswordHash('pbkdf2:sha256:notnum$salt$abcd', 'secret')).toBe(false)
    expect(await checkPortalPasswordHash('scrypt:bad:1:1$salt$abcd', 'secret')).toBe(false)
    expect(await checkPortalPasswordHash(pbkdf2Hash('secret'), '')).toBe(false)
  })

  it('verifies a user against PORTAL_USERS_FILE', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'portal-users-'))
    const file = path.join(dir, 'users.json')
    process.env.PORTAL_USERS_FILE = file
    await fs.writeFile(
      file,
      JSON.stringify({
        star001: { password: pbkdf2Hash('correct'), role: 'user' },
      }),
    )

    expect(await verifyPortalPassword('star001', 'correct')).toBe(true)
    expect(await verifyPortalPassword('star001', 'wrong')).toBe(false)
    expect(await verifyPortalPassword('missing', 'correct')).toBe(false)
  })
})
