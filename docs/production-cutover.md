# Promote the existing server to production

Target: **https://get-automated.ai**, using the current Hetzner server, PostgreSQL database, Caddy, Google Workspace inbox and Resend account. This is a controlled configuration/data cleanup, not a new-server installation. Keep the current owner account, branding, legal-page edits, database and backup repository. Future development uses local/test databases and PRs; do not treat this server as a disposable test environment after launch.

These are operator steps, not actions performed by this PR. Run server commands in your verified SSH session; replace `SERVER_IP` with the current IPv4 shown in Hetzner. Do not paste secrets, database exports or customer lists into chat. Use the existing secret editors/password manager. A brief maintenance window is expected.

## 1. Establish the baseline before changing anything

- Merge this PR and deploy `main` through **Actions → Deploy website to Hetzner**, using the current working hostname first. Test the reviewed-reply flow only with your own address. Do not send historical test drafts to arbitrary addresses.
- Record the current release, APP_URL, Caddy site blocks, GitHub `production` environment's `SITE_URL`, n8n website base URL, timer states and backup repository ID. Confirm current SSH access in a second session.
- Review Owner Settings (name/logo/public email/booking link), Terms and Privacy, and the list of enquiries. Preserve genuine enquiries even if they arrived during testing. A domain/address/name alone is not proof that an enquiry is test data.
- Check current capacity and services; completed backup services may show `inactive (dead)` with a successful exit:

```bash
readlink -f /srv/agency/current
systemctl status agency-web caddy agency-maintenance.timer agency-backup.timer --no-pager
systemctl list-timers 'agency-*' --all --no-pager
df -h / /var/lib/postgresql
ss -lnt
```

Only SSH and Caddy's HTTP/HTTPS ports should be publicly reachable. PostgreSQL 5432, Next.js 3000, Mailpit and n8n's editor should not be exposed without their intended access controls. Keep Caddy directly reachable (DNS-only) for this cutover; a proxied CDN needs a separate trusted-client-IP configuration.

## 2. Pause automation and protect the current data

Pause the published n8n workflow first and wait for in-flight executions to finish. In `/etc/agency/site.env`, set `PROSPECT_AUTOMATION_ENABLED=false` and clear `N8N_ENQUIRY_WEBHOOK_URL` temporarily. Record the previous webhook URL securely. Restart the website so submissions cannot enqueue or trigger new n8n work:

```bash
systemctl stop agency-maintenance.timer agency-maintenance.service
nano /etc/agency/site.env
systemctl restart agency-web
```

Stopping maintenance prevents queued receipt/notification recovery; new public form submissions still attempt their normal emails. Perform cleanup before promoting the public domain and keep the window short. Before changing the domain, stop `agency-web` as shown later to stop all website writes. Do not disable normal backups during cleanup.

Take a database backup. If the existing R2/Restic setup is configured, take an offsite copy and verify recovery; stop here if recovery fails:

```bash
sudo -u postgres /usr/local/sbin/agency-backup
/usr/local/sbin/agency-offsite backup
/usr/local/sbin/agency-offsite verify
```

The last two commands require the existing offsite setup. If absent, complete [R2 backup setup](r2-backup-setup.md) before launch. An existing bucket with “test” in its name can continue to protect production; its name does not weaken encryption or access controls. Do not repoint Restic or initialize over an existing repository just to rename it.

## 3. Remove confirmed test data, preserving real records

In the owner inbox, review each page and open suspected test enquiries. Delete only records you can positively identify as your tests, using each enquiry's **Delete enquiry** action. Closed does not mean test. Bulk status changes do not delete records.

Deleting an enquiry also removes its assessment, notes, follow-ups, receipt/notification snapshots, n8n job/result/draft, reviewed-reply preview/sent record and activity history. The deletion trigger keeps only its UUID/time as recovery evidence. Keep the owner account, settings, logo assets still in use, legal pages, migration history, backup state and deletion evidence. Do not use `TRUNCATE`, drop/recreate the database, or run the integration test suite on this server.

For a read-only inventory and queue check on the standard database:

