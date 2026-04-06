import fs from 'fs/promises'
import path from 'path'
import type { SupportCase } from './store'

const DATA_DIR = path.join(process.cwd(), 'data')
const DATA_FILE = path.join(DATA_DIR, 'cases.json')

const SEED_CASES: SupportCase[] = [
  {
    id: 'case-001',
    category: 'Order & Shipping',
    customerQuestion: 'Where is my order? It has been a week.',
    standardReply:
      'Thank you for your message. Your order is currently being processed and will be shipped soon. You will receive a tracking number via email once it has been dispatched.',
    keywords: ['order', 'where', 'shipping', 'shipped', 'delivery', 'track', 'tracking', 'dispatch'],
  },
  {
    id: 'case-002',
    category: 'Order & Shipping',
    customerQuestion: 'My package arrived but it was damaged.',
    standardReply:
      'We are sorry to hear your package arrived damaged. Please send us a photo of the damage along with your order number and we will arrange a replacement or full refund immediately.',
    keywords: ['package', 'damaged', 'arrived', 'broken', 'box', 'crushed', 'torn'],
  },
  {
    id: 'case-003',
    category: 'Refunds & Returns',
    customerQuestion: 'I want to return my order and get a refund.',
    standardReply:
      'You can request a return and refund within 30 days of purchase. Please provide your order number and reason for return and we will process your refund within 3–5 business days.',
    keywords: ['refund', 'return', 'money back', 'cancel', 'give back', 'reimbursement'],
  },
  {
    id: 'case-004',
    category: 'Refunds & Returns',
    customerQuestion: 'How long does a refund take to appear on my card?',
    standardReply:
      'Once your return is received and approved, refunds typically appear on your card within 5–10 business days depending on your bank.',
    keywords: ['refund', 'how long', 'card', 'bank', 'days', 'appear', 'credit'],
  },
  {
    id: 'case-005',
    category: 'Account & Access',
    customerQuestion: 'I forgot my password and cannot log in.',
    standardReply:
      'To reset your password, click "Forgot Password" on the login page and follow the instructions sent to your registered email address.',
    keywords: ['password', 'forgot', 'login', 'log in', 'sign in', 'access', 'reset'],
  },
  {
    id: 'case-006',
    category: 'Account & Access',
    customerQuestion: 'I want to delete my account.',
    standardReply:
      'We are sorry to see you go. To delete your account, please go to Settings → Account → Delete Account. Note that this action is irreversible and all data will be removed.',
    keywords: ['delete', 'account', 'close', 'remove account', 'deactivate'],
  },
  {
    id: 'case-007',
    category: 'Product Issue',
    customerQuestion: 'The product I received is not working properly.',
    standardReply:
      'We apologize for the inconvenience. Please describe the issue in detail and include your order number. We will troubleshoot with you or arrange a replacement right away.',
    keywords: ['not working', 'defective', 'broken', 'issue', 'problem', 'fault', 'malfunction', 'stopped'],
  },
  {
    id: 'case-008',
    category: 'Product Issue',
    customerQuestion: 'I received the wrong item in my order.',
    standardReply:
      'We apologize for sending the wrong item. Please send us a photo of what you received along with your order number and we will ship the correct item to you immediately at no extra cost.',
    keywords: ['wrong item', 'wrong product', 'incorrect', 'not what I ordered', 'different item'],
  },
  {
    id: 'case-009',
    category: 'Billing',
    customerQuestion: 'I was charged twice for the same order.',
    standardReply:
      'We are sorry for the billing error. Please share your order number and the last 4 digits of your card and we will investigate and issue a refund for the duplicate charge promptly.',
    keywords: ['charged twice', 'double charge', 'duplicate', 'billing', 'overcharged', 'extra charge'],
  },
  {
    id: 'case-010',
    category: 'Billing',
    customerQuestion: 'Can I get an invoice for my purchase?',
    standardReply:
      'Absolutely! You can download your invoice from your account under Orders → View Order → Download Invoice. If you need a specific format, please let us know.',
    keywords: ['invoice', 'receipt', 'bill', 'tax', 'purchase record', 'proof of payment'],
  },
]

export async function readCasesFromFile(): Promise<SupportCase[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8')
    return JSON.parse(raw) as SupportCase[]
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      // File does not exist — initialize with seed data
      await writeCasesToFile(SEED_CASES)
      return SEED_CASES
    }
    throw new Error(`Failed to read cases file: ${(err as Error).message}`)
  }
}

export async function writeCasesToFile(cases: SupportCase[]): Promise<void> {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true })
    await fs.writeFile(DATA_FILE, JSON.stringify(cases, null, 2), 'utf-8')
  } catch (err: unknown) {
    throw new Error(`Failed to write cases file: ${(err as Error).message}`)
  }
}
