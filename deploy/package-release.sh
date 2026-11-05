#!/usr/bin/env bash
# Build first. Package only runtime sources and build output, never local secrets.
set -Eeuo pipefail
[[ "$#" -eq 2 && "$1" =~ ^[a-f0-9]{40}$ ]] || { echo "Usage: bash deploy/package-release.sh COMMIT_SHA OUTPUT.tar.gz" >&2; exit 1; }
[[ -f .next/BUILD_ID ]] || { echo "Run npm run build first." >&2; exit 1; }
printf '%s\n' "$1" > .release-sha
trap 'rm -f .release-sha' EXIT
tar --create --gzip --file="$2" --exclude='.next/cache' --exclude='.next/dev' \
  .next public src scripts migrations package.json package-lock.json \
  next.config.ts next-env.d.ts tsconfig.json postcss.config.mjs .release-sha
python3 deploy/validate-archive.py "$2"
