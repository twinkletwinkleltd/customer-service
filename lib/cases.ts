export interface SupportCase {
  id: string
  category: string
  customerQuestion: string
  standardReply: string
  keywords: string[]
}

export const caseLibrary: SupportCase[] = [
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

const DEFAULT_REPLY =
  'Thank you for reaching out to our support team. We have received your message and will get back to you within 24 hours.'

export function findTopCases(question: string, topN = 3): { suggestedReply: string; matchedCases: SupportCase[] } {
  const lower = question.toLowerCase()

  const scored = caseLibrary.map((c) => {
    const score = c.keywords.filter((kw) => lower.includes(kw)).length
    return { case: c, score }
  })

  const matched = scored
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ case: c }) => c)

  const suggestedReply = matched.length > 0 ? matched[0].standardReply : DEFAULT_REPLY

  return { suggestedReply, matchedCases: matched }
}
