# Cloudflare R2 backups and enquiry retention

This is an add-on to the existing **non-Docker Hetzner installation**. It works with the current PostgreSQL 17 / Node 24 server and Mailpit. Website deployment remains the existing manual GitHub workflow. R2 needs no change to DuckDNS, Caddy, the public hostname or Cloudflare nameservers.

The approach matches Research Radar: Restic encrypts backups before uploading to a private R2 bucket. Use a **separate agency bucket, API token, encryption password and repository**. Nothing in this setup changes the Radar repository.

## 1. Merge and deploy the website

Merge this PR, then run the normal website deployment workflow against `main`. It applies migration `005-retention.sql`. Open **Admin → Retention & backups**. Automatic enquiry deletion starts **disabled**; leave it disabled through the first successful recovery test.

Normal deployment does not install root-owned server helpers or configure R2. Complete the following steps once, and reinstall reviewed helper updates when later PRs change `deploy/`.

## 2. Create the R2 bucket and credentials — Cloudflare dashboard

1. Open **Storage & databases → R2 Object Storage**. Activate R2 if needed; review any billing prompt in your account.
2. Create a bucket named **`agency-website-test-backups`**. Choose **European Union (EU) jurisdiction**, not merely an EU location hint. Use Standard storage.
3. Keep public access disabled: no public development URL and no custom public domain. No CORS configuration is needed.
4. Do **not** add an object-expiration lifecycle rule or retention lock to this bucket. Restic manages expiration of its interconnected repository objects. Deleting those objects independently can break backups.
5. In R2 Overview, open **Manage API tokens** and create an R2 API token with **Object Read & Write** permission, limited to this bucket. Account tokens are suitable when available; a user token also works. Use an expiry you can maintain, or no expiry for this test setup.
6. Save the **Access Key ID**, **Secret Access Key**, **Account ID**, and EU S3 endpoint in your password manager. The secret is displayed once. Restic uses the access/secret key pair, not the Cloudflare dashboard API-token string.

The endpoint must look like `https://ACCOUNT_ID.eu.r2.cloudflarestorage.com`. This helper deliberately accepts only the EU endpoint. Keep these credentials out of chat, GitHub and the website's admin settings.

## 3. Copy and install the helpers

In **Windows PowerShell, from your repository folder**, after merging:

```powershell
git switch main
git pull --ff-only
scp -i "$env:USERPROFILE\.ssh\agency_admin" -r deploy root@2.31.126.173:/root/agency-setup/
ssh -i "$env:USERPROFILE\.ssh\agency_admin" root@2.31.126.173
```

In the **server SSH session**, as root:

```bash
apt-get update
apt-get install -y restic
restic version
cd /root/agency-setup
bash deploy/install-offsite.sh
```

Use Bash, not `sh`. Git attributes preserve LF endings for these files on Windows. If using a pre-existing checkout that still has CRLF endings, normalize only the uploaded setup files before running the installer:

```bash
sed -i 's/\r$//' deploy/install-offsite.sh deploy/offsite.py deploy/restic.env.example deploy/systemd/agency-*.service deploy/systemd/agency-*.timer
bash deploy/install-offsite.sh
```

The installer checks migration 005, creates a restricted restore-test database role, installs the helper and timers, and creates private configuration files if absent. It does not overwrite existing credentials, initialize a repository or enable timers.

## 4. Configure credentials and the encryption password — server SSH

```bash
nano /etc/agency/restic.env
```

Replace the placeholders; keep the remaining values initially:

```text
RESTIC_REPOSITORY=s3:https://YOUR_32_CHARACTER_ACCOUNT_ID.eu.r2.cloudflarestorage.com/agency-website-test-backups/agency
RESTIC_PASSWORD_FILE=/etc/agency/restic.password
AWS_ACCESS_KEY_ID=YOUR_R2_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=YOUR_R2_SECRET_ACCESS_KEY
BACKUP_DAYS=35
CHECKPOINT_DAYS=65
LOCAL_DAYS=7
```

Generate a **new random password of at least 32 characters** in your password manager. Store it there, independently of this server and R2, then paste that same password as the only line into:

```bash
nano /etc/agency/restic.password
chown root:root /etc/agency/restic.env /etc/agency/restic.password
chmod 600 /etc/agency/restic.env /etc/agency/restic.password
```

This is the Restic encryption password, separate from the database/admin passwords and R2 secret key. Losing it makes these backups unrecoverable. Do not generate a replacement password after initialization. The encryption password and R2 credentials are deliberately excluded from the backup itself. No new GitHub secrets are required.

## 5. Initialize and verify — server SSH

Run each command separately and stop if it reports failure:

```bash
/usr/local/sbin/agency-offsite init
/usr/local/sbin/agency-offsite backup
/usr/local/sbin/agency-offsite verify
/usr/local/sbin/agency-offsite prune
```

