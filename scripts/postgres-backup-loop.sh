#!/bin/sh
set -eu

if [ "${POSTGRES_BACKUP_DISABLED:-false}" = "true" ]; then
  echo "PostgreSQL backups disabled."
  exec tail -f /dev/null
fi

backup_script="${POSTGRES_BACKUP_SCRIPT:-/usr/local/bin/postgres-backup}"

while true; do
  sh "$backup_script"
  sleep "${POSTGRES_BACKUP_INTERVAL_SECONDS:-86400}"
done
