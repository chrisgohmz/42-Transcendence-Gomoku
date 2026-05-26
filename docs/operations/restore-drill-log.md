# Restore Drill Log

Record restore drills for the PostgreSQL backup process here.

## 2026-05-25

- Status: Not executed in this workspace
- Backup artifact: Pending
- Command: `./scripts/postgres-restore-drill.sh`
- Result: Blocked because the local WSL environment does not have the Docker CLI available.
- Notes: Added the automated backup sidecar, confirmed restore script, and isolated drill command. Run the drill after the Docker stack has produced at least one backup artifact, then replace this entry with the completed artifact, result, and table-count verification.
