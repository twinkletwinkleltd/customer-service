// lib/types.ts

export interface Message {
  role: 'customer' | 'agent'
  text: string
  ts: string   // ISO 8601
}

export interface CustomerInfo {
  name: string
  address1: string
  postcode: string
  email: string
  orderId: string
}

export interface CustomerCase {
  id: string
  customer: CustomerInfo
  standardSku: string
  conversation: Message[]
  category: string
  keywords: string[]
  issue: string
  resolution: string
  status: 'open' | 'resolved'
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
  'status' | 'resolution' | 'keywords' | 'issue' | 'category' | 'conversation'
>>

export interface SearchResult {
  type: 'case' | 'reply'
  score: number
  case?: CustomerCase
  reply?: StandardReply
}
