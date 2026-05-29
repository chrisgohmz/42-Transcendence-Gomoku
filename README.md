_This project has been created as part of the 42 curriculum by cgoh, athonda, mintan, jngew, myuen._

# Gomoku Heroes

## Description

Gomoku Heroes is a full-stack competitive Gomoku web application for the 42 `ft_transcendence` project. Players can create an account, train against an adjustable AI opponent, play live browser matches against other users, manage friends, exchange direct messages, inspect match history, and follow a ranked leaderboard.

The project is built around the subject requirements for a web application with a frontend, backend, database, HTTPS container deployment, multiple simultaneous users, clear team roles, and a documented module plan worth at least 14 points.

Key features:

- Email/password authentication, password reset, and optional GitHub/Google OAuth.
- Localized UI in English, Japanese, and Chinese.
- Server-authoritative Gomoku matches with live Socket.IO updates.
- Human lobby with public/private rooms, matchmaking, direct challenges, and reconnect handling.
- AI solo mode using a depth-limited minimax engine with alpha-beta pruning and difficulty presets.
- Friends, online presence, direct messages, unread state, and realtime social notifications.
- Profiles with avatars, visibility controls, game stats, achievements, progression, and match history.
- Searchable leaderboard and profile history with filters, sorting, and pagination.
- Docker Compose deployment with PostgreSQL, Redis, Caddy HTTPS, a Next.js app, a realtime service, and backup/status workers.

## Instructions

### Prerequisites

- Docker and Docker Compose.
- Bun `1.3.14` for local commands. The repo uses Bun as the package manager.
- Node.js `24` if running the Next.js or Prisma tooling directly on the host.
- A browser compatible with the latest stable Google Chrome. The project also has Playwright coverage for additional browser diagnostics.

### Configure Environment

Copy the example environment file and edit secrets before starting the stack:

```bash
cp .env.example .env
```

Minimum local values to review:

- `POSTGRES_PASSWORD`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `BETTER_AUTH_TRUSTED_ORIGINS`
- `REALTIME_INTERNAL_SECRET`
- Optional OAuth values: `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- Optional operations access: `OPERATIONS_STATUS_USER_IDS`, `OPERATIONS_STATUS_USERNAMES`, `OPERATIONS_STATUS_TOKEN`

The default Docker entrypoint is `https://localhost:8443`. Caddy uses an internal local CA, so browsers may warn until the local root certificate is trusted.

### Run With Containers

Production-style local stack:

```bash
docker compose up --build
```

Open:

```text
https://localhost:8443
```

Development stack with mounted source and hot reload:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

The `Makefile` wraps the development compose command:

```bash
make dev
make logs
make down
```

### Run App Services Locally

Install host dependencies once:

```bash
bun install
```

Start database and Redis in Docker:

```bash
docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d database redis
```

Then run the app services in separate shells:

```bash
bun run dev
bun run dev:realtime
bun run realtime:drain-outbox:loop
```

Use host-side URLs in `.env` for this mode, for example:

```text
DATABASE_URL=postgresql://transcendence:change_me_please@localhost:5432/transcendence?schema=public
REDIS_URL=redis://localhost:6379/0
REALTIME_INTERNAL_URL=http://localhost:3001/internal/game-update
```

### Database Workflow

```bash
bun run prisma:generate
bun run prisma:migrate:dev -- --name <migration-name>
bun run prisma:migrate:deploy
bun run prisma:seed
```

The seed command creates evaluation-friendly demo users, matches, friendships, achievements, stats, and messages. Seeded demo passwords use `password123`.

### Quality Checks

```bash
bun run lint
bun run format:check
bun run typecheck
bun test
bun run test:e2e
```

Useful targeted checks:

```bash
bun run test:prisma:seed
REDIS_SMOKE_URL=redis://:change_me_please@127.0.0.1:6379/0 bun run test:redis:smoke
./scripts/postgres-restore-drill.sh
```

## Team Information

