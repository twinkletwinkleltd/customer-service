// lib/inbox-api.test.ts — mapper tests (snake_case wire → camelCase UI)

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  fetchInboxFeed,
  fetchInboxThread,
  markNotSpam,
  type FeedResult,
  type MarkNotSpamResult,
  type ThreadResult,
} from './inbox-api'

const origFetch = global.fetch

beforeEach(() => {
  vi.restoreAllMocks()
})

afterEach(() => {
  global.fetch = origFetch
})

function mockFetch(payload: unknown, status = 200) {
  global.fetch = vi.fn().mockResolvedValue({
    json: async () => payload,
    status,
  } as Response) as unknown as typeof fetch
}

describe('fetchInboxFeed', () => {
  it('maps snake_case feed items to camelCase', async () => {
    mockFetch({
      ok: true,
      items: [{
        thread_id: 'gmail:t1',
        channel: 'gmail',
        subject: 'Refund please',
        status: 'open',
        starred: false,
        unread: true,
        tags: ['refund'],
        source: 'gmail',
        last_inbound_at: '2026-06-15T10:00:00+00:00',
        last_inbound_preview: 'Body of gmail:t1',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        order_id: '#1234',
      }],
      total: 1,
      unread_total: 1,
    })

    const res = await fetchInboxFeed() as FeedResult
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.items).toHaveLength(1)
    const item = res.items[0]
    expect(item.id).toBe('gmail:t1')
    expect(item.customerName).toBe('John Doe')
    expect(item.customerEmail).toBe('john@example.com')
    expect(item.subject).toBe('Refund please')
    expect(item.status).toBe('open')
    expect(item.unread).toBe(true)
    expect(item.tags).toEqual(['refund'])
    expect(item.orderId).toBe('#1234')
    expect(res.unreadTotal).toBe(1)
    // Phase 2a.1 — legacy 'gmail' channel value normalises to
    // 'customer' (high-recall default). Reasons absent from the
    // payload become an empty list.
    expect(item.channel).toBe('customer')
    expect(item.categoryReasons).toEqual([])
  })

  it('maps the 3-way channel + reasons round-trip', async () => {
    mockFetch({
      ok: true,
      items: [
        {
          thread_id: 'gmail:cust', channel: 'customer', subject: 'A',
          status: 'open', starred: false, unread: true, tags: [],
          category_reasons: ['customer:no-promotional-signal'],
          source: 'gmail',
          last_inbound_at: '2026-06-15T10:00:00+00:00',
          last_inbound_preview: '', customer_name: 'X',
          customer_email: 'x@y.com', order_id: null,
        },
        {
          thread_id: 'gmail:promo', channel: 'promotional', subject: 'B',
          status: 'open', starred: false, unread: false, tags: [],
          category_reasons: ['promotional:list-unsubscribe-header'],
          source: 'gmail',
          last_inbound_at: '2026-06-14T10:00:00+00:00',
          last_inbound_preview: '', customer_name: 'Brand',
          customer_email: 'b@brand.com', order_id: null,
        },
        {
          thread_id: 'gmail:spam', channel: 'spam', subject: 'C',
          status: 'open', starred: false, unread: false, tags: [],
          category_reasons: ['spam:gmail-label'],
          source: 'gmail',
          last_inbound_at: '2026-06-13T10:00:00+00:00',
          last_inbound_preview: '', customer_name: 'Spammer',
          customer_email: 's@spam.com', order_id: null,
        },
      ],
      total: 3, unread_total: 1,
    })
    const res = await fetchInboxFeed() as FeedResult
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.items[0].channel).toBe('customer')
    expect(res.items[0].categoryReasons).toEqual(['customer:no-promotional-signal'])
    expect(res.items[1].channel).toBe('promotional')
    expect(res.items[1].categoryReasons).toEqual(['promotional:list-unsubscribe-header'])
    expect(res.items[2].channel).toBe('spam')
    expect(res.items[2].categoryReasons).toEqual(['spam:gmail-label'])
  })

  it('normalises unrecognised channel to customer (high-recall default)', async () => {
    mockFetch({
      ok: true,
      items: [{
        thread_id: 'gmail:t1', channel: 'totally-invalid-channel',
        subject: '', status: 'open', starred: false, unread: false,
        tags: [], source: 'gmail',
        last_inbound_at: null, last_inbound_preview: null,
        customer_name: null, customer_email: null, order_id: null,
      }],
      total: 1, unread_total: 0,
    })
    const res = await fetchInboxFeed() as FeedResult
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.items[0].channel).toBe('customer')
  })

  it('normalises unknown status to open', async () => {
    mockFetch({
      ok: true,
      items: [{
        thread_id: 'gmail:t1', channel: 'gmail', subject: '', status: 'awaiting',
        starred: false, unread: false, tags: [], source: 'gmail',
        last_inbound_at: null, last_inbound_preview: null,
        customer_name: null, customer_email: null, order_id: null,
      }],
      total: 1, unread_total: 0,
    })
    const res = await fetchInboxFeed() as FeedResult
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.items[0].status).toBe('open')
  })

  it('returns error envelope when backend ok=false', async () => {
    mockFetch({ ok: false, error: 'gmail_not_configured', message: 'no token' })
    const res = await fetchInboxFeed() as FeedResult
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('gmail_not_configured')
    expect(res.message).toBe('no token')
  })

  it('returns error envelope on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connection refused')) as unknown as typeof fetch
    const res = await fetchInboxFeed() as FeedResult
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('network_error')
    expect(res.message).toContain('connection refused')
  })

  it('passes status + channel + source + limit query params', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, items: [], total: 0, unread_total: 0 }),
      status: 200,
    } as Response)
    global.fetch = fetchSpy as unknown as typeof fetch
    await fetchInboxFeed({
      status: 'open',
      channel: 'customer',
      source: 'namesco',
      limit: 25,
    })
    const url = String(fetchSpy.mock.calls[0][0])
    expect(url).toContain('status=open')
    expect(url).toContain('channel=customer')
    expect(url).toContain('source=namesco')
    expect(url).toContain('limit=25')
  })

  it('sends X-Requested-With header', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, items: [], total: 0, unread_total: 0 }),
      status: 200,
    } as Response)
    global.fetch = fetchSpy as unknown as typeof fetch
    await fetchInboxFeed()
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    const headers = init.headers as Record<string, string>
    expect(headers['x-requested-with']).toBe('XMLHttpRequest')
  })
})

