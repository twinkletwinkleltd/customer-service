// lib/mock-inbox.ts
//
// Hard-coded sample conversations for the Step 1 UI scaffold (no real
// Gmail connection yet). When Step 2 wires up the Gmail API + Flask
// backend, this file is replaced by `fetch(apiPath('/conversations/feed'))`
// — the shape of the response is intentionally already aligned with
// InboxThread / InboxMessage.

import type { InboxThread } from './inbox-types'

export const MOCK_THREADS: InboxThread[] = [
  {
    id: 't-9f3a1c8e',
    customerName: 'John Doe',
    customerEmail: 'john.doe@example.com',
    subject: 'Refund request for order 1234',
    status: 'open',
    unread: true,
    lastInboundAt: '2026-06-15T15:42:00+01:00',
    lastInboundPreview: "It's black, +1.50. Could you arrange the return label?",
    orderId: '#1234',
    tags: ['refund', 'size-issue'],
    source: 'gmail',
    messages: [
      {
        id: 'm-1',
        direction: 'in',
        text: 'Hi, I want to return my order #1234. The size does not fit. Can you help?',
        sentAt: '2026-06-15T09:23:00+01:00',
        senderLabel: 'John Doe',
      },
      {
        id: 'm-2',
        direction: 'out',
        text: 'Hello John, sorry to hear that! Can you confirm the colour and strength so we can arrange the return label?',
        sentAt: '2026-06-15T14:08:00+01:00',
        senderLabel: 'star001',
      },
      {
        id: 'm-3',
        direction: 'in',
        text: "It's black, +1.50. Could you arrange the return label?",
        sentAt: '2026-06-15T15:42:00+01:00',
        senderLabel: 'John Doe',
      },
    ],
  },
  {
    id: 't-2b71a04d',
    customerName: 'Mary Smith',
    customerEmail: 'mary.smith@gmail.com',
    subject: 'Where is my parcel?',
    status: 'open',
    unread: true,
    lastInboundAt: '2026-06-15T11:18:00+01:00',
    lastInboundPreview: 'My order was placed 10 days ago and there is still no tracking update…',
    orderId: '#1198',
    tags: ['shipping'],
    source: 'gmail',
    messages: [
      {
        id: 'm-1',
        direction: 'in',
        text: 'Hi, my order #1198 was placed 10 days ago and there is still no tracking update. Could you check?',
        sentAt: '2026-06-15T11:18:00+01:00',
        senderLabel: 'Mary Smith',
      },
    ],
  },
  {
    id: 't-7d2e44b1',
    customerName: 'Alice Brown',
    customerEmail: 'alice.brown@yahoo.com',
    subject: 'Reading glasses comfort',
    status: 'open',
    unread: false,
    lastInboundAt: '2026-06-14T17:02:00+01:00',
    lastInboundPreview: 'Thanks for the quick reply — I will try the +1.00 pair and let you know.',
    orderId: '#1162',
    tags: ['advice'],
    source: 'gmail',
    messages: [
      {
        id: 'm-1',
        direction: 'in',
        text: 'Hello, the +1.50 glasses I bought feel too strong. Should I try +1.00 instead?',
        sentAt: '2026-06-14T09:45:00+01:00',
        senderLabel: 'Alice Brown',
      },
      {
        id: 'm-2',
        direction: 'out',
        text: 'Hi Alice, that is very common. +1.00 is a gentler option for early presbyopia — happy to send it as an exchange.',
        sentAt: '2026-06-14T13:30:00+01:00',
        senderLabel: 'star001',
      },
      {
        id: 'm-3',
        direction: 'in',
        text: 'Thanks for the quick reply — I will try the +1.00 pair and let you know.',
        sentAt: '2026-06-14T17:02:00+01:00',
        senderLabel: 'Alice Brown',
      },
    ],
  },
  {
    id: 't-c801f3a6',
    customerName: 'Peter Wong',
    customerEmail: 'peter.wong@hotmail.com',
    subject: 'Wholesale pricing enquiry',
    status: 'open',
    unread: true,
    lastInboundAt: '2026-06-13T20:14:00+01:00',
    lastInboundPreview: 'I run a small optician shop in Manchester and would like to know about bulk discounts…',
    tags: ['wholesale', 'pre-sale'],
    source: 'gmail',
    messages: [
      {
        id: 'm-1',
        direction: 'in',
        text: 'Hello, I run a small optician shop in Manchester and would like to know about bulk discounts for reading glasses. Could you send a wholesale price list?',
        sentAt: '2026-06-13T20:14:00+01:00',
        senderLabel: 'Peter Wong',
      },
    ],
  },
  {
    id: 't-1a4b6e9c',
    customerName: 'Sarah Lee',
    customerEmail: 'sarah.lee@gmail.com',
    subject: 'Order arrived — thanks!',
    status: 'resolved',
    unread: false,
    lastInboundAt: '2026-06-12T10:05:00+01:00',
    lastInboundPreview: 'Just a quick note to say my parcel arrived this morning and everything is perfect.',
    orderId: '#1145',
    tags: ['thank-you'],
    source: 'gmail',
    messages: [
      {
        id: 'm-1',
        direction: 'in',
        text: 'Just a quick note to say my parcel arrived this morning and everything is perfect. Thank you!',
        sentAt: '2026-06-12T10:05:00+01:00',
        senderLabel: 'Sarah Lee',
      },
      {
        id: 'm-2',
        direction: 'out',
        text: 'Thank you so much for letting us know, Sarah — enjoy the new glasses!',
        sentAt: '2026-06-12T11:30:00+01:00',
        senderLabel: 'star001',
      },
    ],
  },
]

export function findThread(id: string): InboxThread | undefined {
  return MOCK_THREADS.find((t) => t.id === id)
}