| 42 login | GitHub user | Role(s)                                   | Responsibilities                                                                                                                                                                                       |
| -------- | ----------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| cgoh     | chrisgohmz  | Technical Lead / Architect, Developer     | Architecture, stack decisions, auth, security, Docker/CI, realtime architecture, AI mode, code review, and release hardening.                                                                          |
| athonda  | ra121e      | Product Owner, Developer                  | Product direction, feature priorities, game-state slices, realtime game updates, statistics, leaderboard, Japanese localization, and validation follow-up.                                             |
| mintan   | MJNeedsHelp | Project Manager / Scrum Master, Developer | Team coordination, progress tracking, early README structure, navigation and legal surfaces, homepage/leaderboard/game page UI foundations, localized not-found flow, and evaluation-readiness checks. |
| jngew    | maxngew     | Developer                                 | Profile, friends, messaging pages, avatar/edit-profile UX, OAuth settings movement, human lobby UX, pagination, live notification polish, and accessibility fixes.                                     |
| myuen    | hermeszi    | Developer                                 | Direct conversation flow, message access rules, unread counts, friend-gated chat behavior, conversation tests, and social-route integration.                                                           |

All members contributed as developers. Some Git commits use local machine names or email variants; this table normalizes them to the GitHub usernames above.

## Project Management

- Work organization: feature slices were tracked through GitHub issues and pull requests. The repo history shows PR-based delivery for auth, realtime matches, AI mode, statistics, lobby, messaging, i18n, operations, and security hardening.
- Task breakdown: specs and scenario plans live under `specs/`; operational runbooks live under `docs/operations/`; design notes live under `docs/ui-docs/`.
- Communication channels: the team communicated through Slack for planning, review, and blocker handling, with implementation decisions captured in branches, PRs, docs, tests, and commit messages.
- Review process: significant changes were merged through PRs, and later hardening passes added regression tests, browser diagnostics, linting, and security checks.
- Evaluation practice: each member owns the areas listed in the contribution table and should be able to explain the relevant user flows, routes, schema, tests, and tradeoffs.

## Technical Stack

| Area                     | Technology                                                             | Why it was chosen                                                                                                                                            |
| ------------------------ | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Full-stack framework     | Next.js `16`, React `19`, App Router                                   | Provides file-system routing, Server Components, Route Handlers, metadata, server actions, and a single deployable app surface for UI and backend endpoints. |
| Runtime/package manager  | Bun `1.3.14`                                                           | Fast local scripts, tests, package management, and realtime service execution.                                                                               |
| Language                 | TypeScript                                                             | Shared types across app, realtime service, tests, and game payload validation.                                                                               |
| Styling/UI               | CSS, Tailwind CSS `4`, Radix UI, shadcn-style primitives, lucide-react | Gives accessible primitives, consistent controls, and a custom Gomoku visual system.                                                                         |
| Authentication           | Better Auth, Prisma adapter, Redis storage                             | Email/password, OAuth providers, sessions, password reset, account linking, and safer auth persistence.                                                      |
| Database                 | PostgreSQL `18`                                                        | Relational data fits users, matches, moves, friendships, conversations, achievements, and stats with strong constraints.                                     |
| ORM                      | Prisma `7`                                                             | Typed schema, migrations, generated client, and safer query composition.                                                                                     |
| Realtime                 | Socket.IO, Bun service, Redis adapter                                  | Live gameplay, chat, presence, friend notifications, reconnect handling, and horizontal fan-out support.                                                     |
| Cache/rate-limit storage | Redis `8`                                                              | Shared presence, Socket.IO fan-out, Better Auth secondary storage, and distributed rate-limit counters.                                                      |
| HTTPS/reverse proxy      | Caddy `2`                                                              | Single HTTPS entrypoint, internal local certificates, and routing `/socket.io/*` to the realtime service.                                                    |
| Validation/security      | Zod, same-origin guards, nonce CSP, rate limiting                      | Keeps user input and mutation routes validated on both client-facing and server-side paths.                                                                  |
| Testing                  | Bun test, Playwright                                                   | Unit, integration, and E2E coverage for auth, matches, social flows, localization, search, browser diagnostics, Redis, and seed data.                        |

