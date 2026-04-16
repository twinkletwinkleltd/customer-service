// lib/creator.ts
import { isCreator, type Creator } from './types'

export { CREATOR_VALUES, isCreator } from './types'
export type { Creator } from './types'

/**
 * Try to identify the current portal user from request headers/cookies.
 *
 * We look at common reverse-proxy auth headers and a simple cookie,
 * normalise the value and only accept it if it matches the fixed
 * `star001` / `star002` whitelist. Anything else returns `null`, in which
 * case the UI must show a dropdown for the user to pick.
 */
export function getCurrentCreator(request: Request): Creator | null {
  const headers = request.headers

  const raw =
    headers.get('x-portal-user') ||
    headers.get('x-forwarded-user') ||
    headers.get('x-remote-user') ||
    headers.get('x-authenticated-user') ||
    readCookie(headers.get('cookie') || '', 'portal_user') ||
    readCookie(headers.get('cookie') || '', 'cs_creator')

  if (!raw) return null
  const value = raw.trim().toLowerCase()
  return isCreator(value) ? value : null
}

function readCookie(cookieHeader: string, name: string): string | null {
  if (!cookieHeader) return null
  const parts = cookieHeader.split(';')
  for (const p of parts) {
    const [k, ...rest] = p.trim().split('=')
    if (k === name) return decodeURIComponent(rest.join('='))
  }
  return null
}
