# Customer Service

Internal case-tracking + keyword-search tool for Twinkle Twinkle Ltd support reps.
Lives under `ordercleaner.twinkletwinkle.uk/customer-service/`, mounted as a
standalone Next.js 16.2 app on port `3001` behind the portal's nginx.

Users: the four portal users (`star000..star003`). Anyone else is blocked at
the middleware layer (see `middleware.ts` + ADR-002).

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000/customer-service

# build for production
npm run build
npm run start      # http://localhost:3000/customer-service
```

Local dev bypasses the SSO check when `NEXT_PUBLIC_DEV_BYPASS_AUTH=true` is
set in `.env.local`. Without that flag the app redirects everything to
`/login` because the `X-Portal-User` header nginx injects in prod isn't
present locally.

Data lands under `PORTAL_DATA_ROOT/customer-service/`:

```
cases.json          # CustomerCase[]
replies.json        # StandardReply[] (auto-seeded on first read)
case-images/<caseId>/<attId>.<ext>
```

If `PORTAL_DATA_ROOT` is unset, `lib/persistence.ts` falls back to the shared
portal default and finally to `./data` in the repo.

## Where to read more

- [`docs/product.md`](docs/product.md) — what CS is, who uses it, what it
  deliberately doesn't do.
- [`docs/architecture.md`](docs/architecture.md) — C4 context / container /
  component diagrams + sequence diagram + deployment topology.
- [`docs/design.md`](docs/design.md) — full API schema, HTTP status code map,
  auth, validation caps, performance budget, persistence model.
- [`docs/decisions/`](docs/decisions/) — 7 ADRs covering every non-obvious
  design call (JSON over SQLite, passive auth header, in-process mutex,
  atomic tmp+rename, deterministic search, basePath, filesystem attachments).

## Deploy

Deploys are automated via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml):

1. Push to `main` on this submodule.
2. GitHub Actions SSHes to the VPS.
3. VPS runs `git pull` in `/opt/portal-system/apps/customer-service/`,
   `npm ci`, `npm run build`, and `systemctl restart customer-service`.
4. Next.js serves in standalone mode on `127.0.0.1:3001`; nginx proxies
   `/customer-service/*` through.

The deploy shape matches `ama-listing-creator`: one systemd unit per app,
nginx `location` block per app, shared `PORTAL_DATA_ROOT`, basePath baked
into `next.config.ts`.