## Architecture

```text
Browser
  |
  | HTTPS https://localhost:8443
  v
Caddy reverse proxy
  |-- /socket.io/* --------> Bun Socket.IO realtime service
  |                              |-- Redis presence/fan-out
  |                              |-- PostgreSQL match/session reads
  |
  `-- everything else ----> Next.js app
                                 |-- App Router pages and Server Components
                                 |-- Route Handlers under app/api
                                 |-- Better Auth
                                 |-- Prisma
                                 |-- PostgreSQL
                                 |-- Redis rate limits/auth storage
                                 `-- realtime internal publish endpoints

realtime-outbox worker
  `-- retries durable match realtime events after transient publish failures

database-backup sidecar
  `-- scheduled PostgreSQL custom-format dumps and restore-drill support
```

## Database Schema

The schema is defined in `prisma/schema.prisma` and migrated through `prisma/migrations/`.

```mermaid
erDiagram
  User ||--o| UserProfile : owns
  User ||--o{ Account : authenticates_with
  User ||--o{ UserSession : has
  User ||--o{ Friendship : participates
  User ||--o{ ConversationParticipant : joins
  User ||--o{ DirectMessage : sends
  User ||--o{ MatchParticipant : plays
  User ||--o{ Match : creates
  User ||--o{ UserGameStats : accumulates
  User ||--o{ UserAchievement : unlocks
  User ||--o{ AnalyticsEvent : emits
  UserProfile }o--o| AvatarMedia : uses
  Conversation ||--o{ ConversationParticipant : contains
  Conversation ||--o{ DirectMessage : contains
  Match ||--o{ MatchParticipant : has
  Match ||--o{ MatchMove : records
  Match ||--o| Conversation : may_have
  Match ||--o{ AnalyticsEvent : has
  MatchParticipant ||--o{ MatchMove : submits
  AchievementDefinition ||--o{ UserAchievement : defines
```

Important models:

| Model                                                      | Purpose                                                                              | Key fields                                                                                             |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ |
| `User`                                                     | Human and bot identities.                                                            | `id`, `kind`, `username`, `displayName`, `email`, `avatarUrl`, `lastSeenAt`                            |
| `Account` / `UserSession` / `Verification`                 | Better Auth credentials, OAuth accounts, sessions, and reset/verification tokens.    | `providerId`, `password`, `sessionToken`, `expiresAt`, `identifier`, `value`                           |
| `UserProfile` / `AvatarMedia`                              | Profile metadata, visibility, uploaded avatars, and storage metadata.                | `tagline`, `countryCode`, `language`, `timezone`, `visibility`, `storageKey`, `contentType`            |
| `Friendship`                                               | Friend requests and friend/block states using a normalized user pair.                | `userLowId`, `userHighId`, `requestedById`, `status`                                                   |
| `Conversation`, `ConversationParticipant`, `DirectMessage` | Direct, group, and match conversations with read state and message history.          | `kind`, `directKey`, `lastReadAt`, `body`, `deletedAt`                                                 |
| `Match`, `MatchParticipant`, `MatchMove`                   | Server-authoritative Gomoku rooms, participants, seats, moves, and terminal results. | `status`, `visibility`, `ruleType`, `boardSize`, `nextTurnSeat`, `winningSeat`, `moveNumber`, `x`, `y` |
| `UserGameStats`                                            | Per-user stats by rule and board size.                                               | `matchesPlayed`, `wins`, `losses`, `draws`, `rating`, `bestStreak`                                     |
| `AchievementDefinition`, `UserAchievement`                 | Persistent achievements, points, progress, and completion state.                     | `code`, `points`, `progress`, `completedAt`                                                            |
| `AnalyticsEvent`                                           | Event log for future analytics and seeded evaluation data.                           | `eventType`, `properties`, `createdAt`                                                                 |
| `RealtimeOutboxEvent`                                      | Durable retry queue for realtime publishes.                                          | `topic`, `payload`, `status`, `attempts`, `availableAt`                                                |

## Features List