describe('fetchInboxThread', () => {
  it('maps thread + messages into camelCase shape', async () => {
    mockFetch({
      ok: true,
      thread: {
        thread_id: 'gmail:t1',
        channel: 'gmail',
        subject: 'Refund please',
        status: 'resolved',
        starred: false,
        tags: ['refund'],
        source: 'gmail',
        last_inbound_at: '2026-06-15T10:00:00+00:00',
        last_outbound_at: '2026-06-15T11:00:00+00:00',
        customer_name: 'John Doe',
        customer_email: 'john@example.com',
        order_id: '#1234',
        messages: [
          {
            id: 1,
            source_record_id: '<a@example.com>',
            channel: 'gmail',
            message_text: 'Hello',
            created_at: '2026-06-15T09:00:00+00:00',
            sender_name: 'John Doe',
            sender_email: 'john@example.com',
            direction: 'in',
            subject: 'Refund please',
            preview: 'Hello',
          },
          {
            id: 2,
            source_record_id: '<b@example.com>',
            channel: 'gmail',
            message_text: 'Sure',
            created_at: '2026-06-15T11:00:00+00:00',
            sender_name: 'star001',
            sender_email: '',
            direction: 'out',
            subject: 'Re: Refund please',
            preview: 'Sure',
          },
        ],
      },
    })

    const res = await fetchInboxThread('gmail:t1') as ThreadResult
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.thread.id).toBe('gmail:t1')
    expect(res.thread.status).toBe('resolved')
    expect(res.thread.customerName).toBe('John Doe')
    expect(res.thread.messages).toHaveLength(2)
    expect(res.thread.messages[0].direction).toBe('in')
    expect(res.thread.messages[0].text).toBe('Hello')
    expect(res.thread.messages[0].senderLabel).toBe('John Doe')
    // sender_name fell back to email-or-(unknown) for outbound:
    expect(res.thread.messages[1].senderLabel).toBe('star001')
    expect(res.thread.messages[1].direction).toBe('out')
  })

  it('returns error envelope on 404', async () => {
    mockFetch({ ok: false, error: 'not_found', thread_id: 'nope' }, 404)
    const res = await fetchInboxThread('nope') as ThreadResult
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('not_found')
  })

  it('falls back to (unknown) when sender_name + sender_email both empty', async () => {
    mockFetch({
      ok: true,
      thread: {
        thread_id: 'gmail:t1', channel: 'gmail', subject: 's', status: 'open',
        tags: [], last_inbound_at: null,
        messages: [{
          id: 1, channel: 'gmail', message_text: 'x',
          created_at: '2026-06-15T09:00:00+00:00',
          sender_name: '', sender_email: '', direction: 'in',
        }],
      },
    })
    const res = await fetchInboxThread('gmail:t1') as ThreadResult
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.thread.messages[0].senderLabel).toBe('(unknown)')
  })

  it('encodes the thread_id properly (with colon and slash)', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, thread: {
        thread_id: 'gmail:t1', channel: 'gmail', subject: '', status: 'open',
        tags: [], last_inbound_at: null, messages: [],
      } }),
      status: 200,
    } as Response)
    global.fetch = fetchSpy as unknown as typeof fetch
    await fetchInboxThread('gmail:t1/part2')
    const url = String(fetchSpy.mock.calls[0][0])
    expect(url).toContain('gmail%3At1%2Fpart2')
  })

  it('does not double-encode an already encoded thread_id', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      json: async () => ({ ok: true, thread: {
        thread_id: 'gmail:t1', channel: 'gmail', subject: '', status: 'open',
        tags: [], last_inbound_at: null, messages: [],
      } }),
      status: 200,
    } as Response)
    global.fetch = fetchSpy as unknown as typeof fetch
    await fetchInboxThread('gmail%3At1')
    const url = String(fetchSpy.mock.calls[0][0])
    expect(url).toContain('gmail%3At1')
    expect(url).not.toContain('gmail%253At1')
  })
})

