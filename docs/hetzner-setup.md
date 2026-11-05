# Hetzner setup and manual GitHub deployment

This guide targets a **new, dedicated Ubuntu 24.04 LTS x86_64 server**, with Node.js 24, PostgreSQL 17 and Caddy. Docker is not required on your Windows PC or the server. GitHub's test runner uses disposable database/mail containers internally.

The repository includes the workflow and server configuration; creating the server and entering its secrets remain setup steps. Do not run these commands on an existing shared server without adapting paths, users, ports and Caddy configuration first.

## 1. Create the server and choose its hostname

In Hetzner Console, create a server in your preferred EU location, using Ubuntu 24.04 and an **x86/AMD64** shared-vCPU plan with at least 2 vCPU and 4 GB RAM. Builds happen in GitHub. Enable IPv4. Server backups are useful in addition to the database dumps below; check the displayed price before creating it.

Add your personal SSH **public** key during creation. If needed, generate a dedicated personal key in Windows PowerShell (choose a passphrase):

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\agency_admin" -C "agency-admin"
Get-Content "$env:USERPROFILE\.ssh\agency_admin.pub"
```

Attach a Hetzner Cloud firewall allowing inbound TCP 22, 80 and 443. This guide uses public SSH with key-only authentication so ordinary GitHub-hosted runners can connect; their IPs vary. Port 22 cannot be restricted to only your home IP with this workflow. Do not expose PostgreSQL 5432 or Next.js 3000. Leave outbound traffic unrestricted for package downloads, DNS, HTTPS and your SMTP provider. A static-IP runner or private network is a later alternative.

Point a DNS **A** record (for example `agency.yourdomain.com`, or a DuckDNS hostname for initial testing) to the server's IPv4. Only add an AAAA record if IPv6 is configured and reachable. Use DNS-only mode initially if your DNS provider offers a proxy. The guide assumes Caddy is the direct internet-facing proxy.

Replace `SERVER_IP` and `agency.example.com` below. Connect from PowerShell:

```powershell
ssh -i "$env:USERPROFILE\.ssh\agency_admin" root@SERVER_IP
```

Before accepting the first SSH host key, compare its fingerprint with `ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub`, run through the Hetzner web console. Keep this SSH session open while configuring access.

## 2. Install the server dependencies

The following commands run as **root on the server**, not in PowerShell:

```bash
apt-get update
apt-get upgrade -y
apt-get install -y ca-certificates curl gnupg xz-utils git python3 sudo \
  build-essential nano openssl debian-keyring debian-archive-keyring apt-transport-https
```

Install Node 24 from the official Linux x64 distribution, checking its published checksum:

```bash
install -d -m 0700 /root/agency-node-install
cd /root/agency-node-install
curl -fsSLO https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
node_archive=$(awk '$2 ~ /^node-v24\.[0-9]+\.[0-9]+-linux-x64.tar.xz$/ {print $2}' SHASUMS256.txt)
[[ "$node_archive" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-x64.tar.xz$ ]] || exit 1
curl -fsSLO "https://nodejs.org/dist/latest-v24.x/$node_archive"
awk -v file="$node_archive" '$2 == file' SHASUMS256.txt | sha256sum --check -
tar -xJf "$node_archive" -C /usr/local --strip-components=1
node --version
npm --version
```

Stop if a command fails. The version must begin `v24.`. Repeat this checksum-verified installation when updating Node security releases; restart the website afterward.

Add the official PostgreSQL repository for Ubuntu **noble (24.04)** and install version 17:

```bash
install -d /usr/share/postgresql-common/pgdg
curl -fsS https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
cat > /etc/apt/sources.list.d/pgdg.sources <<'PGDG'
Types: deb
URIs: https://apt.postgresql.org/pub/repos/apt
Suites: noble-pgdg
Architectures: amd64
Components: main
Signed-By: /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
PGDG
apt-get update
apt-get install -y postgresql-17 postgresql-client-17
systemctl enable --now postgresql
```

Install Caddy from its official stable package repository:

```bash
curl -fsS https://dl.cloudsmith.io/public/caddy/stable/gpg.key \
  | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -fsS https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt \
  -o /etc/apt/sources.list.d/caddy-stable.list
