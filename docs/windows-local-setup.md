# Running the Orbit website locally on Windows

This setup runs the Next.js website directly on Windows and uses Docker for PostgreSQL and Mailpit. It does not change DNS, configure Hetzner, or send real emails.

## 1. Install prerequisites

- [Git for Windows](https://git-scm.com/downloads/win).
- [Node.js 24 LTS](https://nodejs.org/en/download). Use the Windows installer, which includes npm.
- [Docker Desktop for Windows](https://docs.docker.com/desktop/setup/install/windows-install/), using WSL 2 and Linux containers. Follow the installer prompts; a reboot or virtualization/WSL setup may be required.

Start Docker Desktop and wait until its engine is running. Open a **new PowerShell window** and check:

```powershell
git --version
node --version
npm --version
docker compose version
```

If PowerShell blocks `npm.ps1`, use `npm.cmd` instead of `npm` in the commands below. No execution-policy change is needed.

## 2. Get the code

For a new checkout:

```powershell
git clone https://github.com/svasylevskyi/ai-automation-agency-website.git
cd ai-automation-agency-website
git switch feat/owner-inbox
```

For an existing checkout with no uncommitted work:

```powershell
cd C:\path\to\ai-automation-agency-website
git fetch origin
git switch feat/owner-inbox
git pull --ff-only
```

If you have your own uncommitted changes, commit or stash them first. After this PR is merged, use `git switch main` and `git pull --ff-only` instead.

## 3. Install and configure

```powershell
npm ci
npm run setup:local
```

The setup command creates `.env.local` from `.env.example` and generates a random authentication secret. It will not overwrite an existing file. Keep it private and out of Git. The defaults match the local Docker services; you do not need a real SMTP provider.

## 4. Start the database and local email inbox

```powershell
docker compose up -d
docker compose ps
```

Wait until the `db` service is healthy, then:

```powershell
npm run db:migrate
npm run owner:create
```

Enter your own owner email and password when prompted. The password must be 12–128 characters. It is masked during entry and stored as a hash. You will repeat it for confirmation. There is one owner account and no public registration.

Migrations are safe to run again; they do not clear enquiries or overwrite your settings.

## 5. Start the website

```powershell
npm run dev
```

Keep this terminal running. Open:

| Location                               | URL                         |
| -------------------------------------- | --------------------------- |
| Website                                | http://localhost:3000       |
| Owner sign-in                          | http://localhost:3000/admin |
| Mailpit, for local notification emails | http://localhost:8025       |

Use **localhost**, not a LAN address or `127.0.0.1` in the browser; authentication and mutation requests validate the configured `APP_URL` origin. The server binds to localhost and is intended for review on this computer.

## 6. Try the complete flow

1. On the website, scroll to **Let’s talk**, enter a sample enquiry and submit it.
2. Sign in at `/admin`. The enquiry should appear with **New** status.
3. Open it, add private notes, change its status and save.
4. Open Mailpit at port 8025. The owner notification links to the saved enquiry and does not include its message/contact details.
5. In **Settings**, change the provisional name or upload a PNG/JPEG/WebP logo (maximum 2 MB), then save. Reload the website to see the identity and metadata update.
6. Sign out and verify the inbox asks you to sign in again.

The default addresses ending in `example.test` are test addresses. Mailpit intercepts notifications, so no real message leaves your machine. Notification email recipients are configured with `NOTIFICATION_EMAIL` in `.env.local`; the **public email** in website settings is independent.

## Everyday use

Next time, start Docker Desktop, then run these from the repository:

```powershell
docker compose up -d
npm run dev
```

To stop, press **Ctrl+C** in the website terminal, then optionally:

```powershell
docker compose stop
```

`docker compose down` also preserves the named PostgreSQL volume. **Do not add `-v` unless you intend to permanently delete the local database**, including your owner account, enquiries and settings. Mailpit's captured messages are temporary and are not part of the database backup.

To test the optimized production version, first stop the development server:

```powershell
npm run check
npm start
```

Open the same localhost URLs. The build no longer creates a standalone static website in `out/`; the Node server and database are required.

## Password recovery and notifications

If you know your current password, open **Admin → Account** to change it. Other sessions are signed out.

If you have forgotten it, reset the existing owner's password from your terminal using the same owner email:

```powershell
npm run owner:create -- --reset-password
```

All existing sessions are revoked. Run this only from a trusted local/server terminal. Do not delete the database to recover a password.

If a notification fails, its enquiry remains saved. Open the enquiry and choose **Retry notification**, or run:

```powershell
npm run maintenance
```

This also removes expired request limits/sessions. The admin inbox is the source of truth; an SMTP outage does not remove submissions.

## Troubleshooting

| Symptom                          | Fix                                                                                                                                               |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm.ps1 cannot be loaded`       | Run `npm.cmd ci`, `npm.cmd run dev`, etc.                                                                                                         |
| Docker engine not available      | Open Docker Desktop, confirm Linux containers and wait for the engine.                                                                            |
| Database connection refused      | Check `docker compose ps`; wait for `db` to be healthy and confirm port 5432 is free.                                                             |
| Port 5432 already in use         | Change the host mapping to `127.0.0.1:5433:5432` in `compose.yaml`, change `DATABASE_URL` to port 5433 in `.env.local`, and restart Compose.      |
| Port 3000 already in use         | Stop the other app, or set `APP_URL=http://localhost:3001` in `.env.local` and run `npm run dev -- --port 3001`. Open localhost:3001.             |
| Missing table / owner page fails | Run `npm run db:migrate` after starting the database.                                                                                             |
| Sign-in fails                    | Check credentials, use localhost, and allow time for the attempt limit (up to 15 minutes). Reset with the terminal command if needed.             |
| Form says origin is not allowed  | Ensure browser origin exactly matches `APP_URL`, including port. Restart Next after editing environment values.                                   |
| SMTP failed                      | Confirm Mailpit runs and ports match `.env.local`; retry from the saved enquiry.                                                                  |
| Too many submissions             | The local instance shares a request limit: up to five new submissions per 15 minutes, and three per email per hour. Wait for the limit to expire. |
| Old styles/build problems        | Stop Next, delete only `.next` with `Remove-Item -Recurse -Force .next`, and restart. This does not remove database records.                      |

The development credentials in `compose.yaml` are deliberately local and bound to `127.0.0.1`. Hetzner deployment, real email delivery, HTTPS and production secrets are a separate next step.
