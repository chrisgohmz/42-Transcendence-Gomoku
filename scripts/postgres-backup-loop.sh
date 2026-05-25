#!/bin/sh
set -eu

if [ "${POSTGRES_BACKUP_DISABLED:-false}" = "true" ]; then
  echo "PostgreSQL backups disabled."
  exec tail -f /dev/null
fi

while true; do
  /usr/local/bin/postgres-backup
  sleep "${POSTGRES_BACKUP_INTERVAL_SECONDS:-86400}"
done
