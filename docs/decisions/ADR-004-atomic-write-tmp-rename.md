# ADR-004: Atomic write with .tmp + rename

**Date:** 2026-04-09
**Status:** Accepted

## Context

`fs.writeFile(path, data)` is not atomic. If the process is killed mid-write (OOM, `systemctl stop` at a bad moment, VPS reboot), `cases.json` can be left truncated or half-written. On next read, `JSON.parse` throws and the whole CS app is dead until someone restores from backup.

## Decision

Implement `atomicWriteJson(file, data)`:

```ts
const tmp = `${file}.${process.pid}.${Date.now()}.tmp`
await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8')
await fs.rename(tmp, file)
```

`fs.rename` is atomic on POSIX and on Windows when both paths share a filesystem. Readers either see the old file or the new file — never a torn file. If the process dies between `writeFile(tmp)` and `rename`, `cases.json` is untouched and a stray `.tmp` file is left behind (harmless; could be cleaned by a cron if they ever accumulated, which so far they haven't).

## Consequences

**Positive:**
- Crash safety with zero dependencies. No `fsync` gymnastics needed in userland — the kernel handles rename atomicity.
- Simple rollback on error: the old file is still the truth.
- Plays well with backup tools that snapshot the data dir — they never grab a half-written JSON.

**Negative:**
- Writes cost ~2x I/O (write tmp + rename). Negligible at our volume.
- Requires tmp file on the same filesystem as the target. True for our layout; would break if we ever split `case-images/` to a network mount while keeping `cases.json` local with cross-mount tmp. Today they're colocated.

## Alternatives considered

- **`fs.writeFile` direct.** Not crash-safe.
- **`proper-lockfile` with atomic option.** Extra dep; the kernel already gives us atomic rename.
- **Append-only log + rebuild on load.** More durable but far more code and a recovery story we don't need.