| Feature                  | Functionality                                                                                                                                                     | Main contributors                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| Authentication           | Email/password signup and login, secure sessions, logout, password reset, provider linking, and OAuth callback feedback.                                          | cgoh, jngew                         |
| Localized routing        | English, Japanese, and Chinese routes, localized metadata, translated auth/social/game/legal pages, and localized global 404 behavior.                            | athonda, mintan, cgoh               |
| Legal pages              | Accessible Terms of Service and Privacy Policy pages linked from the footer and auth surfaces.                                                                    | mintan, cgoh                        |
| Gomoku board and rules   | Shared board rendering, move validation, five-in-a-row win detection, server-authoritative move writes, and match-state reconstruction.                           | athonda, cgoh                       |
| Human play               | Public/private room creation, room passwords, lobby table, matchmaking, joins, resign/cancel flows, direct challenges, and reconnect resilience.                  | cgoh, athonda, jngew                |
| Realtime service         | Authenticated Socket.IO lifecycle, match subscriptions, chat subscriptions, Redis presence, realtime friendship/chat/challenge notifications, and outbox retries. | cgoh, athonda, myuen, jngew         |
| AI solo mode             | Private match against `Kata Reader`, AI turn endpoint, minimax/alpha-beta engine, candidate pruning, and four difficulty presets.                                 | cgoh                                |
| Friends                  | Friend requests, accept/decline/remove flows, friend-scoped presence, friend leaderboard scope, and realtime updates.                                             | jngew, myuen, cgoh, athonda         |
| Messages                 | Friend-gated direct conversations, unread counts, read state, direct conversation routes, realtime message delivery, and message E2E coverage.                    | myuen, jngew, cgoh                  |
| Profiles                 | Private and public profiles, edit profile form, avatar upload/normalization, profile visibility, linked account controls, stats, achievements, and match history. | jngew, cgoh, athonda                |
| Leaderboard/search       | Ranked leaderboard, friends scope, rank bands, rating and match filters, sort controls, server-backed pagination, and E2E coverage.                               | athonda, cgoh, jngew                |
| Stats/progression        | Result sync after terminal matches, ratings, streaks, match history, achievements, XP/level progress, and seeded evaluation data.                                 | athonda, cgoh                       |
| Operations               | `/status`, `/api/status`, `/api/health`, realtime health checks, backup sidecar, restore script, restore drill, and runbook documentation.                        | cgoh, mintan                        |
| Security hardening       | Same-origin mutation guards, JSON request enforcement, Redis-backed rate limits, nonce CSP, security headers, trusted origins, and avatar upload validation.      | cgoh                                |
| Testing and CI readiness | Bun unit/integration tests, Playwright E2E suites, localized route smoke tests, browser diagnostics, Redis smoke, seed smoke, and lint/format/typecheck scripts.  | cgoh, athonda, mintan, jngew, myuen |

## Modules

The subject requires 14 validated points. This implementation documents 23 points of implemented module value; validation is still based on evaluator demonstration, and bonus credit is capped by the subject rules.

