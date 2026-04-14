#!/bin/sh
set -eu

bun scripts/wait-for-db.ts
bun run prisma:migrate:deploy
exec bun run start
