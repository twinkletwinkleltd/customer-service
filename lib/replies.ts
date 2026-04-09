// lib/replies.ts
import { readReplies } from './persistence'
import type { StandardReply } from './types'

export async function getAllReplies(): Promise<StandardReply[]> {
  return readReplies()
}
