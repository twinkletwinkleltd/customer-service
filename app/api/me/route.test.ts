// app/api/me/route.test.ts
import { describe, it, expect } from 'vitest'

describe('GET /api/me', () => {
  // Reads x-portal-user header and returns it in body.creator
  it('reads x-portal-user header and echoes it as creator', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://test/api/me', {
      headers: { 'x-portal-user': 'star002' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { creator: string | null }
    expect(body.creator).toBe('star002')
  })

  // No recognised header/cookie → creator is null (handler-level check,
  // middleware not involved here).
  it('returns creator: null when no user header is present', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://test/api/me')
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { creator: string | null }
    expect(body.creator).toBeNull()
  })

  // Unknown user value (not in star001/2/3 whitelist) → also null
  it('returns creator: null when header value is not in the whitelist', async () => {
    const { GET } = await import('./route')
    const req = new Request('http://test/api/me', {
      headers: { 'x-portal-user': 'someone-else' },
    })
    const res = await GET(req)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { creator: string | null }
    expect(body.creator).toBeNull()
  })
})
