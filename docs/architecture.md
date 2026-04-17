# Customer Service — Architecture

Last updated: 2026-04-17

This doc uses C4 levels. Read top-to-bottom; stop at the level that answers your question.

## Level 1 — System Context

```mermaid
flowchart LR
    User[Portal user<br/>star000..star003]
    Nginx[Nginx reverse proxy<br/>TLS termination<br/>injects X-Portal-User]
    Portal[Portal Flask<br/>authenticates + sets<br/>portal_user cookie]
    CS[Customer Service<br/>Next.js app :3001<br/>basePath /customer-service]
    FS[(Filesystem<br/>PORTAL_DATA_ROOT/<br/>customer-service/)]

    User -- HTTPS --> Nginx
    Nginx -- /login, /portal/* --> Portal
    Nginx -- /customer-service/* --> CS
    Portal -. sets portal_user cookie .-> Nginx
    CS -- read/write cases.json<br/>replies.json<br/>case-images/ --> FS
```

**Responsibilities:**
- Portal Flask owns login + session cookie. CS never sees a password.
- Nginx reads the `portal_user` cookie and forwards it as the `X-Portal-User` request header to CS.
- CS trusts the header, enforces an allowlist, persists cases to JSON + images to disk.

## Level 2 — Container

```mermaid
flowchart TB
    subgraph CS[Customer Service Next.js app]
        MW[middleware.ts<br/>SSO allowlist check]
        Pages[App Router pages<br/>app/page.tsx, app/cases/..., app/search/...]
        API[API route handlers<br/>app/api/cases, /cases/id,<br/>/attachments, /replies, /search, /me]
        Lib[lib/ modules]
    end

    subgraph LibSub[lib/]
        Pers[persistence.ts<br/>atomicWriteJson + withCasesLock]
        Cases[cases.ts<br/>CRUD + attachments]
        Search[search.ts<br/>keyword scoring]
        Keywords[keywords.ts]
        Account[account.ts]
        Creator[creator.ts<br/>reads X-Portal-User]
        Replies[replies.ts]
        ApiPath[api-path.ts<br/>basePath helper]
        Types[types.ts]
    end

    FS[(Filesystem)]

    MW --> Pages
    MW --> API
    Pages -. fetch apiPath('/cases') .-> API
    API --> Cases
    API --> Search
    API --> Replies
    API --> Creator
    Cases --> Pers
    Search --> Pers
    Replies --> Pers
    Pers --> FS
```

**Module boundaries (from `lib/`):**

| Module | Responsibility |
|--------|----------------|
| `persistence.ts` | Resolve `PORTAL_DATA_ROOT`, provide `readCases` / `writeCases` / `mutateCases` / `readReplies`, atomic-write helper, in-process mutex. |
| `cases.ts` | CRUD for cases; attachment storage; `getSalesRecordNo` read-compat shim. |
| `search.ts` | Deterministic scoring (see `design.md`). |
| `keywords.ts` | Utility for keyword deduping / normalisation. |
| `account.ts`, `creator.ts` | Enum guards + the `getCurrentCreator(request)` helper that reads `X-Portal-User`. |
| `replies.ts` | Thin wrapper over `readReplies`. |
| `api-path.ts` | Prefixes `/customer-service` to every `fetch` URL. Page links use `next/link` which handles basePath natively, but raw fetch / `<img src>` must use `apiPath` / `appPath`. |
| `types.ts` | All DTOs — `Account`, `Creator`, `Message`, `Attachment`, `CustomerInfo`, `CustomerCase`, `StandardReply`, `CasePatch`, `SearchResult`. |

## Level 3 — Component (inside `lib/cases.ts`)

```mermaid
flowchart TB
    Req[POST /api/cases<br/>route handler]
    Valid[Validate payload<br/>isAccount / isCreator<br/>missing fields check]
    CC[createCase]
    MC[mutateCases]
    Lock[withCasesLock<br/>serialise RMW]
    Read[readCases]
    NextId[nextId]
    Build[build CustomerCase<br/>id + createdAt + updatedAt]
    Write[writeCases → atomicWriteJson]

    Req --> Valid --> CC
    CC --> MC
    MC --> Lock
    Lock --> Read
    Read --> NextId
    NextId --> Build
    Build --> Write
```

**Invariant:** every path that writes `cases.json` goes through `mutateCases`, which acquires `withCasesLock` and calls `atomicWriteJson`. This is the ONE rule that guarantees no lost updates + no half-written files.

## Sequence — `POST /api/cases` request

