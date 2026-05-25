_This project has been created as partof the 42 curriculum by cgoh, athonda and mintan_

# Description

# Instructions

## Local setup

This repo now uses Bun as the only supported package manager.

### Prerequisites

- Docker and Docker Compose
- Bun 1.x for package manager and script commands
- Node 24 LTS for local Prisma CLI usage

An `.nvmrc` file is included at the repo root if you use `nvm`.

After installing Bun, restart your shell so both `bun` and `bunx` are available on your `PATH`.
Run `bun install` once at the repo root if you want VS Code to use a single workspace TypeScript SDK for the whole repository.

### Install dependencies

```bash
bun install
```

The root install intentionally skips dependency lifecycle scripts. Generate the Prisma client with the Bun command below after installing dependencies.

### Docker data location

Keep Docker Engine's `data-root` on a local filesystem such as `goinfre`. This
repo stores project-owned container data in Docker named volumes:

- `postgres_data` for PostgreSQL data
- `app_uploads` for uploaded profile images
- `caddy_data` and `caddy_config` for Caddy local CA/cert state
- `app_node_modules`, `app_next`, and `app_generated` for development caches

On the 42 lab machines, keep Docker's own storage on `goinfre` so these named
volumes do not fill the small home partition. `docker compose down` preserves
the volumes. Use `make db-reset` or `make fclean` when you want to remove them.

### Run locally without containers

Start PostgreSQL in Docker first so the host-side `DATABASE_URL` in `.env` can reach `localhost:5432`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d database
```

Then run the Next app and realtime service from separate host shells:

```bash
bun run dev
bun run dev:realtime
```

This host-shell path still serves plain HTTP on `http://localhost:3000`. Set
`REALTIME_INTERNAL_URL=http://localhost:3001/internal/game-update` in `.env` so
the Next route handlers can publish match updates to the host-side realtime
service. Friendship refreshes are derived from that URL unless you set
`REALTIME_FRIENDSHIP_INTERNAL_URL` explicitly. Internal friendship publishes use
`REALTIME_INTERNAL_SECRET`, falling back to `BETTER_AUTH_SECRET`, as the shared
service-to-service header secret.

### Prisma workflow

```bash
bun run prisma:generate
bun run prisma:migrate:dev -- --name <migration-name>
```

For host-side Prisma commands, `DATABASE_URL` should point to `localhost:5432`. In containers, Compose still injects a container-only URL that uses `database:5432`.

When `schema.prisma` changes, create a migration locally with `prisma migrate dev`,
verify it, and commit the generated `prisma/migrations/` files.

Seed the database with development demo data (skips if users already exist):

```bash
bun run prisma:seed
```

This repo now applies committed migrations on container startup with
`prisma migrate deploy` instead of syncing the schema with `db push`.

If you were already using the old `db push` workflow locally, do a one-time reset
before the first migration-based run:

```bash
make db-reset
```

If you only want to recreate the database container afterward:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d database
```

PostgreSQL 18 stores container data below a major-versioned directory, so the
Compose volume targets `/var/lib/postgresql` and lets the image create its own
versioned data subdirectory. If the database container exits with an error that
says there appears to be PostgreSQL data in `/var/lib/postgresql`, the existing
local volume still has the old pre-18 layout. If that local database is
disposable, reset only the database volume:

```bash
make db-volume-reset
```

Use `make db-reset` only when you also want to remove the other local Compose
volumes. Preserve and migrate the data with `pg_upgrade` instead if it contains
data you need to keep.

### Run the full stack with containers

```bash
docker compose up --build
```

This runs the Next app, Bun realtime service, Caddy HTTPS reverse proxy, and PostgreSQL in a production-style local container mode. Open the app at `https://localhost:8443`.

### Run the full stack in Docker dev mode

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

This override switches the app to development mode, mounts the source tree into the containers, enables hot reload while keeping PostgreSQL in Docker, and publishes PostgreSQL on `localhost:5432` for host-side Prisma and backend commands. Open the app at `https://localhost:8443`.

For local HTTPS, Caddy issues a certificate from its internal local CA. Browsers will usually warn until you trust that CA once on your machine. You can copy the root certificate out of the running proxy container with:

```bash
docker compose cp caddy:/data/caddy/pki/authorities/local/root.crt ./caddy-local-root.crt
```

Then import `./caddy-local-root.crt` into your OS/browser trust store.

### Lint the repo