chmod 0644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
apt-get update
apt-get install -y caddy
```

## 3. Install the reviewed server files

Merge the deployment PR first. In your server SSH session, prepare the setup directory:

```bash
install -d -m 0700 /root/agency-setup
```

On Windows, update your local checkout and copy **only** the deployment files to the server:

```powershell
git switch main
git pull --ff-only
scp -i "$env:USERPROFILE\.ssh\agency_admin" -r deploy root@SERVER_IP:/root/agency-setup/
```

Back in the root SSH session:

```bash
cd /root/agency-setup
bash deploy/install-units.sh
```

This creates `agency` (runtime) and `agency-deploy` (deployment), installs systemd units and two root-owned helper scripts, and grants only specific service-control/backup commands through sudo. Application installation, npm scripts and migrations run without root privileges. Only the runtime account can write the shared Next.js cache. `/srv/agency` holds releases; `/etc/agency` holds configuration. Reinstall these reviewed files when a later PR changes server scripts or units; deployments do not overwrite them automatically.

## 4. Create the database and production configuration

Create a database owner role with a strong unique password. `createuser` prompts without placing the password in shell history; save it in your password manager. A long hexadecimal password avoids URL-encoding issues in `DATABASE_URL`.

```bash
sudo -u postgres createuser --pwprompt --no-superuser --no-createdb --no-createrole agency
sudo -u postgres createdb --owner=agency agency
install -o root -g agency -m 0640 deploy/site.env.example /etc/agency/site.env
nano /etc/agency/site.env
```

Set every placeholder in `site.env`:

| Setting                      | Value                                                                         |
| ---------------------------- | ----------------------------------------------------------------------------- |
| `DATABASE_URL`               | `postgresql://agency:YOUR_DB_PASSWORD@127.0.0.1:5432/agency`                  |
| `APP_URL`                    | Exact HTTPS origin, e.g. `https://agency.example.com`; no trailing slash/path |
| `BETTER_AUTH_SECRET`         | Unique random secret; generate on the server using `openssl rand -hex 48`     |
| `SMTP_HOST`, `SMTP_PORT`     | Your SMTP provider's submission host/port, typically 587                      |
| `SMTP_SECURE`                | `false` for STARTTLS on 587; `true` for implicit TLS on 465                   |
| `SMTP_USER`, `SMTP_PASSWORD` | SMTP provider credentials                                                     |
| `SMTP_FROM`                  | Sender address verified with that provider                                    |
| `NOTIFICATION_EMAIL`         | Inbox where you want enquiry notifications                                    |
| `INDEX_SITE`                 | Keep `false` during testing; change to `true` when ready for indexing         |
| `TRUSTED_IP_HEADER`          | `x-agency-client-ip` with the included Caddy configuration                    |

Use plain `KEY=value` lines without `export`. Quote values containing spaces or `#` with double quotes; avoid multiline secrets. Do not commit this file or copy production credentials into GitHub. The database, auth and mail secrets are needed only on the server. Keep `BETTER_AUTH_SECRET` stable between releases. `INDEX_SITE=false` asks search engines not to index; it does **not** make the site private.

Check the local database connection without printing credentials:

```bash
(cd / && sudo -u agency /usr/local/bin/node --env-file=/etc/agency/site.env -e \
  'const u=new URL(process.env.DATABASE_URL); console.log("Database host:",u.hostname,"database:",u.pathname)')
ss -lnt | grep ':5432'
```

PostgreSQL should listen only on loopback (`127.0.0.1`/`::1`). The first deployment verifies the real connection and runs migrations. For email, use authenticated SMTP on the provider's supported submission port; do not rely on port 25 or a local development Mailpit server.

## 5. Enable HTTPS

```bash
cp deploy/Caddyfile.example /etc/caddy/Caddyfile
nano /etc/caddy/Caddyfile
# Replace agency.example.com with your DNS hostname.
caddy validate --config /etc/caddy/Caddyfile
systemctl enable --now caddy
systemctl reload caddy
```

