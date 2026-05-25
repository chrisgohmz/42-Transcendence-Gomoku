#!/bin/sh
set -eu

backup_file="${BACKUP_FILE:-}"
database_host="${POSTGRES_HOST:-database}"
database_port="${POSTGRES_PORT:-5432}"
database_name="${POSTGRES_DB:-transcendence}"
database_user="${POSTGRES_USER:-transcendence}"

if [ "$backup_file" = "" ]; then
  echo "BACKUP_FILE must point to a .dump artifact." >&2
  exit 2
fi

if [ ! -f "$backup_file" ]; then
  echo "Backup artifact not found: $backup_file" >&2
  exit 2
fi

if [ "${CONFIRM_RESTORE:-}" != "restore" ]; then
  echo "Set CONFIRM_RESTORE=restore to confirm this database restore." >&2
  exit 2
fi

if [ -z "${PGPASSWORD:-${POSTGRES_PASSWORD:-}}" ]; then
  echo "POSTGRES_PASSWORD or PGPASSWORD is required." >&2
  exit 2
fi

export PGPASSWORD="${PGPASSWORD:-${POSTGRES_PASSWORD}}"

if [ -f "${backup_file}.sha256" ]; then
  sha256sum -c "${backup_file}.sha256"
fi

pg_restore \
  --clean \
  --dbname="$database_name" \
  --host="$database_host" \
  --if-exists \
  --no-acl \
  --no-owner \
  --port="$database_port" \
  --username="$database_user" \
  --verbose \
  "$backup_file"

echo "Restored PostgreSQL backup into ${database_host}:${database_port}/${database_name}"