```bash
sudo -u postgres psql -d agency -c "SELECT id,created_at,name,email,status FROM enquiries ORDER BY created_at DESC;"
sudo -u postgres psql -d agency -c "SELECT notification_status,confirmation_status,count(*) FROM enquiries GROUP BY 1,2;"
sudo -u postgres psql -d agency -c "SELECT status,count(*) FROM prospect_jobs GROUP BY status;"
sudo -u postgres psql -d agency -c "SELECT status,count(*) FROM reply_deliveries GROUP BY status;"
```

Inspect any remaining pending/failed/sending messages before re-enabling maintenance. Receipts saved on the old domain keep their original links; reviewed replies keep their original payload too. Do not blindly retry old uncertain sends. An accepted message is not undone by deleting its enquiry.

Clean the other copies separately:

| Location | What to review/remove |
| --- | --- |
| Gmail | Identified test enquiries, receipts and replies; then empty Trash for those messages when sure. Keep real correspondence. |
| Mailpit | Captured test messages through its UI. If no process still uses it, stop/disable its observed service/container and remove its dedicated data only after confirming its actual path. Do not guess a unit name or delete a shared Docker volume. |
| Resend | Inspect test delivery records and uncertain sends; account retention is separate from website deletion. Do not delete the verified domain or working sending key. |
| n8n | Test execution history and pinned sample data. Preserve the active workflow and credentials; keep execution-payload saving disabled as configured in the prospect guide. |
| Local files | Remove obsolete CSV exports, dumps and screenshots containing test/personal data after checking their purpose. Do not delete the recovery kit or newest valid backup. |
| Backups | Old encrypted copies expire through the existing verified pruning policy. Do not manually delete individual Restic objects. Hetzner snapshots/manual dumps have separate retention. |

After deletion, persist the deletion evidence and a fresh clean backup:

```bash
/usr/local/sbin/agency-offsite checkpoint
/usr/local/sbin/agency-offsite backup
/usr/local/sbin/agency-offsite verify
```

## 4. Prepare DNS without disturbing email

At your current DNS provider:

| Record | Target |
| --- | --- |
| `A` for `@` (`get-automated.ai`) | Current server IPv4 |
| `CNAME` for `www` | `get-automated.ai` |
| `AAAA` | Keep/add only if IPv6 is configured and reachable; remove a stale website AAAA |

Use DNS-only mode during cutover. Preserve **all Google Workspace MX, Google verification/DKIM, SPF/DMARC, and Resend sending-subdomain records**. You are changing website A/AAAA/CNAME records, not migrating email. Verify the new records resolve before Caddy certificate issuance. Keep the old DuckDNS record pointed to this server for its redirect/certificate renewal until you intentionally retire that hostname.

## 5. Switch the origin and HTTPS together

Create private, timestamped rollback copies and stop the web process for the short origin switch. These copies contain secrets and need the same retention/protection as configuration backups:

```bash
cutover_stamp=$(date -u +%Y%m%dT%H%M%SZ)
install -d -m 0700 "/root/agency-cutover-$cutover_stamp"
cp -p /etc/agency/site.env /etc/caddy/Caddyfile "/root/agency-cutover-$cutover_stamp/"
systemctl stop agency-web
nano /etc/agency/site.env
```

Set `APP_URL=https://get-automated.ai`, keep `INDEX_SITE=false` for verification, and retain `TRUSTED_IP_HEADER=x-agency-client-ip`. Keep the working Resend sender/key, Gmail notification recipient, database connection and **existing BETTER_AUTH_SECRET**. Keep automation paused. The template sender is `website@mail.get-automated.ai`; retain your actual verified sender if different. Do not blindly copy the example over the live environment file.

Edit only this website's blocks in `/etc/caddy/Caddyfile`; preserve unrelated sites/global configuration:

```caddyfile
get-automated.ai {
    encode zstd gzip
    reverse_proxy 127.0.0.1:3000 {
        header_up X-Agency-Client-IP {remote_host}
    }
}

www.get-automated.ai, ai-automation-studio.duckdns.org {
    @readOnly method GET HEAD
    redir @readOnly https://get-automated.ai{uri} 302
    respond "Use https://get-automated.ai for this request." 409
}
```

