# Customer Service — Product Doc

Last updated: 2026-04-17

## 一句话 / One-liner

Customer Service (CS) is the portal's internal case-tracking + keyword-search assistant that lets Twinkle Twinkle support reps log a customer complaint, attach the evidence photo, search past cases + standard replies, and resolve the ticket — all in one Next.js app pinned to the portal SSO.

## 用户 / Users

| Role | Scenario | Pain point without CS |
|------|----------|------------------------|
| Customer service rep (`star001`, `star002`, `star003`) | Inbox ping: "my reading glasses arrived bent". Needs to log the case, attach the photo, find the past resolution for the same SKU, type a reply. | Juggles Excel sheets, Google Photos, Outlook drafts. No way to know if this exact complaint was solved three weeks ago. |
| Admin (`star000`) | Reviews resolved cases, cleans up the standard-reply library, spots recurring defect clusters across accounts. | Has no single queryable place where all three accounts' complaints land — has to scroll through every rep's private sheet. |
| Search assistant user (same reps, search-mode) | While typing a new case, wants "show me prior cases with the same SKU + same account so I don't re-solve a solved problem." | Manually greps old emails and guesses wording. Never finds the useful prior resolution. |

## 问题 / Problem

Today, customer complaints live in:
- Ad-hoc Excel sheets ("`complaints_Q1.xlsx`") — one per rep, never merged.
- Outlook inboxes — evidence photos buried as attachments in threads.
- Tribal memory — "I think `star002` handled a similar Ama-TKTK case last month, ask her."

Consequences: duplicated work, no retrieval, inconsistent replies across reps, and no data to surface repeat-defect SKUs to the operations team.

## 核心价值主张 / Core Value Proposition

| Dimension | Manual (spreadsheets + email) | Customer Service (CS) |
|-----------|-------------------------------|-----------------------|
| Speed to log a case | 3–5 min (open sheet, copy address, find the image, paste) | ~60 s (one form, drag-drop image) |
| Search across history | None — reps rely on memory | Deterministic keyword search with SKU + account boost |
| Accuracy of SKU linkage | Free-text; same product typed 5 ways | Bound to `standardSku` (same ID the inventory service uses) |
| Attachments | Scattered across email threads | Stored on disk under `case-images/<caseId>/` with MIME + size validation |
| Availability | Whoever has the sheet open | 24-7 via portal SSO from any browser |
| Auditability | None | `createdAt` / `updatedAt` per case, atomic JSON writes, in-process mutex |

## 功能 / MVP Features

- Create / view / edit / delete a case with structured fields: customer info, account, creator, standard SKU, category, keywords, issue description, resolution, status (open / resolved), free-form conversation (customer ↔ agent turns).
- Attach up to 5 MB per image (jpg / jpeg / png / webp / gif), stored on disk, streamed back with proper MIME.
- Keyword-enhanced search across all cases + standard replies, with SKU hint + account hint boosts (see `lib/search.ts`).
- Standard reply library seeded with 10 canned responses for common scenarios (shipping, refund, product fault, billing, account).
- Portal SSO: the rep must already be logged into the portal; nginx forwards `X-Portal-User`, CS enforces a 4-user allowlist.

## 不做的事 / Non-Goals

- **Not a CRM.** No lead scoring, no marketing automation, no contact timeline beyond order-line lookups (that lives in `services/customer-db/`).
- **Not a ticketing system like Zendesk / Freshdesk.** No SLA timers, no escalation workflow, no shared queue with claim/assign semantics.
- **No automated email reply.** CS surfaces the suggested reply; a human copy-pastes it into the platform's native messaging (eBay / Amazon). No outbound SMTP.
- **No SLA tracking.** We don't measure first-response-time or resolution-time against a target.
- **No multi-tenant.** One company, four users, hard-coded allowlist.

## 定价 / Pricing

Internal tool. Zero marginal cost. Runs on the same VPS as the rest of the portal. No per-seat licensing.

## 竞品 / Competitive Landscape

| Tool | Fit for TwinkleTwinkle | Why not |
|------|-------------------------|---------|
| Zendesk | Over-powered; ~£49/agent/month minimum | SLA engine, multi-channel queue, macros — none of which we need. Lock-in + recurring cost for 3 reps doesn't pay. |
| Freshdesk | Cheaper tier exists | Still external SaaS, still requires exporting customer PII to a third party, still no native link to our `standardSku` / inventory data. |
| **CS (this app)** | — | Zero cost, tied to portal SSO, integrates directly with portal data model (`standardSku`, `account`, `creator` values), deploys via the same GitHub Actions pipeline as the rest of `portal-system`. |

CS positioning: **a zero-cost internal tool tied to the portal** — not a Zendesk competitor. If we ever grow past ~5 reps or need SLA tracking, re-evaluate.
