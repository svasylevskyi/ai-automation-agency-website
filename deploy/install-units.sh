#!/usr/bin/env bash
# Run as root from the reviewed repository on a dedicated Ubuntu server.
set -Eeuo pipefail
[[ "$EUID" -eq 0 ]] || { echo "Run as root." >&2; exit 1; }
cd -- "$(dirname -- "$0")/.."
for tool in node npm psql pg_dump caddy python3 curl flock sudo visudo; do command -v "$tool" > /dev/null || { echo "Install $tool first." >&2; exit 1; }; done
[[ "$(node -p 'process.versions.node.split(".")[0]')" == 24 ]] || { echo "Install Node.js 24 LTS first." >&2; exit 1; }
id agency > /dev/null 2>&1 || useradd --system --home-dir /var/lib/agency --create-home --shell /usr/sbin/nologin agency
id agency-deploy > /dev/null 2>&1 || useradd --create-home --shell /bin/bash agency-deploy
usermod -aG agency agency-deploy
install -d -o agency-deploy -g agency -m 0750 /srv/agency /srv/agency/releases
install -d -o agency-deploy -g agency -m 0700 /srv/agency/work /srv/agency/incoming
install -d -o agency -g agency -m 0750 /var/cache/agency
install -d -o root -g agency -m 0750 /etc/agency
install -d -o postgres -g postgres -m 0700 /var/lib/postgresql/agency-backups
install -m 0755 deploy/release.sh /usr/local/sbin/agency-deploy
install -m 0755 deploy/validate-archive.py /usr/local/lib/agency-validate-archive.py
install -m 0755 deploy/backup.sh /usr/local/sbin/agency-backup
install -m 0644 deploy/systemd/agency-* /etc/systemd/system/
cat > /etc/sudoers.d/agency-deploy <<'SUDOERS'
agency-deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart agency-web.service, /usr/bin/systemctl stop agency-web.service, /usr/bin/systemctl start agency-maintenance.timer agency-backup.timer
agency-deploy ALL=(postgres) NOPASSWD: /usr/local/sbin/agency-backup
SUDOERS
chmod 0440 /etc/sudoers.d/agency-deploy
visudo -cf /etc/sudoers.d/agency-deploy
systemctl daemon-reload
systemctl enable agency-web.service agency-maintenance.timer agency-backup.timer
# Startup happens after secrets, database, DNS and the first successful deployment.
printf '%s\n' 'Units installed. Configure /etc/agency/site.env and SSH keys, then follow docs/hetzner-setup.md.'
