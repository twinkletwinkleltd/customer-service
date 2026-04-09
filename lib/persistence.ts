// lib/persistence.ts
import fs from 'fs/promises'
import path from 'path'
import type { CustomerCase, StandardReply } from './types'

const DATA_DIR  = path.join(process.cwd(), 'data')
const CASES_FILE   = path.join(DATA_DIR, 'cases.json')
const REPLIES_FILE = path.join(DATA_DIR, 'replies.json')

async function ensureDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

// ─── Cases ────────────────────────────────────────────────────────────────

export async function readCases(): Promise<CustomerCase[]> {
  try {
    return JSON.parse(await fs.readFile(CASES_FILE, 'utf-8')) as CustomerCase[]
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      await writeCases([])
      return []
    }
    throw e
  }
}

export async function writeCases(cases: CustomerCase[]): Promise<void> {
  await ensureDir()
  await fs.writeFile(CASES_FILE, JSON.stringify(cases, null, 2), 'utf-8')
}

// ─── Standard Replies ────────────────────────────────────────────────────

const SEED_REPLIES: StandardReply[] = [
  { id: 'reply-001', category: 'Order & Shipping', question: 'Where is my order?', reply: 'Your order is currently being processed and will be shipped soon. You will receive a tracking number via email once dispatched.', keywords: ['order', 'where', 'shipping', 'tracking', 'delivery'] },
  { id: 'reply-002', category: 'Order & Shipping', question: 'My package arrived damaged.', reply: 'We are sorry to hear that. Please send us a photo of the damage along with your order number and we will arrange a replacement or full refund immediately.', keywords: ['damaged', 'package', 'broken', 'arrived'] },
  { id: 'reply-003', category: 'Refunds & Returns', question: 'I want to return my order.', reply: 'You can request a return and refund within 30 days of purchase. Please provide your order number and reason for return and we will process your refund within 3–5 business days.', keywords: ['refund', 'return', 'cancel', 'money back'] },
  { id: 'reply-004', category: 'Refunds & Returns', question: 'How long does a refund take?', reply: 'Once your return is received and approved, refunds typically appear on your card within 5–10 business days depending on your bank.', keywords: ['refund', 'how long', 'card', 'days'] },
  { id: 'reply-005', category: 'Product Issue', question: 'The product is not working properly.', reply: 'We apologize for the inconvenience. Please describe the issue in detail and include your order number. We will troubleshoot with you or arrange a replacement right away.', keywords: ['not working', 'broken', 'defective', 'problem', 'fault'] },
  { id: 'reply-006', category: 'Product Issue', question: 'I received the wrong item.', reply: 'We apologize for sending the wrong item. Please send us a photo of what you received along with your order number and we will ship the correct item immediately at no extra cost.', keywords: ['wrong item', 'incorrect', 'wrong product', 'different'] },
  { id: 'reply-007', category: 'Billing', question: 'I was charged twice.', reply: 'We are sorry for the billing error. Please share your order number and the last 4 digits of your card and we will investigate and issue a refund for the duplicate charge promptly.', keywords: ['charged twice', 'double charge', 'duplicate', 'billing'] },
  { id: 'reply-008', category: 'Billing', question: 'Can I get an invoice?', reply: 'You can download your invoice from your account under Orders → View Order → Download Invoice. If you need a specific format please let us know.', keywords: ['invoice', 'receipt', 'bill', 'tax'] },
  { id: 'reply-009', category: 'Account & Access', question: 'I forgot my password.', reply: 'To reset your password, click "Forgot Password" on the login page and follow the instructions sent to your registered email address.', keywords: ['password', 'forgot', 'login', 'reset', 'access'] },
  { id: 'reply-010', category: 'Account & Access', question: 'I want to delete my account.', reply: 'To delete your account, please go to Settings → Account → Delete Account. Note that this action is irreversible and all data will be removed.', keywords: ['delete', 'account', 'close', 'remove', 'deactivate'] },
]

export async function readReplies(): Promise<StandardReply[]> {
  try {
    return JSON.parse(await fs.readFile(REPLIES_FILE, 'utf-8')) as StandardReply[]
  } catch (e: unknown) {
    if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
      // First run — seed with migrated standard replies
      await writeReplies(SEED_REPLIES)
      return SEED_REPLIES
    }
    throw e
  }
}

export async function writeReplies(replies: StandardReply[]): Promise<void> {
  await ensureDir()
  await fs.writeFile(REPLIES_FILE, JSON.stringify(replies, null, 2), 'utf-8')
}