// ---------------------------------------------------------------------------
// Phase 2a.2 — markNotSpam
// ---------------------------------------------------------------------------

describe('markNotSpam', () => {
  it('POSTs with XHR header + JSON content type', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        thread: {
          thread_id: 'gmail:t1', channel: 'customer', subject: 's',
          status: 'open', starred: false, tags: [],
          category_reasons: ['operator:rescued-from-spam'],
          last_inbound_at: null, messages: [],
        },
        gmail_response: { id: 'g-tid', message_count: 2 },
      }),
      status: 200,
    } as Response)
    global.fetch = fetchSpy as unknown as typeof fetch

    await markNotSpam('gmail:t1')
    const init = fetchSpy.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    const headers = init.headers as Record<string, string>
    expect(headers['x-requested-with']).toBe('XMLHttpRequest')
    expect(headers['content-type']).toBe('application/json')
  })

  it('encodes thread_id (with colon and slash) in the URL path', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        thread: {
          thread_id: 'gmail:t1', channel: 'customer', subject: 's',
          status: 'open', starred: false, tags: [],
          last_inbound_at: null, messages: [],
        },
      }),
      status: 200,
    } as Response)
    global.fetch = fetchSpy as unknown as typeof fetch
    await markNotSpam('gmail:t1/part2')
    const url = String(fetchSpy.mock.calls[0][0])
    expect(url).toContain('/conversations/gmail%3At1%2Fpart2/mark-not-spam')
  })

  it('does not double-encode an already encoded thread_id for rescue', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      json: async () => ({
        ok: true,
        thread: {
          thread_id: 'gmail:t1', channel: 'customer', subject: 's',
          status: 'open', starred: false, tags: [],
          last_inbound_at: null, messages: [],
        },
      }),
      status: 200,
    } as Response)
    global.fetch = fetchSpy as unknown as typeof fetch
    await markNotSpam('gmail%3At1')
    const url = String(fetchSpy.mock.calls[0][0])
    expect(url).toContain('/conversations/gmail%3At1/mark-not-spam')
    expect(url).not.toContain('gmail%253At1')
  })

  it('returns ok=true + maps thread to camelCase + gmailMessageCount', async () => {
    mockFetch({
      ok: true,
      thread: {
        thread_id: 'gmail:t1', channel: 'customer', subject: 'Refund',
        status: 'open', starred: false, tags: ['refund'],
        category_reasons: ['spam:gmail-label', 'operator:rescued-from-spam'],
        last_inbound_at: '2026-06-15T10:00:00+00:00',
        customer_name: 'John', customer_email: 'john@example.com',
        order_id: '#1234',
        messages: [{
          id: 1, message_text: 'hi', created_at: '2026-06-15T10:00:00+00:00',
          sender_name: 'John', sender_email: 'john@example.com',
          direction: 'in',
        }],
      },
      gmail_response: { id: 'g-tid', message_count: 3 },
    })
    const res = await markNotSpam('gmail:t1') as MarkNotSpamResult
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.thread.channel).toBe('customer')
    expect(res.thread.id).toBe('gmail:t1')
    expect(res.thread.categoryReasons).toContain('operator:rescued-from-spam')
    expect(res.gmailMessageCount).toBe(3)
  })

  it('returns error envelope on 502 gmail_modify_failed', async () => {
    mockFetch({
      ok: false,
      error: 'gmail_modify_failed',
      message: '403 Forbidden: insufficientPermissions',
    }, 502)
    const res = await markNotSpam('gmail:t1') as MarkNotSpamResult
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('gmail_modify_failed')
    expect(res.message).toContain('insufficientPermissions')
  })

  it('returns error envelope on 400 not_a_gmail_thread', async () => {
    mockFetch({ ok: false, error: 'not_a_gmail_thread' }, 400)
    const res = await markNotSpam('shopify:t1') as MarkNotSpamResult
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('not_a_gmail_thread')
  })

  it('returns error envelope on 404', async () => {
    mockFetch({ ok: false, error: 'not_found' }, 404)
    const res = await markNotSpam('gmail:gone') as MarkNotSpamResult
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('not_found')
  })

  it('returns error envelope on network failure', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('connection refused')) as unknown as typeof fetch
    const res = await markNotSpam('gmail:t1') as MarkNotSpamResult
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error).toBe('network_error')
    expect(res.message).toContain('connection refused')
  })

  it('treats missing thread in success response as error', async () => {
    /* If Flask returns ok:true but no thread (shouldn't happen but
     * be defensive), the client must not silently propagate undefined. */
    mockFetch({ ok: true })
    const res = await markNotSpam('gmail:t1') as MarkNotSpamResult
    expect(res.ok).toBe(false)
  })
})
