# ADR-007: Attachment storage on filesystem (not blob field in JSON)

**Date:** 2026-04-09
**Status:** Accepted

## Context

Cases can have image attachments (evidence photos of damaged products, up to 5 MB each, multiple per case). We could base64-encode them inside `cases.json`, keep them as separate files on disk, or put them in object storage.

## Decision

Store binary bytes on the local filesystem under
`PORTAL_DATA_ROOT/customer-service/case-images/<caseId>/<attId>.<ext>`.
Only attachment **metadata** (id, filename, originalName, mime, size, createdAt) lives inside `cases.json` on the `CustomerCase.attachments[]` array.

The `GET` route streams the file with the correct `Content-Type`, `Content-Length`, and `Cache-Control: private, max-age=0, must-revalidate` so the browser can cache per-request but revalidate on reload.

## Consequences

**Positive:**
- **Small `cases.json`.** Stays in the tens of KB, parses fast, diffs cleanly. Base64-inlined a single 5 MB image adds ~6.7 MB text to every read of every case.
- **Browser caching works.** A `<img src={apiPath(...)} />` pointing at the stream endpoint benefits from HTTP caching. Inlined base64 inside JSON doesn't — it re-downloads on every case load.
- **Straightforward backup story.** `rsync -a case-images/` just works.
- **Easy deletion.** `deleteCase` does `fs.rm -r <imagesDir>` best-effort after removing the JSON row.
- **Same-filesystem atomicity.** Image writes and JSON writes share a filesystem root — crash-safe semantics compose.

**Negative:**
- Metadata and bytes can drift. Example: a disk rm while the Node process is down leaves dangling `Attachment` rows. Mitigated by `GET /attachments/[attId]` returning 404 on missing file and `addAttachment` cleaning up orphan files if the lock-update step fails.
- Not portable to a serverless deploy without swapping storage. Acceptable — we run on a long-lived VPS.
- Multiple CS replicas (if we ever had them) would need to share a filesystem. Same caveat as ADR-003.

## Alternatives considered

- **Base64 inside JSON.** Bloats `cases.json`, kills browser caching, kills diff tooling. No.
- **S3 / object storage.** Overkill; adds credentials management, outbound bandwidth cost, and a new failure mode (object store down). Reconsider only if we move off a single VPS.
- **Dedicated images DB table.** Makes sense alongside a SQLite migration, not before.