Caddy obtains and renews HTTPS certificates once DNS points here and ports 80/443 are reachable. A 502 response before the first deployment is expected. It overwrites `X-Agency-Client-IP` with the connection's actual source; the app trusts that header for rate limits. Do not add another CDN/proxy without adjusting trusted client-IP handling.

## 6. Set up the deployment SSH key and GitHub environment

In Windows PowerShell, create a **separate** automation key. At the passphrase prompts, press Enter for this key only; GitHub cannot enter a passphrase interactively. Never overwrite an existing key:

```powershell
ssh-keygen -t ed25519 -f "$env:USERPROFILE\.ssh\agency_github" -C "agency-github-deploy"
Get-Content "$env:USERPROFILE\.ssh\agency_github.pub"
```

On the server, add that public key to `/home/agency-deploy/.ssh/authorized_keys` with `restrict` at the start of its line (SFTP used by `scp` still works; forwarding and PTY are disabled):

```bash
install -d -o agency-deploy -g agency-deploy -m 0700 /home/agency-deploy/.ssh
nano /home/agency-deploy/.ssh/authorized_keys
# One line: restrict ssh-ed25519 AAAA... agency-github-deploy
chown agency-deploy:agency-deploy /home/agency-deploy/.ssh/authorized_keys
chmod 0600 /home/agency-deploy/.ssh/authorized_keys
```

Disable password SSH login, preserving key access. Validate first, then test a **second** PowerShell session with your personal key before closing the original session:

```bash
cat > /etc/ssh/sshd_config.d/00-agency-key-only.conf <<'SSH'
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
SSH
sshd -t && systemctl reload ssh
```

Capture the server's **public host key** through your already-verified admin SSH session:

```bash
cat /etc/ssh/ssh_host_ed25519_key.pub
```

In GitHub → repository **Settings → Environments → New environment**, create `production`. Restrict deployment branches to `main` where your GitHub plan allows it. Add these environment values (repository-level Actions variables/secrets also work if environment storage is unavailable):

| Kind     | Name                 | Value                                                                                                   |
| -------- | -------------------- | ------------------------------------------------------------------------------------------------------- |
| Variable | `DEPLOY_HOST`        | Server IPv4 or SSH hostname; no `https://` (IPv6 literals are not supported by this workflow)           |
| Variable | `DEPLOY_PORT`        | `22` unless you have deliberately changed SSH                                                           |
| Variable | `SITE_URL`           | Exact public origin, e.g. `https://agency.example.com`, without trailing slash                          |
| Secret   | `DEPLOY_SSH_KEY`     | Entire contents of Windows `agency_github` private-key file, including BEGIN/END lines                  |
| Secret   | `DEPLOY_KNOWN_HOSTS` | `SERVER_IP ssh-ed25519 AAAA...` using the verified server host public key, without its trailing comment |

The host in `DEPLOY_KNOWN_HOSTS` must exactly match `DEPLOY_HOST`. For a nonstandard port use `[SERVER_IP]:PORT ssh-ed25519 AAAA...`. Copy the private key directly into GitHub's secret form; do not paste it into chat, logs or an issue. The workflow refuses unknown/changed host keys. Do not bypass that check with `StrictHostKeyChecking=no`.

For a solo-maintained repository, reviewer requirements that prohibit self-approval can block deployment. Keep the manual trigger and branch restriction; configure extra approvals only if someone else can approve. GitHub environment protection availability varies by plan/repository visibility.

## 7. First deployment and owner account

Merge the UI/password PR as well, then open **Actions → Deploy website to Hetzner → Run workflow → main**. There are no automatic deployments on push. The workflow:

1. Runs migrations twice on a disposable test database, typechecks, unit/integration tests and a production build.
2. Packages that tested build, validates archive paths, transfers it through host-key-verified SSH and checks its SHA-256 on the server.
3. Installs locked dependencies on the server, backs up the production database, applies migrations, switches the current release symlink and restarts the website.
4. Checks database health and the exact release ID locally, then checks the public HTTPS endpoint.

