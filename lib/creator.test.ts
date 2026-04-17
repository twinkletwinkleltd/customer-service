// lib/creator.test.ts
import { describe, it, expect } from 'vitest'
import { getCurrentCreator } from './creator'

function mkReq(headers: Record<string, string>): Request {
  return new Request('http://localhost/', { headers })
}

describe('creator', () => {
  // U-15: getCurrentCreator reads x-portal-user / x-forwarded-user /
  //       x-remote-user / x-authenticated-user / portal_user cookie / cs_creator cookie;
  //       returns null if not in allowlist
  it('U-15 reads x-portal-user header', () => {
    expect(getCurrentCreator(mkReq({ 'x-portal-user': 'star001' }))).toBe('star001')
    expect(getCurrentCreator(mkReq({ 'x-portal-user': 'STAR002' }))).toBe('star002')
  })

  it('U-15 falls through header priority chain', () => {
    expect(getCurrentCreator(mkReq({ 'x-forwarded-user': 'star001' }))).toBe('star001')
    expect(getCurrentCreator(mkReq({ 'x-remote-user': 'star002' }))).toBe('star002')
    expect(getCurrentCreator(mkReq({ 'x-authenticated-user': 'star003' }))).toBe('star003')
  })

  it('U-15 reads portal_user cookie', () => {
    expect(getCurrentCreator(mkReq({ cookie: 'portal_user=star001' }))).toBe('star001')
  })

  it('U-15 reads cs_creator cookie', () => {
    expect(getCurrentCreator(mkReq({ cookie: 'cs_creator=star002' }))).toBe('star002')
  })

  it('U-15 reads cs_creator cookie alongside other cookies', () => {
    expect(
      getCurrentCreator(mkReq({ cookie: 'session=abc; cs_creator=star003; other=x' })),
    ).toBe('star003')
  })

  it('U-15 returns null for non-whitelisted values', () => {
    expect(getCurrentCreator(mkReq({ 'x-portal-user': 'hacker' }))).toBeNull()
    expect(getCurrentCreator(mkReq({ 'x-portal-user': '' }))).toBeNull()
    expect(getCurrentCreator(mkReq({}))).toBeNull()
  })

  it('U-15 header wins over cookie', () => {
    expect(
      getCurrentCreator(mkReq({ 'x-portal-user': 'star001', cookie: 'portal_user=star003' })),
    ).toBe('star001')
  })

  it('U-15 trims whitespace from values', () => {
    expect(getCurrentCreator(mkReq({ 'x-portal-user': '  star001  ' }))).toBe('star001')
  })
})