```bash
bun run lint
bun run lint:fix
```

### Authentication quickstart

- App route handlers: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, and `/api/auth/session` set or read the `gomoku_session` httpOnly cookie and enforce session expiry.
- App pages: `/signup`, `/login`, and the protected `/account` page (redirects unauthenticated visitors).
- The `/signup` and `/login` pages now submit through Next.js form actions instead of client-side `fetch` calls.
- OAuth login uses Better Auth's built-in GitHub and Google social providers. Add the provider credentials from `.env.example`, then configure these callback URLs in each provider console:
  - GitHub: `http://localhost:3000/api/auth/callback/github`
  - Google: `http://localhost:3000/api/auth/callback/google`
  - Docker/Caddy mode: use the same paths under `https://localhost:8443`
- Account linking and unlinking for GitHub and Google is available from `/account` after sign-in. Unlinking the final sign-in method is blocked to avoid account lockout.
- Seeded demo users (Alice, Bob, Carol) all use the password `password123`.

### Format the repo

```bash
bun run format:check
bun run format
```

### Git hooks

Pre-commit hooks are managed with `simple-git-hooks` and run `lint-staged` on staged files only.

Staged JavaScript and TypeScript files run through Oxlint and Oxfmt, staged CSS files run through Stylelint and Oxfmt, and staged JSON/Markdown/config files run through Oxfmt.

Do not regenerate lockfiles with npm. Commit the Bun lockfiles instead.

# Resources

# Team Information

- Project Manager (PM): athonda
  - Organise team meetings and ensure that the project is progressing according to schedule
  - Track the progress and deadlines
- Tech Lead (TL): cgoh
  - Final say on technical decisions and architecture
  - Reviews our code before we merge it into the main branch
- Product Owner (PO): mintan
  - Defines the product vision and requirements
  - Prioritizes features and user stories
- Developers: cgoh, athonda, mintan
  - Responsible for implementing the features and functionality of the project
  - Test abd document our work

# Project Management

# Technical Stack

- Full-stack framework: Next.js
- Database ORM: Prisma
- Database: PostgreSQL
- Realtime transport: Socket.IO
- Package manager: Bun

# Database Schema

# Features List

# Modules

## Web

1. A full-stack framework: a single Next.js app now handles the UI, route handlers, and custom realtime server
2. WebSockets: Socket.IO was used for real-time communication between the client and server. This was used for features such as live chat and the gomoku game
3. User interaction: Users can chat with each other, view each other's profiles, and add other users as friends
4. An ORM was used to manage the database, allowing for easy querying and manipulation of data

## User Management

1. Users can create accounts, log in and update their own profiles. They will also have access to a profile page to update their own information. Their friends' profile information can also be viewed
2. Game statistics and match history are also tracked and displayed on the user's profile page
3. Users can used OAuth 2.0 to log in with their Google or GitHub accounts
4. User activty analytics and insights are also displayed on a dashboard

## Artificial Intelligence

1. An AI opponent was implemented for the gomoku game

## Gaming and user experience

1. Users can play against each other in real-time, with a live chat feature to communicate during the game
2. The gameplay takes place on separate computers and takes place in real-time

## Advanced Search Minor Module

The leaderboard and signed-in profile match-history views expose evaluation-ready advanced search.

- Leaderboard controls are visible on `/leaderboard` and are reflected in URL/API params: `q`, `scope`, `band`, `minRating`, `maxRating`, `minMatches`, `sort`, `page`, and `limit`.
- Match-history controls are visible on `/profile` and are reflected in `/api/profile/stats` params: `opponent`, `result`, `matchType`, `dateFrom`, `dateTo`, `sort`, `page`, and `limit`.
- Shared parsing and Prisma filter helpers live in `app/lib/advanced-search.ts`; leaderboard query composition lives in `app/lib/leaderboard.ts`, and match-history query composition lives in `app/lib/matches/match-history.ts`.
- Pagination is server-backed and clamps to valid pages after filters or sort changes, so combined search/filter/sort/page flows do not reuse stale rows.
- E2E coverage for a combined leaderboard search + rank-band filter + minimum-match filter + custom sort + pagination flow is in `tests/e2e/pagination.e2e.ts`.

## DevOps

1. The project currently runs as a Next.js app, a dedicated Bun realtime service for Socket.IO, a Caddy HTTPS reverse proxy, and PostgreSQL in Docker

# Individual Contributions
