// lib/types.ts

export type Account = 'gorble' | 'ssys' | 'ama_tktk'

export const ACCOUNT_DISPLAY: Record<Account, string> = {
  gorble:   'Gorble',
  ssys:     'SSYS',
  ama_tktk: 'Ama-TKTK',
}

export const ACCOUNT_VALUES: Account[] = ['gorble', 'ssys', 'ama_tktk']

export function isAccount(value: unknown): value is Account {
  return value === 'gorble' || value === 'ssys' || value === 'ama_tktk'
}

export type Creator = 'star001' | 'star002'

export const CREATOR_VALUES: Creator[] = ['star001', 'star002']

export function isCreator(value: unknown): value is Creator {
  return value === 'star001' || value === 'star002'
}

export interface Message {
  role: 'customer' | 'agent'
  text: string
  ts: string   // ISO 8601
}

export interface Attachment {
  id: string            // unique per case
  filename: string      // sanitized on-disk name
  originalName: string  // client-provided name
  mime: string          // e.g. image/png
  size: number          // bytes
  createdAt: string     // ISO 8601
}

export interface CustomerInfo {
  name: string
  address1: string
  postcode: string
  email: string
  /** Preferred new field name. */
  salesRecordNo: string
  /** Legacy — kept for read-compat with older JSON records. */
  orderId?: string
}

export interface CustomerCase {
  id: string
  customer: CustomerInfo
  /** Sales channel / account this case belongs to. Optional on legacy rows. */
  account?: Account
  /** Who recorded this case. Optional on legacy rows. */
  creator?: Creator
  standardSku: string
  conversation: Message[]
  category: string
  keywords: string[]
  issue: string
  resolution: string
  status: 'open' | 'resolved'
  attachments?: Attachment[]
  createdAt: string
  updatedAt: string
}

export interface StandardReply {
  id: string
  category: string
  keywords: string[]
  question: string
  reply: string
}

export type CasePatch = Partial<Pick<CustomerCase,
  'status' | 'resolution' | 'keywords' | 'issue' | 'category' | 'conversation' | 'account' | 'creator'
>>

export interface SearchResult {
  type: 'case' | 'reply'
  score: number
  case?: CustomerCase
  reply?: StandardReply
}