```mermaid
sequenceDiagram
    participant Browser
    participant Nginx
    participant MW as middleware.ts
    participant API as route.ts POST
    participant Cases as lib/cases.createCase
    participant Pers as lib/persistence
    participant Disk as cases.json

    Browser->>Nginx: POST /customer-service/api/cases<br/>(Cookie: portal_user=star001)
    Nginx->>MW: request with X-Portal-User: star001
    MW->>MW: isAllowedUser(star001) ? true
    MW->>API: NextResponse.next()
    API->>API: validate body (isAccount, isCreator, required fields)
    API->>Cases: createCase(payload)
    Cases->>Pers: mutateCases(mutator)
    Pers->>Pers: withCasesLock acquire
    Pers->>Disk: readFile cases.json
    Disk-->>Pers: current cases
    Pers->>Pers: mutator(cases) -> cases + new row
    Pers->>Disk: writeFile cases.json.<pid>.<ts>.tmp
    Pers->>Disk: rename tmp -> cases.json (atomic)
    Pers->>Pers: withCasesLock release
    Pers-->>Cases: updated list
    Cases-->>API: newCase
    API-->>Browser: 201 + new case JSON
```

Unauthorised variant: if `X-Portal-User` is missing or not in the allowlist, `middleware.ts` short-circuits with `401 JSON` for `/api/*` and `302 → /login?next=...` for page routes — request never reaches the API handler.

## Data Model

Source of truth: `lib/types.ts`.

```ts
type Account = 'gorble' | 'ssys' | 'ama_tktk'
type Creator = 'star001' | 'star002' | 'star003'

interface Message {
  role: 'customer' | 'agent'
  text: string
  ts: string               // ISO 8601
}

interface Attachment {
  id: string               // 'att-001' per case
  filename: string         // sanitized on-disk name, e.g. 'att-001.png'
  originalName: string     // sanitized client-provided name
  mime: string             // image/jpeg | image/png | image/webp | image/gif
  size: number             // bytes
  createdAt: string        // ISO 8601
}

interface CustomerInfo {
  name: string
  address1: string
  postcode: string
  email: string
  salesRecordNo: string    // preferred
  orderId?: string         // legacy fallback
}

interface CustomerCase {
  id: string               // 'case-001'
  customer: CustomerInfo
  account?: Account        // optional on legacy rows
  creator?: Creator        // optional on legacy rows
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

interface StandardReply {
  id: string               // 'reply-001'
  category: string
  keywords: string[]
  question: string
  reply: string
}
```

**On-disk layout:**

```
PORTAL_DATA_ROOT/
└── customer-service/
    ├── cases.json          # CustomerCase[]
    ├── replies.json        # StandardReply[] (seeded on first read)
    └── case-images/
        └── <caseId>/
            └── <attId>.<ext>
```

## Deployment topology

```mermaid
flowchart LR
    Internet((Internet))
    Nginx[Nginx<br/>443/80<br/>TLS + proxy]
    Portal[portal-system.service<br/>Gunicorn sock]
    CS[customer-service.service<br/>Next.js standalone<br/>127.0.0.1:3001]
    Listing[ama-listing-creator<br/>127.0.0.1:3002]
    Data[(/opt/portal-system/data_lake/<br/>customer-service/)]

    Internet --> Nginx
    Nginx -- / --> Portal
    Nginx -- /customer-service --> CS
    Nginx -- /apps/listing --> Listing
    CS -- PORTAL_DATA_ROOT --> Data
    Portal -- PORTAL_DATA_ROOT --> Data
```

- **Process model:** one `next start` process bound to `127.0.0.1:3001`, managed by `customer-service.service` systemd unit. Single process is load-bearing — the in-process mutex in `persistence.ts` only works because there's exactly one Node process.
- **basePath:** `/customer-service` set in `next.config.ts`. Nginx `location /customer-service/ { proxy_pass http://127.0.0.1:3001; }` keeps the path intact.
- **Data root:** `PORTAL_DATA_ROOT=/opt/portal-system/data_lake` (same env the Python portal uses). CS namespaces its files under the `customer-service/` subdir so other services don't collide.
- **SSO:** nginx sets `proxy_set_header X-Portal-User $cookie_portal_user;` before forwarding to port 3001. Middleware verifies against a hard-coded allowlist.
- **Deploy pipeline:** `.github/workflows/deploy.yml` on the `customer-service` submodule SSHes to VPS, `git pull`, `npm ci`, `npm run build`, `systemctl restart customer-service`.
