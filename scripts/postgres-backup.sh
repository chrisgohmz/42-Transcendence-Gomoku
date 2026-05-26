#!/bin/sh
set -eu

backup_dir="${POSTGRES_BACKUP_DIR:-/backups}"
database_host="${POSTGRES_HOST:-database}"
database_port="${POSTGRES_PORT:-5432}"
database_name="${POSTGRES_DB:-transcendence}"
database_user="${POSTGRES_USER:-transcendence}"
retention_days="${POSTGRES_BACKUP_RETENTION_DAYS:-7}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
artifact="${backup_dir}/${database_name}-${timestamp}.dump"
temporary_artifact="${artifact}.tmp"

if [ -z "${PGPASSWORD:-${POSTGRES_PASSWORD:-}}" ]; then
  echo "POSTGRES_PASSWORD or PGPASSWORD is required." >&2
  exit 2
fi

export PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD}}"

mkdir -p "$backup_dir"

cleanup() {
  rm -f "$temporary_artifact"
}

trap cleanup EXIT INT TERM

pg_dump \
  --dbname="$database_name" \
  --file="$temporary_artifact" \
  --format=custom \
  --host="$database_host" \
  --no-acl \
  --no-owner \
  --port="$database_port" \
  --username="$database_user"

mv "$temporary_artifact" "$artifact"
sha256sum "$artifact" > "${artifact}.sha256"

if [ "$retention_days" -gt 0 ] 2>/dev/null; then
  find "$backup_dir" \
    -type f \
    \( -name "${database_name}-*.dump" -o -name "${database_name}-*.dump.sha256" \) \
    -mtime "+$retention_days" \
    -delete
fi

echo "Created PostgreSQL backup: $artifact"