| Category                               | Module                                                      | Type  | Points | Implementation                                                                                                                                                                                                                | Contributors                |
| -------------------------------------- | ----------------------------------------------------------- | ----- | -----: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Web                                    | Framework for frontend and backend                          | Major |      2 | Next.js App Router renders the UI and exposes backend Route Handlers; the Bun realtime service supports Socket.IO backend concerns.                                                                                           | cgoh, all                   |
| Web                                    | Real-time features with WebSockets                          | Major |      2 | Socket.IO updates matches, chat, challenges, friend state, presence, reconnects, and fan-out through Redis.                                                                                                                   | cgoh, athonda, jngew, myuen |
| Web                                    | User interaction                                            | Major |      2 | Profiles, friends, direct messages, online state, and social actions are first-class app flows.                                                                                                                               | jngew, myuen, cgoh          |
| Web                                    | ORM                                                         | Minor |      1 | Prisma schema, migrations, generated client, and typed query helpers cover all persisted data.                                                                                                                                | cgoh, athonda               |
| Web                                    | Server-side rendering                                       | Minor |      1 | App Router pages and layouts are Server Components by default, with dynamic metadata and server-side data access where needed.                                                                                                | cgoh, mintan, athonda       |
| Web                                    | Advanced search                                             | Minor |      1 | Leaderboard and profile match history support query, filters, sorting, and pagination.                                                                                                                                        | cgoh, athonda, jngew        |
| Web                                    | Custom design system                                        | Minor |      1 | Reusable Gomoku components include `PageShell`, `PageHeader`, `Surface`, `MetricCard`, `Badge`, `ActionCard`, `BoardShowpiece`, `AvatarToken`, `MiniTable`, `Button`, `Card`, `Input`, `Table`, `DropdownMenu`, and `Avatar`. | cgoh, mintan, jngew         |
| Accessibility and Internationalization | Multiple languages                                          | Minor |      1 | `next-intl` powers English, Japanese, and Chinese routes, messages, metadata, and route smoke tests.                                                                                                                          | athonda, mintan, cgoh       |
| User Management                        | Standard user management and authentication                 | Major |      2 | Users can register, log in, update profile information, upload avatars, manage friends, see online state, and view profile pages.                                                                                             | jngew, cgoh                 |
| User Management                        | Game statistics and match history                           | Minor |      1 | Match results sync to `UserGameStats`; private profiles expose stats, achievements, progression, and searchable history.                                                                                                      | athonda, cgoh               |
| User Management                        | OAuth 2.0                                                   | Minor |      1 | GitHub and Google providers are integrated through Better Auth, with linking/unlinking safeguards.                                                                                                                            | cgoh, jngew                 |
| Artificial Intelligence                | AI opponent                                                 | Major |      2 | `Kata Reader` plays legal Gomoku moves through a depth-limited minimax engine with alpha-beta pruning and difficulty tuning.                                                                                                  | cgoh                        |
| Gaming and UX                          | Complete web-based game                                     | Major |      2 | Users play live Gomoku matches with a shared board, clear turns, win/loss/draw/cancel states, and persisted moves.                                                                                                            | athonda, cgoh, jngew        |
| Gaming and UX                          | Remote players                                              | Major |      2 | Two users can play from separate browsers/computers through HTTPS, Socket.IO, server-side state, and reconnect handling.                                                                                                      | cgoh, athonda, jngew        |
| Gaming and UX                          | Gamification system                                         | Minor |      1 | Persistent achievements, badges, leaderboard placement, XP/level progress, and visual profile feedback.                                                                                                                       | athonda, cgoh               |
| DevOps                                 | Health check/status page with backups and disaster recovery | Minor |      1 | `/status`, `/api/status`, service health checks, PostgreSQL backup sidecar, restore script, restore drill, and runbook.                                                                                                       | cgoh, mintan                |

Total documented module value: **23 points**.

## Individual Contributions

| Member               | Contributions                                                                                                                                                                                                                                                                                                                               | Challenges and resolution                                                                                                                                                              |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cgoh / chrisgohmz    | Led architecture and stack choices; implemented Better Auth migration, password reset email flow, OAuth, security headers, nonce CSP, rate limits, Docker/Caddy/Redis integration, realtime service hardening, server-authoritative matches, matchmaking lifecycle, AI solo mode, outbox worker, CI/test hardening, and README/doc updates. | Balanced a large shared codebase with security requirements by adding regression tests, trusted-origin policy, Redis-backed rate limits, browser diagnostics, and operations runbooks. |
| athonda / ra121e     | Implemented early Socket.IO match subscriptions, move broadcasting, board state construction, match state restoration after reload, statistics/result-sync slices, leaderboard API/client work, friends leaderboard filtering, and Japanese localization for AI/game surfaces.                                                              | Turned prototype match payloads into stable server-authoritative state by iterating through slice plans, payload validation, type fixes, and tests.                                    |
| mintan / MJNeedsHelp | Started README/project structure, built early navigation/footer/legal-page foundations, homepage and leaderboard UI pieces, create-room card/game lobby UI, localized global not-found page, and helped stabilize evaluation-facing routes and status-related work.                                                                         | Worked through local Docker/VM constraints by reverting unsafe compose changes, keeping UI work focused, and adding localized route coverage.                                          |
| jngew / maxngew      | Built profile, friends, and messaging pages; profile edit/avatar UX; password change UI; OAuth settings placement; human lobby, room, and match layout polish; pagination for human lobby/friends/profile; live notification and accessibility fixes.                                                                                       | Connected UI prototypes to backend data and auth guards by resolving merge conflicts, adding pagination behavior, and refining accessible controls and layouts.                        |
| myuen / hermeszi     | Implemented direct conversation flow, friend-gated messaging, conversation unread counts, active conversation derivation, friendship verification before chat access, and message smoke/E2E updates.                                                                                                                                        | Tightened social access rules by ensuring only accepted friends could open or continue direct conversations and by updating route tests around the protected message composer.         |

