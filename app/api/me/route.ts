// app/api/me/route.ts
import { getCurrentCreator } from '@/lib/creator'

export async function GET(request: Request) {
  const creator = getCurrentCreator(request)
  return Response.json({ creator })
}