`init` is for a **new** repository only. Save the printed 64-character repository ID in your password manager with the bucket, endpoint and encryption password. The helper pins this ID to prevent accidentally operating on another repository.

`backup` creates a fresh PostgreSQL custom-format dump, includes `/etc/agency/site.env`, encrypts/uploads both with a checksum manifest, downloads the dump and compares its checksum. It also uploads and checks a fresh deletion checkpoint. Database contents include enquiries, notes, assessments, activity, owner authentication, settings, legal pages and logos. The backup does not include Mailpit messages, OS/Caddy configuration, application releases or GitHub settings; code and deployment configuration remain in GitHub.

`verify` reads the encrypted repository, restores into a **new isolated database**, reapplies the latest deletion checkpoint, checks the application data, clears restored sessions and disables restored automatic cleanup. It removes the test database and downloaded files on completion. It never starts an application, sends email or replaces the live database.

`prune` applies retention only after a restore verification within 14 days and a checked backup within 36 hours. It preserves at least the newest local dump and newest snapshot of each backup type. Failed backup/restore operations do not trigger pruning.

In Cloudflare, confirm that the bucket now has objects under `agency/`. In admin, reload **Retention & backups** and check all four success timestamps. These timestamps report server results; they are not a live R2 health check.

## 6. Enable the schedules — server SSH

```bash
systemctl enable --now agency-offsite.timer agency-deletion-checkpoint.timer agency-restore-check.timer agency-backup-prune.timer
systemctl list-timers --all 'agency-*'
```

| Job | Schedule | Default retention |
| --- | --- | --- |
| Local dump, existing job | Daily 02:30 UTC and before deployment | 7 days once pruning is enabled; newest always kept |
| Encrypted full backup | Daily 03:00 UTC | Rolling 35-day snapshot window; newest always kept |
| Deletion checkpoint | Hourly at minute 07 UTC, and during full backup/pruning | Rolling 65-day window; newest always kept |
| Isolated restore check | Sunday 04:00 UTC | Temporary copy removed after checking |
| Backup pruning | Daily 05:00 UTC | Applies the policies above |

Timers add a small random delay. Persistent timers may catch up after a reboot; operations are serialized by a root-owned lock. Admin timestamps use Warsaw time. Leave the existing local backup and website maintenance timers enabled.

Restic's rolling windows are measured from the latest snapshot, not a promise that every copy disappears after exactly 35/65 days. If jobs stop, pruning fails, or a final good copy is preserved, copies remain longer. Resolve those failures before claiming a firm deletion deadline in the Privacy Policy.

## 7. Choose the enquiry retention policy — admin

1. Open **Retention & backups**. Choose the number of days: the starting suggestion is **180**, with a supported range of 30–3650. This is an operational choice, not a legal requirement.
2. Select **Preview eligible enquiries**. It displays the total and up to 50 oldest matches without deleting anything. A zero-count preview is normal on a new installation.
3. Update the Privacy Policy to reflect your actual chosen period and backup arrangements (see below).
4. Select **Automatically delete eligible closed enquiries**, acknowledge the preview, and save.

Every five minutes, maintenance removes up to 100 eligible closed enquiries. The clock runs from closure or the latest owner edit, whichever is later. Open enquiries, recently edited enquiries and active email-send claims are excluded. Existing closed enquiries get a new closure clock when migration 005 runs. Reopening clears that clock; closing again starts a new one. Saved edits to a closed enquiry postpone its expiry.

The enquiry, notes, assessment, receipt snapshot and activity history are deleted together. A minimal recovery record containing only its random UUID and deletion time remains so older backups cannot silently reintroduce known deletions. Those markers are removed only after a successful prune confirms that all managed backups that could predate them have expired; they are retained for at least 65 days by default. The admin setting can be disabled without a preview. An enabled setting is an ongoing policy: future ageing records will also be deleted.

The shipped Privacy Policy draft now describes these capabilities and leaves periods/provider details as placeholders. **Existing saved legal pages are preserved**; copy the relevant changes from `src/content/privacy-policy.md` into your admin editor. Fill in the actual backup provider entity/location, selected enquiry period, rolling backup policy, minimal recovery markers and Mailpit/correspondence retention. Do not claim that changing the legal text configures any of these jobs. Mailpit messages have separate retention; deleting an enquiry does not delete already captured/sent email.

## 8. Routine checks and troubleshooting

```bash
systemctl status agency-offsite.service agency-deletion-checkpoint.service agency-restore-check.service agency-backup-prune.service --no-pager
journalctl -u agency-offsite -u agency-deletion-checkpoint -u agency-restore-check -u agency-backup-prune --since '2 days ago' --no-pager
df -h /var/lib/postgresql /var/lib/agency-backup
```

A completed oneshot service normally shows `inactive (dead)` with a successful exit. `failed` or non-zero exit needs attention. Inspect the admin timestamps regularly: backup older than 36 hours, checkpoint older than 2 hours or restore test older than 8 days produces a warning. This increment does not send external outage alerts.

