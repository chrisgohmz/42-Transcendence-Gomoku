#!/bin/sh
set -eu

node scripts/wait-for-db.js
npm run prisma:push -- --skip-generate
npm run start
