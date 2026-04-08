# WORKLOG

Last updated: 2026-04-08

## Current status

- `customer-service` remains an independent app with its own repository and VPS deployment.
- Portal entry is available through `/apps`.
- Path handling was adjusted so the app can connect back to `portal-system` shared data instead of relying on fragile relative paths.

## Changes completed recently

- The app was renamed from `support-system` to `customer-service`.
- Independent GitHub repository and VPS deployment were set up.
- Shared data-path integration was repaired using explicit runtime configuration.
- `Customer Service` is live under the portal app hub.

## Next likely work

- Continue product-level feature work inside the app itself.
- Keep the integration boundary with `portal-system` explicit and stable.
- Re-check any API route that still assumes local file layout instead of shared data contracts.

## Risks / notes

- This app has its own repository and deploy lifecycle, so changes may drift if not documented here.
- The app is deployed and reachable, but future functionality work is still expected.
- Any shared data read/write logic should be validated against live VPS paths before deploy.

## Important references

- `apps/customer-service/lib/sharedPortal.ts`
- `apps/customer-service/deploy/customer-service.service`
- `PROJECT_STATUS.md`
