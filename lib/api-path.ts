// lib/api-path.ts
//
// Helpers to build URLs that respect the Next.js `basePath` configured in
// `next.config.ts`. Next.js rewrites `<Link href>` and `router.push()` so
// they automatically include the basePath, but raw `fetch()` calls and
// `<img src>` URLs do not — they must be prefixed manually.
//
// Use:
//   fetch(apiPath('/cases'))                        -> /customer-service/api/cases
//   fetch(apiPath(`/cases/${id}/attachments`))      -> /customer-service/api/cases/.../attachments
//   <img src={apiPath(`/cases/${id}/attachments/${a.id}`)} />

const BASE = '/customer-service';

export const apiPath = (path: string) =>
  `${BASE}/api${path.startsWith('/') ? path : '/' + path}`;

export const appPath = (path: string) =>
  `${BASE}${path.startsWith('/') ? path : '/' + path}`;
