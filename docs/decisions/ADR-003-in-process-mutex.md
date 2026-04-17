# ADR-003: In-process mutex for cases.json

**Date:** 2026-04-09
**Status:** Accepted

## Context

Read-modify-write sequences on `cases.json` have an `await` between `fs.readFile` and `fs.writeFile`. Node is single-threaded for JS, but `await` lets the event loop run another request's handler in that window. Two concurrent `POST /cases` or `PATCH /cases/:id` could interleave:

```
Req A read  ->  Req B read  ->  A write (loses B's intended mutation)  ->  B write (overwrites A)
```

Even at low traffic, one double-click on "Save" can trigger this.

## Decision

Use a promise-chain mutex (`casesLockPromise` in `lib/persistence.ts`). Every mutation goes through `mutateCases(mutator)`, which:

1. Awaits the previous lock promise.
2. Reads `cases.json`.
3. Runs the mutator.
4. Writes atomically (see ADR-004).
5. Releases the lock.

No external lockfile dependency. Works because CS runs as exactly one Node process.

## Consequences

**Positive:**
- Zero dependencies (`proper-lockfile`, `flock`, etc.).
- Obvious, auditable code: ~15 lines in `persistence.ts`.
- Correct for the single-process deployment we have.

**Negative:**
- **Load-bearing assumption: exactly one Node process.** If we ever cluster (e.g. `pm2 -i max` or two replicas behind a load balancer), this mutex protects nothing — two processes each hold their own uncontested lock and cheerfully overwrite each other. This is flagged in a comment inside `persistence.ts` and must be re-evaluated before any horizontal scale.
- A slow mutator blocks all other writes on the cases file. Acceptable at current write rate.

## Alternatives considered

- **`proper-lockfile` / `fs-ext flock`.** Solves multi-process too. Adds a dep + a failure mode (stale lock cleanup) we don't need today.
- **Rely on filesystem atomicity alone, no mutex.** Doesn't work — atomic write protects against torn files, not against lost updates.
- **Queue writes via a single worker.** Overengineering for this volume.

Re-evaluate the moment we consider a second CS process.
