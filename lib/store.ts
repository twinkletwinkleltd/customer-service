import { readCasesFromFile, writeCasesToFile } from './persistence'

export interface SupportCase {
  id: string
  category: string
  customerQuestion: string
  standardReply: string
  keywords: string[]
}

function nextId(cases: SupportCase[]): string {
  const max = cases.reduce((acc, c) => {
    const n = parseInt(c.id.replace('case-', ''), 10)
    return isNaN(n) ? acc : Math.max(acc, n)
  }, 0)
  return `case-${String(max + 1).padStart(3, '0')}`
}

export async function getAllCases(): Promise<SupportCase[]> {
  return readCasesFromFile()
}

export async function addCase(data: Omit<SupportCase, 'id'>): Promise<SupportCase> {
  const cases = await readCasesFromFile()
  const newCase: SupportCase = { id: nextId(cases), ...data }
  await writeCasesToFile([...cases, newCase])
  return newCase
}

export async function deleteCase(id: string): Promise<boolean> {
  const cases = await readCasesFromFile()
  const filtered = cases.filter((c) => c.id !== id)
  if (filtered.length === cases.length) return false
  await writeCasesToFile(filtered)
  return true
}

const GREETINGS = [
  'Hi there, thank you for reaching out.',
  'Hello, thank you for contacting us.',
  'Hi, thanks for getting in touch.',
]

const CLOSINGS = [
  'Please let us know if there is anything else we can help you with.',
  'Do not hesitate to reach out if you have any further questions.',
  'We are here to help if you need anything else.',
]

const DEFAULT_BODY =
  'We have received your message and our support team will get back to you within 24 hours.'

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)]
}

function composeReply(matched: SupportCase[]): string {
  const greeting = pick(GREETINGS)
  const closing = pick(CLOSINGS)

  let body: string

  if (matched.length === 0) {
    body = DEFAULT_BODY
  } else if (matched.length === 1) {
    body = matched[0].standardReply
  } else {
    // Combine the top two replies, deduplicating near-identical sentences
    const primary = matched[0].standardReply
    const secondary = matched[1].standardReply

    // Only append secondary if it adds new information (different category)
    if (matched[0].category !== matched[1].category) {
      body = `${primary} Additionally, ${secondary.charAt(0).toLowerCase()}${secondary.slice(1)}`
    } else {
      body = primary
    }
  }

  return `${greeting} ${body} ${closing}`
}

export async function findTopCases(
  question: string,
  topN = 3
): Promise<{ suggestedReply: string; matchedCases: SupportCase[] }> {
  const cases = await readCasesFromFile()
  const lower = question.toLowerCase()

  const matched = cases
    .map((c) => ({ case: c, score: c.keywords.filter((kw) => lower.includes(kw)).length }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map(({ case: c }) => c)

  return {
    suggestedReply: composeReply(matched),
    matchedCases: matched,
  }
}