## Evaluation Demo Checklist

1. Start the Docker stack with `docker compose up --build`.
2. Open `https://localhost:8443` and accept/trust the local Caddy certificate if needed.
3. Sign up with email/password or seed demo users with `bun run prisma:seed`.
4. Demonstrate localized routes with the language switcher: English, Japanese, and Chinese.
5. Show Terms of Service and Privacy Policy from the footer/auth pages.
6. Log in, edit the profile, upload/change avatar, and review linked provider controls.
7. Add a friend, send a message, and show realtime/unread behavior.
8. Create or join a human Gomoku room from `/human`; demonstrate live moves from two browsers.
9. Start `/ai`, pick a difficulty, and play against the AI.
10. Show leaderboard search/filter/sort/pagination and profile match-history filters.
11. Show `/status`, `/api/health`, backup commands, and the restore drill runbook.
12. Run key checks: `bun run lint`, `bun run typecheck`, `bun test`, and relevant Playwright E2E tests.

## Resources

- 42 subject: `ft_transcendence_v21.1.pdf`.
- Local Next.js docs read for this README: `node_modules/next/dist/docs/01-app/index.md`, `05-server-and-client-components.md`, `15-route-handlers.md`, and `14-metadata-and-og-images.md`.
- Next.js App Router documentation: https://nextjs.org/docs/app
- React Server Components: https://react.dev/reference/rsc/server-components
- Prisma documentation: https://www.prisma.io/docs
- PostgreSQL documentation: https://www.postgresql.org/docs/
- Better Auth documentation: https://www.better-auth.com/docs
- Socket.IO documentation: https://socket.io/docs/v4/
- Redis documentation: https://redis.io/docs/
- Docker Compose documentation: https://docs.docker.com/compose/
- Caddy documentation: https://caddyserver.com/docs/
- Playwright documentation: https://playwright.dev/docs/intro
- WCAG 2.1 accessibility reference: https://www.w3.org/TR/WCAG21/
- OWASP Cheat Sheet Series: https://cheatsheetseries.owasp.org/

### AI Usage

AI tools were used as engineering assistants, not as unreviewed owners of the project. Git history includes Codex/Copilot-assisted commits and follow-up human commits.

AI was used for:

- Drafting repetitive implementation scaffolding and tests.
- Refactoring and security-hardening suggestions.
- CI/log analysis and browser-test stabilization.
- Documentation and README restructuring.
- Code review support through Brooks/security-style sweeps.

The team kept responsibility for understanding, reviewing, testing, and explaining the resulting code. AI-generated output was adjusted to project context and validated with linting, type checks, unit tests, integration tests, E2E tests, and peer review.

## Known Limitations

- OAuth login requires valid GitHub/Google provider credentials in `.env`.
- Password reset defaults to console email mode unless SMTP credentials are configured.
- Local HTTPS uses Caddy's internal CA and may require manual trust setup.
- The documented module score lists implemented candidates; evaluators validate only features that are fully demonstrable during review.
- WAF/Vault, blockchain, tournament brackets, and full spectator mode are not claimed modules in this README.

## License

This repository is part of the 42 curriculum project work. See `LICENSE` for repository licensing details.
