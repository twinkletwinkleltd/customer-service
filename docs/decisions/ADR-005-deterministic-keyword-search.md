# ADR-005: Keyword search with deterministic scoring (no embeddings)

**Date:** 2026-04-09
**Status:** Accepted

## Context

Reps want to find prior cases that match a new complaint. "Find me the case about the bent lens on a `R140_Black_225`." Two search technology families are on the table: (a) classical keyword / BM25, (b) vector embeddings via an external model API.

## Decision

Use the deterministic scorer in `lib/search.ts`. Per-candidate, per-term scoring:

- issue body match: `+3` per term
- customer message match: `+2` per term
- keywords / category / resolution / standardSku / account / salesRecordNo match: `+1` per term
- same SKU as `skuHint`: `+4` (once)
- same account as `accountHint`: `+2` (once)
- resolved-case bonus: `+1` (once, only if the candidate already scored > 0)

Tie-break by `updatedAt` desc. Return top 5 across cases + replies.

Terms are split on whitespace and filtered to length `>= 2`.

## Consequences

**Positive:**
- Explainable. A rep can ask "why did this case rank first?" and the answer is a short arithmetic derivation.
- Deterministic. Same query + same data = same ranking. No embedding drift, no model version surprises.
- No external API dependency — no cost, no latency, no data-exfiltration concern.
- Implemented in ~100 lines of TS. Easy to evolve: weights are constants in one file.
- Fast: full scan of 500 cases is sub-millisecond on the VPS.

**Negative:**
- No semantic matching. "cracked" won't match "broken" unless both words appear in the text. Acceptable because reps in practice use a small, shared vocabulary for defects.
- No stemming or synonym expansion. Could be added as a pre-processing pass if needed.
- Weights are hand-tuned; no evaluation harness.

## Alternatives considered

- **OpenAI / Cohere embeddings + cosine sim.** Recurring API cost, external dependency for an internal tool, data leaves the VPS, ranking becomes opaque when reps ask "why this?" Over-engineered for 500-3000 cases.
- **Local embedding model (`all-MiniLM`).** Runs, but drags in a ~100 MB model file and a Python or ONNX runtime. Not worth it for current volume.
- **Full-text index (SQLite FTS5).** Would work, but gets us nothing over the current scorer until the collection is 10x larger. Revisit alongside ADR-001 if we outgrow JSON.

Re-evaluate if reps complain that phrasing variations miss relevant cases, or once the case set crosses ~5000.