- **R2 operation fails:** check EU jurisdiction/endpoint, bucket-scoped Object Read & Write credentials, expiry, billing, outbound HTTPS and the saved password. Raw subprocess output is withheld to keep secrets/data out of logs.
- **Configuration rejected:** use the exact example keys, a 32-character account ID, private regular files with mode 600, and the `/agency` repository prefix.
- **Prune refused:** run a successful backup and restore verification first. Unknown `.dump` files in the managed backup directory block deletion-marker pruning; review those copies and preserve their deletion evidence before moving or removing them. Never blindly delete old manual copies.
- **Repository mismatch:** do not replace the pin or initialize over the old repository. Check the recorded repository ID, endpoint and bucket.
- **Disk capacity:** recovery temporarily needs space for a downloaded dump, restored database and Restic cache, in addition to normal data. Check free space as enquiries grow.
- **Process killed/server crash:** staging is cleared on the next matching run. An interrupted restore can leave an isolated `agency_restore_*` database or a root-only `restore-*` directory. Inspect and remove only the abandoned test copy after confirming no recovery job is running. Never use wildcard database deletion.

To pause offsite jobs without stopping the website:

```bash
systemctl stop agency-offsite.timer agency-deletion-checkpoint.timer agency-restore-check.timer agency-backup-prune.timer
```

Stopping a timer does not stop an already running service; check its status before maintenance. Keep retention disabled while recovering from a prolonged backup failure if you want to postpone automatic enquiry deletion.

## 9. Recovery kit and an actual recovery

Keep outside this server: the repository ID, bucket/endpoint, Restic password, R2 access details or account access to create replacement credentials, SSH/recovery access, and the GitHub repository/release reference. R2 protects against loss of this server; the server's read/write R2 credentials can also delete repository data, so this is not immutable backup storage.

Routine verification is safe to repeat:

```bash
/usr/local/sbin/agency-offsite verify
```

For an actual recovery on a configured server, first pause website writes, maintenance, deployment activity and backup timers. If the original database is usable, take a final checkpoint before stopping writes and another after writes stop. Do not overwrite the live database just to test recovery.

```bash
systemctl stop agency-web.service agency-maintenance.timer agency-maintenance.service
# With the original database still available:
/usr/local/sbin/agency-offsite checkpoint
/usr/local/sbin/agency-offsite recover
```

`recover` performs the same isolated checks but **keeps** the successful isolated database and private downloaded files, printing both locations and the selected snapshot/checkpoint IDs. Sessions are cleared and automatic retention is disabled in the recovered copy. It does not activate the copy, change the live database or start email recovery. An optional `--snapshot FULL_64_CHARACTER_ID` chooses an older full snapshot, always applying the latest available deletion checkpoint.

Before activation, inspect the selected dates, reconcile any known deletions after the checkpoint, compare records with any surviving live database, and choose a compatible application release. With these schedules, loss of the server can lose up to roughly one day of new/edited enquiries and one hour of deletion evidence, or longer if jobs were failing. A checkpoint only proves deletions through its own recorded time. Do not assume an older standalone SQL dump is safe to expose without current deletion evidence.

Promotion is a separate deliberate operator step: preserve the old database, transfer the isolated database and its objects from the restricted `agency_restore_check` role to the runtime `agency` role, point the configured `agency` connection at the recovered database, and restore/reconcile the encrypted `site.env` through a private editor. Review pending/failed emails before restarting maintenance, since retrying older state can send duplicate receipts. Verify the website and owner login, then take a new backup and isolated restore check before enabling pruning/retention again. Remove the abandoned copies after verification and account for their retention.

On a **replacement server**, recreate the base installation and empty migrated database first using the existing Hetzner guide, keeping the website and timers stopped. Install these helpers, restore the same R2 configuration and encryption password, then use:

```bash
/usr/local/sbin/agency-offsite pin --repository-id YOUR_SAVED_64_CHARACTER_REPOSITORY_ID
/usr/local/sbin/agency-offsite recover
```

Do **not** run `init`, `backup`, `checkpoint` or `prune` against a newly empty database before recovering the original data: that could replace the latest deletion checkpoint with empty evidence. Recovery uses the existing encrypted repository and does not require the old server. Complete the review/promotion steps above before exposing the restored website.

## Official references

- [Cloudflare R2 S3 setup](https://developers.cloudflare.com/r2/get-started/s3/)
- [R2 API tokens and jurisdiction endpoints](https://developers.cloudflare.com/r2/api/tokens/)
- [Restic repositories and S3-compatible storage](https://restic.readthedocs.io/en/stable/030_preparing_a_new_repo.html)
- [Restic retention and pruning](https://restic.readthedocs.io/en/stable/060_forget.html)
- [Restic restore and file extraction](https://restic.readthedocs.io/en/stable/050_restore.html)
