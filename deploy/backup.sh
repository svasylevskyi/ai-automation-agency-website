#!/usr/bin/env bash
set -Eeuo pipefail
umask 077
backup_dir=/var/lib/postgresql/agency-backups
[[ -d "$backup_dir" ]] || { echo "Backup directory is missing." >&2; exit 1; }
file="$backup_dir/agency-$(date -u +%Y%m%dT%H%M%S)-$$.dump"
trap 'rm -f -- "$file.partial"' EXIT
pg_dump --format=custom --file="$file.partial" agency
pg_restore --list "$file.partial" > /dev/null
mv -- "$file.partial" "$file"
printf 'Database backup created: %s\n' "$file"
