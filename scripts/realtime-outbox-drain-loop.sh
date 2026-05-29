#!/bin/sh
set -eu

if [ "${REALTIME_OUTBOX_DRAIN_DISABLED:-false}" = "true" ]; then
  echo "Realtime outbox drain disabled."
  exec tail -f /dev/null
fi

interval_seconds="${REALTIME_OUTBOX_DRAIN_INTERVAL_SECONDS:-5}"

if ! [ "$interval_seconds" -gt 0 ] 2>/dev/null; then
  echo "Invalid REALTIME_OUTBOX_DRAIN_INTERVAL_SECONDS: $interval_seconds" >&2
  interval_seconds=5
fi

while true; do
  if ! bun run realtime:drain-outbox; then
    echo "Realtime outbox drain failed; retrying after ${interval_seconds}s." >&2
  fi

  sleep "$interval_seconds"
done
