# AI Automation Agency — Orbit website

A responsive, founder-led agency website built with Next.js, TypeScript and Tailwind. Orbit remains the visual direction; the name and logo are editable placeholders. All five reference concepts remain unchanged in [`drafts/`](drafts/index.html).

The website includes an optional guided workflow assessment with a transferable enquiry brief, live enquiry capture, PostgreSQL storage, owner email notifications, a protected owner inbox with notes/statuses, and editable branding/contact settings. It runs as a **Node server**, not a static export.

## Run locally on Windows

Full instructions and troubleshooting: **[Windows local setup](docs/windows-local-setup.md)**.

Install Node.js **24 LTS**, Git for Windows, and Docker Desktop with the WSL 2 backend and Linux containers. Start Docker Desktop, then in PowerShell:

```powershell
git clone https://github.com/svasylevskyi/ai-automation-agency-website.git
cd ai-automation-agency-website
git switch main
npm ci
npm run setup:local
docker compose up -d
npm run db:migrate
npm run owner:create
npm run dev
```

`owner:create` prompts for your email and a password (minimum 12 characters); there are no default owner credentials.

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
| `npm run mail:check`                     | Read-only mail configuration, Reply-To and pending-message preflight (no email sent)            |
| `npm run maintenance`                      | Recover mail for up to 100 enquiries and remove expired request limits/sessions |

Use **Owner area → Account** to change your password with the current password. Other sessions are revoked; the current session is rotated. The admin area has no public registration, invitation or email password-reset endpoint. Forgotten-password recovery requires local/server terminal access. Owner notifications and visitor confirmations are attempted after saving each new enquiry. The inbox shows their separate delivery states and retry actions. The Hetzner maintenance timer recovers eligible attempts every five minutes, up to five automatic attempts per channel. Resend protects identical retries for 24 hours; SMTP or a retry outside that window can result in a duplicate on recovery; the saved enquiry remains available even when delivery fails.

## Guided workflow assessment

The optional three-step guide recommends a first automation opportunity, including an “Other / I’m not sure yet” route. Visitors can attach their answers to an enquiry, review/edit/remove the summary, or contact you directly. The admin enquiry detail includes the structured brief and recommendation. Answers stay in the browser until the enquiry is submitted; no external AI service is required.

See [guided assessment behavior, validation and review steps](docs/guided-assessment.md). Apply the new migration with `npm run db:migrate` when updating locally; the Hetzner deployment workflow applies it automatically.

## Enquiry follow-up

Admin opens on **Needs attention**, showing new enquiries and actions due today or overdue in Warsaw time. Add a next action and date, complete it, and review the private activity history on each enquiry. New submissions receive a generic confirmation email with an optional booking link; existing enquiries do not receive retrospective receipts. The public email is used as Reply-To. Mailpit captures both kinds of email in the test environment.

See [follow-up behavior, mail recovery and deployment review](docs/enquiry-follow-up.md).

For production, follow [Google Workspace + Resend setup](docs/email-setup.md). Set `MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `MAIL_FROM` and `NOTIFICATION_EMAIL` on the server, and the working business reply address in Owner area → Settings. Resend sends notifications/receipts; Gmail handles incoming replies and personal correspondence. Without `MAIL_PROVIDER`, the existing SMTP configuration remains in use. The website does not need Gmail credentials.

## Prospect assistant

The optional **[n8n prospect assistant](docs/prospect-assistant-setup.md)** adds a reliable queue, rule-based brief and reply draft to each enquiry's admin page. Replies remain under owner control. The guide includes a Windows pilot without Docker and an importable workflow; the integration is disabled by default.

To change a status from the inbox, tick individual enquiries or **Select all on this page**, choose a status, and click **Apply status**. Closing an enquiry clears its scheduled follow-up and cancels unfinished prospect jobs. Each change appears in the enquiry’s activity history.

The inbox shows which enquiries have completed automation. For an existing n8n workflow, follow the [manual AI-assisted reply pilot](docs/prospect-ai-replies.md) to draft a first reply and fall back to rules when a model response is unavailable.

To trigger an n8n workflow on submission, set the server-side `N8N_ENQUIRY_WEBHOOK_URL`. See the [enquiry webhook setup and exact JSON payloads](docs/enquiry-webhook.md).

## Branding and settings

Open **Owner area → Settings** to update the agency name, tagline, search/sharing description, logo, public email, booking URL and optional custom Privacy Policy URL. These changes apply on the next page load without a rebuild. Logos are limited to 2 MB PNG/JPEG/WebP, decoded and re-encoded as PNG, and stored in PostgreSQL; SVG uploads are rejected. Save settings after upload to publish the logo. A checkbox supports logos that already include the agency name.

[`src/config/brand.ts`](src/config/brand.ts) supplies initial branding defaults. Once migrated, database settings are authoritative; editing those defaults will not overwrite saved settings. Original drafts retain their historical identity. The public email and server-side notification recipient are separate settings.

## Privacy Policy and Website Terms

Built-in pages are available at `/privacy` and `/terms`, with links in the footer, guide and enquiry form. Edit each page independently under **Owner area → Settings**, using the new title/text fields and preview. Leave the custom Privacy Policy URL blank to use `/privacy`; an existing external URL still overrides the public links.

Both pages include full initial draft wording and clear placeholders for the business details and operating arrangements still to be confirmed. They are publicly visible review drafts and remain excluded from search indexing until marked ready. Saving changes updates the public page immediately; redeployment does not overwrite admin edits. See [legal page editing, field explanations and launch decisions](docs/legal-pages.md).

## Structure

- `src/app/`: Orbit public site, admin pages and API routes.
- `src/components/`: Shared branding, navigation, enquiry/planning tools and owner forms.
- `src/server/`: Database, auth, mail, rate limits, uploads and owner provisioning.
- `src/lib/`: Shared validation and workflow recommendation logic.
- `migrations/`, `scripts/`: Database lifecycle and local owner setup.
- `tests/`: Unit/security tests and opt-in database/HTTP integration tests.
- `compose.yaml`: Local PostgreSQL and Mailpit only.
- `docs/`: Local setup, architecture, scope and historical design decisions.

## Deploy to Hetzner

Follow the **[guided Hetzner setup](docs/hetzner-setup.md)** for a dedicated Ubuntu server running Node 24, PostgreSQL 17 and Caddy, without Docker. The manual **Deploy website to Hetzner** GitHub workflow tests/builds on GitHub, uploads a checked release, backs up the database, applies migrations and verifies the restarted website. Production secrets stay on the server. Nothing is deployed until the server is configured and you run the workflow from `main`.

The guide covers SSH keys, GitHub variables/secrets, HTTPS, the first owner account, scheduled maintenance, backup restore drills and recovery. Set up [encrypted R2 backups, recovery checks and enquiry retention](docs/r2-backup-setup.md) before accepting important enquiries. Automatic enquiry expiry is disabled by default; server backup helpers require one-time installation after deploying this increment. The previous `out/` static-hosting instructions are superseded. `compose.yaml` uses local-only development credentials and must not be used unchanged as a production deployment. Keep `INDEX_SITE=false` until the domain, public contact information and privacy notice are ready.

See [owner inbox implementation](docs/owner-inbox.md) for security controls, tests and deployment follow-ups. The [original Orbit implementation](docs/orbit-implementation.md) and [hosting comparison](docs/hosting-and-rollout.md) describe earlier decisions, not the current runtime.
