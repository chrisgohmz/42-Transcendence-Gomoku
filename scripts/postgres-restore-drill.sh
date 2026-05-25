#!/bin/sh
set -eu

project_name="${COMPOSE_PROJECT_NAME:-$(basename "$PWD" | tr '[:upper:]' '[:lower:]')}"
backup_volume="${POSTGRES_BACKUP_VOLUME:-${project_name}_postgres_backups}"
restore_db="${RESTORE_DRILL_DB:-transcendence_restore}"
restore_user="${RESTORE_DRILL_USER:-transcendence}"
restore_password="${RESTORE_DRILL_PASSWORD:-restore_drill_password}"
ready_timeout_seconds="${RESTORE_DRILL_READY_TIMEOUT_SECONDS:-60}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
network="gomoku_restore_drill_${timestamp}"
data_volume="gomoku_restore_drill_data_${timestamp}"
container="gomoku_restore_drill_db_${timestamp}"

case "$ready_timeout_seconds" in
  "" | *[!0-9]*) ready_timeout_seconds=60 ;;
esac

if [ "$ready_timeout_seconds" -lt 1 ]; then
  ready_timeout_seconds=60
fi

cleanup() {
  if [ "${KEEP_RESTORE_DRILL:-false}" != "true" ]; then
    docker rm -f "$container" >/dev/null 2>&1 || true
    docker volume rm "$data_volume" >/dev/null 2>&1 || true
    docker network rm "$network" >/dev/null 2>&1 || true
  fi
}

trap cleanup EXIT INT TERM

if ! docker volume inspect "$backup_volume" >/dev/null 2>&1; then
  echo "Backup volume not found: $backup_volume" >&2
  echo "Run a backup first, or set POSTGRES_BACKUP_VOLUME to the correct volume name." >&2
  exit 2
fi

backup_file="${BACKUP_FILE:-}"

if [ "$backup_file" = "" ]; then
  backup_file="$(
    docker run --rm -v "${backup_volume}:/backups:ro" postgres:18.3-alpine \
      sh -c "ls -1t /backups/*.dump 2>/dev/null | head -n 1"
  )"
fi

if [ "$backup_file" = "" ]; then
  echo "No .dump backup artifact found in $backup_volume." >&2
  exit 2
fi

docker network create "$network" >/dev/null
docker volume create "$data_volume" >/dev/null
docker run \
  --detach \
  --env "POSTGRES_DB=$restore_db" \
  --env "POSTGRES_PASSWORD=$restore_password" \
  --env "POSTGRES_USER=$restore_user" \
  --name "$container" \
  --network "$network" \
  --rm \
  --volume "${data_volume}:/var/lib/postgresql" \
  postgres:18.3-alpine >/dev/null

ready_attempts=0
until docker exec "$container" pg_isready -U "$restore_user" -d "$restore_db" >/dev/null 2>&1; do
  ready_attempts=$((ready_attempts + 1))
  if [ "$ready_attempts" -ge "$ready_timeout_seconds" ]; then
    echo "Restore drill database did not become ready within ${ready_timeout_seconds}s." >&2
    docker logs "$container" >&2 || true
    exit 2
  fi

  sleep 1
done

docker run \
  --env "BACKUP_FILE=$backup_file" \
  --env "CONFIRM_RESTORE=restore" \
  --env "POSTGRES_DB=$restore_db" \
  --env "POSTGRES_HOST=$container" \
  --env "POSTGRES_PASSWORD=$restore_password" \
  --env "POSTGRES_PORT=5432" \
  --env "POSTGRES_USER=$restore_user" \
  --network "$network" \
  --rm \
  --volume "${backup_volume}:/backups:ro" \
  --volume "$PWD/scripts/postgres-restore.sh:/usr/local/bin/postgres-restore:ro" \
  postgres:18.3-alpine \
  sh /usr/local/bin/postgres-restore

table_count="$(
  docker exec "$container" psql -U "$restore_user" -d "$restore_db" --no-align --tuples-only \
    -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public';"
)"

echo "Restore drill completed successfully."
echo "Backup artifact: $backup_file"
echo "Restored public table count: $table_count"
