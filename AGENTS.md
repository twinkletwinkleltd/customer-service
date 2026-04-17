<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Before you change anything

- **Before changing routing, layout, or the API shape**: read [`docs/architecture.md`](docs/architecture.md) first. The C4 diagrams and the `POST /cases` sequence diagram document the contract you're about to modify.
- **Before changing persistence or auth**: read [`docs/decisions/`](docs/decisions/). Seven ADRs explain why we use JSON files, an in-process mutex, atomic tmp+rename, and `X-Portal-User` headers. If you're about to swap any of those out, the ADR tells you what evidence would justify it.
- **Before adding a route**: skim [`docs/design.md`](docs/design.md) — the API schema, error-code table, and performance budget are the spec. Your new route should fit the same conventions (status codes, validation style, `mutateCases` for writes).

## Before you commit

- Run `npm run build`. It type-checks with TS strict — catches the `Account` / `Creator` enum drift and `CasePatch` shape violations that are easy to miss.
- Match the existing patterns in `lib/`:
  - **All writes to cases go through `mutateCases(mutator)`** in `lib/persistence.ts`. Never call `writeCases` directly from a route handler — you'll lose the lock. See ADR-003.
  - **All fetch URLs in client code use `apiPath('/...')`** from `lib/api-path.ts`. Raw `fetch('/api/cases')` silently misses the `/customer-service` basePath and hits 404/401. Same for `<img src>` on attachments — use `apiPath(...)`.
  - **Route handlers return `Response.json(..., { status })`**. Don't hand-roll `new Response(JSON.stringify(...))`.
  - **Validate enums with `isAccount` / `isCreator`** guards from `lib/types.ts` before trusting request bodies.
