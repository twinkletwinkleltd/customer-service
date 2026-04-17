# ADR-001: Use JSON files instead of SQLite

**Date:** 2026-04-09
**Status:** Accepted

## Context

Customer Service needs durable storage for cases and standard replies. Expected volume: ~3 reps logging 5-20 cases/day. Upper bound horizon (5 years): ~30k cases. Reads are dominated by "list all + filter in memory" and search across the full set. Writes are low-rate (one human writer at a time, in practice).

We already run SQLite elsewhere in the portal (`customer-db`, `warehouse`). We could reuse that pattern.

## Decision

Store cases in a single JSON file `cases.json` and standard replies in `replies.json`, both under `PORTAL_DATA_ROOT/customer-service/`. Use atomic write + in-process mutex for consistency.

## Consequences

**Positive:**
- Trivial backup: nightly `rsync` already covers the whole `data_lake`.
- Trivial debug: `jq` / `grep` the file on the VPS, no `sqlite3` shell needed.
- Trivial to inspect in PRs: reviewers can read a checked-in fixture.
- Zero driver dependency, no migrations, no DDL drift.
- Deploys are `git pull + restart`; no "forgot to run migrations" class of bug.

**Negative:**
- Whole-file rewrite on every mutation. Fine up to ~1 MB (today: well under). Past a few tens of MB, parse + re-serialise starts to bite — re-evaluate then.
- No concurrent writers across processes (mitigated: we run one Node process).
- No indexed query — `GET /api/cases?account=ssys` is a full scan (fine at current volume).
- No relational joins (fine — we deliberately don't model relations here; relations live in `customer-db`).

## Alternatives considered

- **SQLite with better-sqlite3.** Overkill for current scale, adds a native dep that complicates `npm ci` on VPS, costs debuggability, and gains us nothing we need today.
- **LowDB / lokijs.** Another layer on top of JSON files that doesn't solve any problem we have.
- **Postgres.** Absolutely not for an internal tool with 3 users and 20 writes/day.

Re-evaluate this ADR if `cases.json` crosses ~10 MB or write rate crosses ~1 write/sec sustained.
