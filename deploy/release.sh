#!/usr/bin/env bash
# Installed root-owned; run as agency-deploy. Application code never runs as root.
set -Eeuo pipefail
umask 027
[[ "$(id -un)" == agency-deploy ]] || { echo "Run as agency-deploy, not root." >&2; exit 1; }
[[ "$#" -eq 2 ]] || { echo "Usage: agency-deploy COMMIT-RUN-ATTEMPT SHA256" >&2; exit 1; }
release_id=$1
checksum=$2
[[ "$release_id" =~ ^[a-f0-9]{40}-[0-9]+-[0-9]+$ && "$checksum" =~ ^[a-f0-9]{64}$ ]] || { echo "Invalid release identity." >&2; exit 1; }
commit_sha=${release_id%%-*}
root=/srv/agency
release="$root/releases/$release_id"
archive="$root/work/$release_id.tar.gz"
[[ -f /etc/agency/site.env ]] || { echo "Configure /etc/agency/site.env first." >&2; exit 1; }
exec 9>"$root/work/deploy.lock"
flock -n 9 || { echo "Another deployment is running." >&2; exit 1; }
[[ ! -e "$release" ]] || { echo "Release already exists. Re-run the GitHub workflow to create a new attempt." >&2; exit 1; }
[[ -f "$root/incoming/$release_id.tar.gz" && ! -L "$root/incoming/$release_id.tar.gz" ]] || { echo "Uploaded release is missing." >&2; exit 1; }
previous=""
if [[ -L "$root/current" ]]; then
  previous=$(readlink -f "$root/current")
elif [[ -e "$root/current" ]]; then
  echo "Current path must be a release symlink." >&2; exit 1
fi
if [[ -n "$previous" && ! "$previous" =~ ^/srv/agency/releases/[a-f0-9]{40}-[0-9]+-[0-9]+$ ]]; then
  echo "Current release path is invalid." >&2; exit 1
fi
activated=false
on_error() {
  code=$?
  trap - ERR
  if [[ "$activated" == true ]]; then
    if [[ -n "$previous" ]]; then
      ln -sfn -- "$previous" "$root/current.next"
      mv -Tf -- "$root/current.next" "$root/current"
      sudo -n /usr/bin/systemctl restart agency-web.service || true
      echo "Application reverted to the previous release. Database changes are retained." >&2
    else
      sudo -n /usr/bin/systemctl stop agency-web.service || true
      rm -f -- "$root/current"
      echo "First release failed health checks; application stopped." >&2
    fi
  fi
  echo "Deployment failed. Inspect journalctl -u agency-web; backup files are retained." >&2
  exit "$code"
}
trap on_error ERR
# Copy the upload before validation; installation is entirely unprivileged.
cp -- "$root/incoming/$release_id.tar.gz" "$archive"
chmod 0600 "$archive"
actual=$(sha256sum "$archive"); actual=${actual%% *}
[[ "$actual" == "$checksum" ]]
python3 /usr/local/lib/agency-validate-archive.py "$archive"
install -d -m 0750 "$release"
# Extract only a validated archive, with no original ownership/privileged modes.
tar --extract --gzip --file "$archive" --directory "$release" --no-same-owner --no-same-permissions
[[ "$(cat "$release/.release-sha")" == "$commit_sha" ]]
(cd "$release" && npm ci --include=dev --no-audit --no-fund)
rm -rf -- "$release/.next/cache"
ln -s /var/cache/agency "$release/.next/cache"
printf 'RELEASE_ID=%s\n' "$release_id" > "$release/release.env"
chgrp -R agency "$release"
chmod -R g+rX,o-rwx "$release"
# Always back up before changing the schema, including the initial empty database.
sudo -n -u postgres /usr/local/sbin/agency-backup
(cd "$release" && /usr/local/bin/node --env-file=/etc/agency/site.env --import tsx scripts/migrate.ts)
ln -sfn -- "$release" "$root/current.next"
mv -Tf -- "$root/current.next" "$root/current"
activated=true
sudo -n /usr/bin/systemctl restart agency-web.service
healthy=false
for _attempt in {1..30}; do
  if curl --silent --fail --max-time 5 http://127.0.0.1:3000/api/health | python3 -c 'import json,sys; d=json.load(sys.stdin); sys.exit(0 if d.get("status")=="ok" and d.get("release")==sys.argv[1] else 1)' "$release_id" 2>/dev/null; then
    healthy=true; break
  fi
  sleep 1
done
[[ "$healthy" == true ]]
sudo -n /usr/bin/systemctl start agency-maintenance.timer agency-backup.timer
rm -f -- "$archive" "$root/incoming/$release_id.tar.gz"
printf 'Deployed %s\n' "$release_id"