Use the actual old hostname if different. The initial temporary redirect keeps rollback simple. Old API POSTs deliberately fail instead of silently forwarding credentials/forms across origins; update n8n explicitly. After a successful cutover, change `302` to `301` for permanent page redirects. Do not add `www` until its DNS resolves here.

```bash
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
systemctl start agency-web
curl --fail --silent --show-error https://get-automated.ai/api/health
```

Caddy handles public certificates/renewals when DNS and ports 80/443 are correct. Sign in freshly at the new `/admin`; browser cookies from DuckDNS do not transfer. You keep the existing owner credentials.

In GitHub → Settings → Environments → `production`, set **`SITE_URL=https://get-automated.ai`**. Keep `DEPLOY_HOST`, `DEPLOY_PORT`, `DEPLOY_SSH_KEY` and `DEPLOY_KNOWN_HOSTS` unchanged when SSH still targets the same server/host. A later deployment's public health check uses `SITE_URL`.

## 6. Verify live configuration and restart the complete flow

- Owner Settings: agency name/logo, working public business email (Reply-To), genuine booking URL or blank, and real public description.
- Terms/Privacy: review saved pages, fill every provider/location/retention/contact placeholder, remove obsolete Mailpit/test-environment wording, and describe owner-approved reply bodies/envelopes stored with the enquiry. Mark pages ready only when the content is accurate. Source-file changes never silently replace customized saved policies.
- n8n: change its **Website configuration** base URL to `https://get-automated.ai` and any separately hard-coded claim/complete URLs. Keep the strong worker credential unless rotating it deliberately. Use the workflow's production webhook URL, not `/webhook-test/`. Restore `N8N_ENQUIRY_WEBHOOK_URL` and set `PROSPECT_AUTOMATION_ENABLED=true` on the website only when the updated workflow is ready. A workflow running on a Windows PC will stop when it sleeps; move it to a maintained always-on n8n host before relying on unattended preparation, or leave preparation paused and handle replies manually for launch.
- Review the remaining enquiry queues again before enabling the workflow and recovery timer.

```bash
nano /etc/agency/site.env
systemctl restart agency-web
systemctl start agency-maintenance.timer
```

Publish/activate the updated n8n workflow. Submit one clearly labelled launch test from an address you control. Check both enquiry routes, acknowledgement, owner notification, n8n brief/draft, approved first reply, Gmail reply destination, sent activity and follow-up date. Test home/service navigation, phone layout and the logo with email images enabled/disabled. Refresh the enquiry and confirm it cannot be sent twice. Delete the launch fixture and its mail copies afterward; create a deletion checkpoint.

## 7. Open for indexing and retain a rollback path

When checks pass, set `INDEX_SITE=true` and restart `agency-web`. Verify the homepage/service page's canonical URL uses `https://get-automated.ai` and robots metadata allows indexing; the owner area remains noindex. Change the old-site/`www` redirect to 301, validate and reload Caddy. Optional Search Console verification can follow; search appearance is not immediate.

Confirm backup, deletion checkpoint and restore-check timers are enabled, inspect their last successful runs, and keep retention on the reviewed policy. Run a normal deployment once with the new GitHub `SITE_URL` to confirm the future release path. Remove obsolete test DNS/services only after nothing still references them.

If the domain switch fails, restore the saved Caddy and environment files, restore the recorded GitHub/n8n URLs, validate/reload Caddy and restart the website on the old origin. Keep automation paused until its endpoints are consistent. This rolls back configuration, not database migrations or data cleanup. Do not restore an old database just to undo a DNS problem; it can lose real enquiries and reintroduce deleted records. Use the isolated recovery/deletion-replay procedure in the backup guide if database recovery is actually needed.

References: [Caddy automatic HTTPS](https://caddyserver.com/docs/automatic-https), [Caddy redirects](https://caddyserver.com/docs/caddyfile/directives/redir), [email setup](email-setup.md), [reviewed replies](approved-replies.md), [R2 recovery and retention](r2-backup-setup.md).
