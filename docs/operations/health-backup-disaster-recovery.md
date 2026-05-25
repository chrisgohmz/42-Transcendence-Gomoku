# Health, Backup, and Disaster Recovery

This runbook covers the minor module for the current production-style topology:

- Next.js app and API gateway
- Bun realtime Socket.IO service
- PostgreSQL
- Caddy as the public reverse proxy in Docker mode

Backend microservice extraction is not required for this module. When more backend services are extracted, add their health endpoints to the same status contract.

## Status Surfaces

- Human status page: `/status` through the localized app route, for example `https://localhost:8443/en/status`. This page requires a signed-in session whose user ID or username is allowlisted in operations status configuration.
- Aggregate machine endpoint: `/api/status`. This endpoint requires either an allowlisted signed-in session cookie or `x-operations-status-token` matching `OPERATIONS_STATUS_TOKEN`.
- App and database health endpoint: `/api/health`.
- Realtime service health endpoint: `/health` on the realtime service.

The aggregate status checks:

- app/gateway process health
- PostgreSQL connectivity through `SELECT 1`
- realtime service reachability through `REALTIME_HEALTH_URL`, or by deriving `/health` from `REALTIME_INTERNAL_URL`

Useful local host settings when running without containers:

```bash
REALTIME_INTERNAL_URL=http://localhost:3001/internal/game-update
REALTIME_HEALTH_URL=http://localhost:3001/health
OPERATIONS_STATUS_USERNAMES=ops_username
OPERATIONS_STATUS_TOKEN=change_me_to_a_random_monitoring_token
```

For internal monitoring without a browser session:

```bash
curl -H "x-operations-status-token: $OPERATIONS_STATUS_TOKEN" https://localhost:8443/api/status
```

## Backup Schedule

Docker Compose runs a `database-backup` sidecar based on `postgres:18.3-alpine`.
It writes PostgreSQL custom-format dumps to the separate `postgres_backups` named volume, not to the `postgres_data` database volume.

Default schedule:

- interval: `86400` seconds
- retention: `7` days
- artifact path inside the backup sidecar: `/backups/<database>-<UTC timestamp>.dump`
- checksum sidecar: `/backups/<database>-<UTC timestamp>.dump.sha256`

Configuration:

```bash
POSTGRES_BACKUP_INTERVAL_SECONDS=86400
POSTGRES_BACKUP_RETENTION_DAYS=7
POSTGRES_BACKUP_DISABLED=false
```

Run one backup immediately:

```bash
docker compose run --rm database-backup /usr/local/bin/postgres-backup
```

List backup artifacts:

```bash
docker compose run --rm database-backup sh -c 'ls -lh /backups'
```

## Restore Procedure

Restoring into the live project database is destructive. Prefer the restore drill command below first.

To restore a known artifact into the configured project database:

```bash
docker compose run --rm \
  -e CONFIRM_RESTORE=restore \
  -e BACKUP_FILE=/backups/transcendence-YYYYMMDDTHHMMSSZ.dump \
  database-backup \
  /usr/local/bin/postgres-restore
```

The restore script:

- refuses to run without `CONFIRM_RESTORE=restore`
- verifies the `.sha256` sidecar when present
- uses `pg_restore --clean --if-exists --no-owner --no-acl`
- prints the restored target database when complete

After a live restore, verify:

```bash
docker compose exec database pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"
docker compose exec database psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c '\dt'
docker compose exec app bun run prisma:migrate:deploy
```

Then sign in as an allowlisted operations user, open `/status`, and confirm app, realtime, and PostgreSQL checks are healthy.

## Restore Drill

The drill script restores the latest backup artifact into an isolated temporary PostgreSQL container and removes the drill resources afterward.

Run:

```bash
./scripts/postgres-restore-drill.sh
```

If your Compose project name is custom, pass the backup volume:

```bash
POSTGRES_BACKUP_VOLUME=<compose_project>_postgres_backups ./scripts/postgres-restore-drill.sh
```

To keep the temporary database for manual inspection:

```bash
KEEP_RESTORE_DRILL=true ./scripts/postgres-restore-drill.sh
```

The temporary database readiness wait is bounded by `RESTORE_DRILL_READY_TIMEOUT_SECONDS`, which defaults to `60`.

Record each completed drill in `docs/operations/restore-drill-log.md`.

## Cleanup

Remove old backups by retention policy, or manually delete specific artifacts from the backup sidecar:

```bash
docker compose run --rm database-backup sh -c 'rm -i /backups/<artifact>.dump /backups/<artifact>.dump.sha256'
```

Do not remove `postgres_data` as part of backup cleanup. Use `make db-volume-reset` only when the live local database is intentionally disposable.
