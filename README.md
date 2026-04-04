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
(cd apps/frontend && bun install)
(cd apps/backend && bun install)
```

The backend install intentionally skips dependency lifecycle scripts. Generate the Prisma client with the Bun command below after installing backend dependencies.

### Run locally without containers

Start PostgreSQL in Docker first so the host-side `DATABASE_URL` in `.env` can reach `localhost:5432`:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d database
```

Then run the backend and frontend from your host shell:

```bash
(cd apps/backend && bun run dev)
(cd apps/frontend && bun run dev)
```

The frontend uses Next's default Turbopack dev server. The backend's custom
Next server currently forces webpack in development because that path is more
reliable with Prisma + `pg` externals.

### Prisma workflow

```bash
(cd apps/backend && bun run prisma:generate)
(cd apps/backend && bun run prisma:migrate:dev -- --name <migration-name>)
```

For host-side Prisma commands, `DATABASE_URL` should point to `localhost:5432`. In containers, Compose still injects a container-only URL that uses `database:5432`.

When `schema.prisma` changes, create a migration locally with `prisma migrate dev`,
verify it, and commit the generated `apps/backend/prisma/migrations/` files.

This repo now applies committed migrations on container startup with
`prisma migrate deploy` instead of syncing the schema with `db push`.

If you were already using the old `db push` workflow locally, do a one-time reset
before the first migration-based run:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml down -v
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d database
```

### Run the full stack with containers

```bash
docker compose up --build
```

This runs the app in a production-style container mode.

### Run the full stack in Docker dev mode

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

This override switches the frontend and backend to development mode, mounts the source tree into the containers, enables hot reload while keeping PostgreSQL in Docker, and publishes PostgreSQL on `localhost:5432` for host-side Prisma and backend commands.

### Lint the repo

```bash
bun run lint
bun run lint:fix
```

### Format the repo

```bash
bun run format:check
bun run format
```

### Git hooks

Pre-commit hooks are managed with `simple-git-hooks` and run `lint-staged` on staged files only.

Staged TypeScript files run through ESLint and Prettier, staged CSS files run through Stylelint and Prettier, and staged JSON/Markdown/config files run through Prettier.

The ESLint setup also includes `eslint-plugin-prefer-arrow` to encourage arrow functions where they improve consistency without forcing top-level standalone declarations to change.

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

1. A full-stack framework: Next.js was used for both frontend and backend development
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

## DevOps

1. The project's backend was designed as microservices, allowing for scalability and maintainability

# Individual Contributions
