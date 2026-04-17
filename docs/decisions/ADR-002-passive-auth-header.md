# ADR-002: Passive auth via X-Portal-User header

**Date:** 2026-04-09
**Status:** Accepted

## Context

CS is one sibling app among several (portal Flask, ama-listing-creator, customer-service). All sit behind the same nginx, all are accessed by the same four staff users. We need "you're logged into the portal -> you're logged into CS." Running a second password store, second session cookie, or OAuth provider inside CS would be pure friction.

## Decision

CS does not own authentication. The portal Flask app owns login. Nginx forwards the portal's `portal_user` cookie value as an `X-Portal-User` request header. `middleware.ts` reads the header, checks it against a hard-coded allowlist (`star000..star003`), and either passes the request through or returns 401 (API) / 302 → `/login` (page).

There is no session table, no JWT, no token refresh. CS trusts nginx. Nginx trusts the portal cookie.

## Consequences

**Positive:**
- Zero auth code in CS beyond one middleware + an allowlist.
- One login flow across all portal apps — user doesn't log in twice.
- No token expiry bugs, no refresh loops, no "logged in here but not there."
- Local dev: one env flag (`NEXT_PUBLIC_DEV_BYPASS_AUTH=true`) disables the whole thing.

**Negative:**
- If nginx is misconfigured and forwards X-Portal-User unauthenticated from the public internet, CS is fully open. Nginx config is the security boundary — must be audited any time the reverse-proxy block is edited.
- Allowlist is hard-coded in `middleware.ts` — adding a user means a code change + deploy, not a config flip. Fine at 4 users; untenable past ~10.
- No fine-grained permissions. Every allowed user is effectively admin.

## Alternatives considered

- **Session-based auth inside CS (NextAuth / iron-session).** Doubles the login UX, needs a session store, user hits "which email am I?" confusion.
- **OAuth / OIDC via a third-party provider.** Enormous overkill for a 4-user internal tool.
- **Shared JWT signed by the portal.** Workable but adds a key-rotation story we don't need yet. Reconsider if we ever go multi-tenant.

Re-evaluate if we ever grow past the four-user allowlist or need per-user permissions beyond binary access.
