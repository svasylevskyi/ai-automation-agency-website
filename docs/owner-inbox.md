# Live enquiries and owner workspace

## Result and scope

The Orbit website now accepts and stores enquiries. A sole owner can sign in, review a paginated/filterable inbox, update statuses and private notes, delete an enquiry deliberately, retry failed email notifications, and change the public name/logo/contact details. Drafts are untouched. No hosting or DNS changes are included.

The website has moved from static export to a Next.js Node server with PostgreSQL. Better Auth supplies password hashing, database sessions and cookie authentication; Nodemailer handles SMTP. The project pins these dependencies in the lockfile. There are no public registration endpoints or default owner credentials.

## Data flow

1. The public form obtains a signed, expiring challenge. The server validates origin, size, fields, data-use acknowledgement, honeypot and minimum form age.
2. Database-backed limits cap new submissions per client and email. By default, forwarded IP headers are ignored and the local instance shares a client bucket.
3. The enquiry is stored with a unique submission ID. Repeating the same signed submission after a lost response does not create another record.
4. A post-response task attempts an owner email with a private inbox link. The message itself and contact details stay out of notification emails.
5. Notification status and attempts are persisted. A failed or interrupted attempt can be retried manually or with `npm run maintenance`. A send interrupted between SMTP acceptance and the database update can deliver twice; delivery is at least once.
6. Every private page and API mutation checks an authenticated session against the single owner record. Status, notes and settings updates use version checks to avoid silently overwriting another tab's edits.

## Security boundaries

- Owner provisioning and password resets run only through a trusted terminal, with a masked password prompt. Reset revokes sessions.
- The public auth HTTP wrapper exposes only sign-in, sign-out and session retrieval. Sign-up and other auth routes return 404. The separate owner-only password endpoint validates the current/new/confirmed passwords, applies per-owner throttling, and delegates password verification, hashing and session rotation to Better Auth. Other sessions are always revoked.
- Mutations require the exact configured Origin. Authentication and uploads have persistent limits; sessions use HTTP-only SameSite cookies, Secure when the origin is HTTPS, with a 12-hour lifetime.
- Runtime config rejects non-HTTPS public origins. Localhost HTTP is supported for Windows review.
- Raw database/SMTP errors and submitted private content are not returned in API errors or logged by application error handlers.
- SQL uses parameters; text is rendered through React escaping. No rich HTML rendering is used for enquiries/notes.
- Upload size and decoded pixel count are capped. PNG/JPEG/WebP are decoded and re-encoded to PNG. Uploaded assets have immutable URLs. SVG/HTML are not accepted.
- Public pages contain only public settings; admin metadata is noindex and private responses are dynamic. The entire site defaults to noindex until explicitly enabled.
- `TRUSTED_IP_HEADER` must remain blank unless a reverse proxy overwrites that exact header and direct access to the Node service is blocked. Otherwise an attacker can spoof client limits.

## Operations and limits

- PostgreSQL stores enquiries, owner/session data, settings and logo bytes. Persist and back up the database; no upload folder needs separate backup.
- Versioned app migrations have checksums and advisory locks. Better Auth's schema migration runs programmatically from the pinned dependency. Review generated/schema changes before any future auth upgrade.
- The current notification mechanism uses post-response processing with stored status and recovery, not a separate worker queue. Run maintenance periodically in production for recovery and expired limit/session cleanup.
- Only one owner is supported. No roles, CRM sync, bulk export, editorial CMS, analytics or owner email-change UI is included.
- Old uploaded logos are retained, which avoids breaking existing immutable URLs. They are public assets; only upload public branding.
- The form includes a concise explanation of enquiry data use and an optional privacy-notice link. Final business identity, public contact information, retention policy and full privacy notice remain launch preparation work.
- Pagination is 20 enquiries per page. Delivery timestamps are displayed in Europe/Warsaw.

## Verification

`npm run check` covers TypeScript, planner tests, validation/origin/challenge/upload tests and production compilation. `tests/integration/owner-inbox.mjs` exercises the running production server with a real PostgreSQL database and an SMTP capture service. It requires a separate database whose name ends in `_test`, and intentionally replaces test owner/enquiry data.

Local validation passed 10 unit/security tests and 47 HTTP/database assertions using PostgreSQL 18 and an SMTP capture service. Chromium successfully submitted a live test enquiry; server-rendered layout snapshots were reviewed at 320px, 375px and 1280px. Windows, Firefox, Safari and physical-device checks remain unverified.

The GitHub workflow creates an isolated PostgreSQL 17 service and Mailpit, migrates twice to check repeatability, runs checks, starts the production server and runs integration assertions. It does not deploy.

## Hetzner follow-up

Prepare a dedicated server/container process, database persistence/backups, HTTPS reverse proxy, secrets, verified real SMTP sender, trusted client-IP handling and a maintenance schedule. The local Compose file is not production configuration. Keep the server inaccessible from the public internet until those settings and the privacy content are ready. The former `out/` web-root instructions no longer apply.