A failed local startup switches application files back to the previous release (or stops a failed first release). **Database migrations are not undone automatically.** A failed public check leaves the running server release in place so you can fix DNS/HTTPS. Deployments briefly interrupt requests during restart; this is a single-server setup, not zero-downtime deployment.

After a successful first deployment, create the owner interactively in the admin SSH session:

```bash
cd /srv/agency/current
sudo -u agency /usr/local/bin/node --env-file=/etc/agency/site.env --import tsx scripts/owner.ts
```

Open `https://agency.example.com/admin` and sign in. Update branding/contact links under **Settings**. After merging the password PR, use **Account** to change the password. The terminal recovery command is:

```bash
cd /srv/agency/current
sudo -u agency /usr/local/bin/node --env-file=/etc/agency/site.env --import tsx scripts/owner.ts --reset-password
```

Use the existing owner's email. Recovery invalidates all sessions. Submit one genuine test enquiry through the public form and verify both the owner inbox and notification email. Mail health is checked by that end-to-end test; `/api/health` checks application/database readiness, not SMTP delivery.

## Operations and recovery

```bash
systemctl status agency-web agency-maintenance.timer agency-backup.timer caddy --no-pager
journalctl -u agency-web -n 80 --no-pager
journalctl -u agency-maintenance -n 40 --no-pager
journalctl -u agency-backup -n 40 --no-pager
curl -fsS https://agency.example.com/api/health
```

Maintenance retries pending/failed email and cleans expired limits/sessions every five minutes. Database backups run daily around 02:30 UTC and before every deployment, in PostgreSQL custom format under `/var/lib/postgresql/agency-backups`. Each dump's catalogue is checked. A failed pre-deploy backup blocks the deployment.

**Local dumps alone do not cover server loss.** Copy encrypted backups off the server (for example to a separately secured backup destination), include an encrypted copy of `/etc/agency/site.env`, and perform a restore drill before accepting important enquiries. This increment does not configure an off-server destination. Backups and old releases are retained, with no automatic deletion; review disk usage and set retention after off-server copies are verified:

```bash
df -h /
du -sh /srv/agency/releases /var/lib/postgresql/agency-backups
```

For a restore drill, choose an actual dump path, restore to a **new** database, and inspect the data before touching production:

```bash
sudo -u postgres createdb --owner=agency agency_restore_check
sudo -u postgres pg_restore --exit-on-error --no-owner --role=agency \
  --dbname=agency_restore_check /var/lib/postgresql/agency-backups/CHOSEN_BACKUP.dump
sudo -u postgres psql -d agency_restore_check -c 'SELECT count(*) FROM enquiries;'
```

Restoring the live database loses writes after the backup. Stop the website and maintenance timer, take a fresh backup, decide which enquiries need recovery, and plan a compatible application/schema restore first. Automatic application rollback assumes schema changes remain backward compatible. Review migrations for that property in future PRs.

To roll back code deliberately, revert the problematic commit with a new PR and deploy `main` again. Do not delete the active release or blindly run old migrations. A failed release directory can be inspected; a GitHub rerun gets a new release ID. If the workflow is interrupted during a deploy, inspect `readlink -f /srv/agency/current`, `/api/health` and the journal before rerunning. Server helper changes need a repeat of step 3, while environment changes need `systemctl restart agency-web`.

Keep Ubuntu, PostgreSQL, Caddy and Node security updates current. Resolve disk/backup/SMTP failures promptly. Keep `INDEX_SITE=false` until your domain, public contact details, booking/privacy links and enquiry delivery are ready; restart the app after changing it.

## Reference documentation

- [Hetzner SSH access](https://docs.hetzner.com/cloud/servers/getting-started/connecting-to-the-server/)
- [Hetzner Cloud firewall setup](https://docs.hetzner.com/cloud/firewalls/getting-started/creating-a-firewall/)
- [PostgreSQL packages for Ubuntu](https://www.postgresql.org/download/linux/ubuntu/)
- [Caddy installation](https://caddyserver.com/docs/install) and [automatic HTTPS](https://caddyserver.com/docs/automatic-https)
- [Node.js official downloads](https://nodejs.org/en/download)
- [GitHub deployment environments](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/manage-environments)
