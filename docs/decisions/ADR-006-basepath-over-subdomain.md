# ADR-006: basePath /customer-service via Next.js config (not subdomain split)

**Date:** 2026-04-09
**Status:** Accepted

## Context

CS runs alongside the portal Flask app and `ama-listing-creator`. We need a URL routing scheme. Two options: subdomain split (`cs.ordercleaner.twinkletwinkle.uk`) or path prefix on the same host (`ordercleaner.twinkletwinkle.uk/customer-service`).

## Decision

Path prefix. Set `basePath: "/customer-service"` in `next.config.ts`. Nginx routes `/customer-service/` to `127.0.0.1:3001`. All links, API routes, and static assets inherit the prefix automatically via Next's routing; raw `fetch()` and `<img src>` calls use the `apiPath()` / `appPath()` helpers in `lib/api-path.ts`.

## Consequences

**Positive:**
- **Single SSL certificate.** One Let's Encrypt cert covers everything under `ordercleaner.twinkletwinkle.uk` — no wildcard needed, no extra cert to rotate.
- **Single nginx vhost.** One `server { ... }` block, three `location` routes — simpler config, easier to reason about, fewer chances of misconfigured headers (critical given ADR-002 relies on nginx for auth).
- **Same-origin cookies.** The portal's `portal_user` cookie works for CS automatically — no cross-subdomain cookie pinning.
- **Same-origin fetch.** No CORS config in CS at all.

**Negative:**
- Every fetch URL in CS frontend code must remember the prefix. Mitigated by `apiPath()` helper — if someone writes `fetch('/api/cases')` by hand they'll hit a 404 (middleware routes `/api/*` without the prefix to the 401 path).
- If we ever split apps to a per-app CDN, the prefix is baked into links — migration cost. Acceptable trade.

## Alternatives considered

- **Subdomain (`cs.ordercleaner.twinkletwinkle.uk`).** Extra DNS record, extra TLS cert (or wildcard + DNS-01 ACME), cross-subdomain cookie semantics to get right for the portal SSO. No offsetting benefit.
- **Separate domain.** Same as subdomain, worse.
- **No basePath; port-based in dev only.** Makes dev behave differently from prod — bug source.
