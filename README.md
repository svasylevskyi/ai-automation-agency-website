# AI Automation Agency — Orbit website

A responsive, founder-led agency website built with Next.js, TypeScript and Tailwind. Orbit remains the visual direction; the name and logo are editable placeholders. All five reference concepts remain unchanged in [`drafts/`](drafts/index.html).

The website now includes live enquiry capture, PostgreSQL storage, owner email notifications, a protected owner inbox with notes/statuses, and editable branding/contact settings. It runs as a **Node server**, not a static export.

## Run locally on Windows

Full instructions and troubleshooting: **[Windows local setup](docs/windows-local-setup.md)**.

Install Node.js **24 LTS**, Git for Windows, and Docker Desktop with the WSL 2 backend and Linux containers. Start Docker Desktop, then in PowerShell:

```powershell
git clone https://github.com/svasylevskyi/ai-automation-agency-website.git
cd ai-automation-agency-website
git switch feat/owner-inbox
npm ci
npm run setup:local
docker compose up -d
npm run db:migrate
npm run owner:create
npm run dev
```

Use `main` instead of the feature branch after the PR is merged. `owner:create` prompts for your email and a password (minimum 12 characters); there are no default owner credentials.

- Website: http://localhost:3000
- Owner area: http://localhost:3000/admin
- Local notification inbox: http://localhost:8025

Mailpit captures outgoing emails locally; nothing is sent to a real email address. PostgreSQL data is retained in a Docker volume. `.env.local` is ignored by Git and generated with a unique auth secret. Re-running `setup:local` leaves an existing file untouched.

## Commands

| Command                                    | Purpose                                                                                       |
| ------------------------------------------ | --------------------------------------------------------------------------------------------- |
| `npm run dev`                              | Development server, localhost only                                                            |
| `npm run build` / `npm start`              | Build and run the production server locally                                                   |
| `npm run check`                            | TypeScript, unit/security tests and production build                                          |
| `npm run db:migrate`                       | Apply auth schema and checked, versioned application migrations; preserve existing data       |
| `npm run owner:create`                     | Create the single owner interactively                                                         |
| `npm run owner:create -- --reset-password` | Reset the existing owner's password using the same email; invalidate all sessions             |
| `npm run maintenance`                      | Retry up to 100 pending/failed/stale notifications and remove expired request limits/sessions |

Use **Owner area → Account** to change your password with the current password. Other sessions are revoked; the current session is rotated. The admin area has no public registration, invitation or email password-reset endpoint. Forgotten-password recovery requires local/server terminal access. Notification delivery is attempted after saving each enquiry; the inbox shows delivery state and provides a retry action. Run maintenance periodically in a future deployment. SMTP delivery is at least once: an interrupted send can result in a duplicate notification, but not a lost enquiry.

## Branding and settings

Open **Owner area → Settings** to update the agency name, tagline, search/sharing description, logo, public email, booking URL and privacy notice URL. These changes apply on the next page load without a rebuild. Logos are limited to 2 MB PNG/JPEG/WebP, decoded and re-encoded as PNG, and stored in PostgreSQL; SVG uploads are rejected. Save settings after upload to publish the logo. A checkbox supports logos that already include the agency name.

[`src/config/brand.ts`](src/config/brand.ts) supplies initial defaults and founder details. Once migrated, database settings are authoritative; editing those defaults will not overwrite saved settings. Original drafts retain their historical identity. The public email and server-side notification recipient are separate settings.

## Structure

- `src/app/`: Orbit public site, admin pages and API routes.
- `src/components/`: Shared branding, navigation, enquiry/planning tools and owner forms.
- `src/server/`: Database, auth, mail, rate limits, uploads and owner provisioning.
- `src/lib/`: Shared validation and workflow recommendation logic.
- `migrations/`, `scripts/`: Database lifecycle and local owner setup.
- `tests/`: Unit/security tests and opt-in database/HTTP integration tests.
- `compose.yaml`: Local PostgreSQL and Mailpit only.
- `docs/`: Local setup, architecture, scope and historical design decisions.

## Deployment boundary

Nothing is deployed by this increment. The previous `out/` static-hosting instructions are superseded. Production needs the Next.js server, PostgreSQL, HTTPS, a configured SMTP provider, backups and scheduled maintenance. `compose.yaml` uses local-only development credentials and must not be used unchanged as a production deployment. Keep `INDEX_SITE=false` until the domain, public contact information and privacy notice are ready.

See [owner inbox implementation](docs/owner-inbox.md) for security controls, tests and deployment follow-ups. The [original Orbit implementation](docs/orbit-implementation.md) and [hosting comparison](docs/hosting-and-rollout.md) describe earlier decisions, not the current runtime.
