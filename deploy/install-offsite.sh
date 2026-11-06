#!/usr/bin/env bash
# Install only reviewed helpers as root; does not initialize R2 or enable timers.
set -Eeuo pipefail
[[ "$EUID" -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
cd -- "$(dirname -- "$0")/.."
for tool in restic python3 psql pg_restore pg_dump runuser; do command -v "$tool" > /dev/null || { echo "Install $tool first." >&2; exit 1; }; done
[[ -x /usr/local/sbin/agency-backup && -f /etc/agency/site.env ]] || { echo "Complete the existing website setup first." >&2; exit 1; }
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 --dbname=agency -c 'SELECT count(*) FROM enquiry_deletions' > /dev/null
install -d -o root -g root -m 0700 /var/lib/agency-backup /var/cache/agency-backup
install -d -o root -g agency -m 0750 /var/lib/agency-backup-status
install -m 0755 deploy/offsite.py /usr/local/sbin/agency-offsite
if [[ ! -e /etc/agency/restic.env ]]; then
  install -o root -g root -m 0600 deploy/restic.env.example /etc/agency/restic.env
fi
if [[ ! -e /etc/agency/restic.password ]]; then
  install -o root -g root -m 0600 /dev/null /etc/agency/restic.password
fi
runuser -u postgres -- psql -X -v ON_ERROR_STOP=1 --dbname=postgres <<'SQL'
DO $$ BEGIN
 IF EXISTS (SELECT 1 FROM pg_auth_members m JOIN pg_roles r ON m.member=r.oid WHERE r.rolname='agency_restore_check') THEN
   RAISE EXCEPTION 'Restore role must have no role memberships';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='agency_restore_check') THEN
   CREATE ROLE agency_restore_check NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS;
 END IF;
END $$;
ALTER ROLE agency_restore_check NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOINHERIT NOBYPASSRLS;
SQL
for unit in agency-offsite agency-deletion-checkpoint agency-restore-check agency-backup-prune; do
  install -m 0644 "deploy/systemd/$unit.service" "deploy/systemd/$unit.timer" /etc/systemd/system/
done
systemctl daemon-reload
printf '%s\n' 'Helpers installed; timers are not enabled. Complete docs/r2-backup-setup.md.'
