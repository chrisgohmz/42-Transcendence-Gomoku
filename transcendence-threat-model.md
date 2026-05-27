# Transcendence Threat Model

Generated: 2026-05-26

Scope: repository-grounded threat model for the current Docker Compose + Caddy evaluation deployment, with notes for a possible future Vercel deployment. This model covers the Next.js app, custom API Route Handlers, Better Auth integration, Prisma/PostgreSQL, Socket.IO realtime service, Caddy ingress, Docker runtime, backup sidecar, and uploaded avatar storage.

Assumptions confirmed by the user:

- Current production/evaluation ingress is Docker Compose + Caddy. Database and realtime internal endpoints are intended to stay private on the Docker network.
- Vercel may be considered later, but is not the current deployment target.
- User stats and match history are intentionally public.
- Rate limiting should be owned inside the app. Next.js production does not provide general application-level rate limiting by default.

## Executive Summary

The system has a reasonable security baseline for a student/full-stack game app: authenticated sessions, runtime validation on many sensitive inputs, Prisma for database access, authorization checks on match/chat access, and private Docker networking for database and realtime internal calls.

The most important abuse paths are not exotic. They are dependency exposure, missing rate limits, missing app-level CSRF/origin guards on custom mutation APIs, weak browser hardening headers, raw error leakage, upload hardening gaps, and secret reuse between auth and realtime internals.

The top remediation themes are:

1. Patch dependency advisories and add CI audit enforcement.
2. Add app-owned rate limiting for auth, queue, match, chat, friend, and upload flows.
3. Add a shared same-origin/CSRF guard for all mutating custom Route Handlers.
4. Add security headers and CSP at Caddy or Next.js.
5. Separate realtime internal secrets from Better Auth secrets.
6. Harden avatar upload serving and run containers as non-root.

## Remediation Status

Implemented across `security-audit-remediation` and follow-up avatar hardening:

- Dependency audit: `bun audit` passes after dependency updates and root-level Bun overrides.
- Rate limiting: shared app limiter added for auth, game, chat, friend, profile, and upload mutation paths.
- CSRF/origin: mutating custom Route Handlers now enforce trusted origins and JSON content type where applicable.
- Browser hardening: global security headers and CSP are configured in `next.config.ts`.
- Error leakage: public API responses no longer include raw exception details.
- Uploads: avatar storage now uses detected image type extensions, random filenames, image re-encoding, metadata stripping, storage outside `public/`, and an explicit avatar serving route.
- Secret separation: production requires `REALTIME_INTERNAL_SECRET` instead of falling back to `BETTER_AUTH_SECRET`.
- Container hardening: production runtime now switches to the non-root `node` user.

Remaining design notes:

- The in-app limiter is memory-backed, which matches the current single-container evaluation topology. A future multi-instance or Vercel deployment should move rate-limit counters to shared storage.
- CSP currently keeps `'unsafe-inline'` for compatibility with the existing Next.js app. A stricter nonce-based CSP would be a follow-up hardening project.

## System Model

### Components

- Browser clients using localized Next.js pages and React components.
- Next.js app server exposing pages, Server Actions, and custom `/api/*` Route Handlers.
- Better Auth for email/password and OAuth-backed session management.
- PostgreSQL accessed through Prisma.
- Bun Socket.IO realtime service for match, friendship, chat, queue, and challenge notifications.
- Caddy reverse proxy exposing HTTPS and routing `/socket.io/*` to realtime.
- Docker Compose network, volumes, and backup sidecar.
- Avatar storage mounted at `/app/storage` and served through `/api/avatars/[filename]`.

### Current Request Flow

1. Browser enters through Caddy.
2. Caddy proxies `/socket.io/*` to realtime and all other requests to Next.js.
3. Next.js authenticates via Better Auth session cookies and performs database reads/writes through Prisma.
4. Next.js publishes internal realtime events to realtime service endpoints using `x-realtime-internal-secret`.
5. Realtime authenticates browser sockets with Better Auth session context before joining user, match, or chat rooms.
6. PostgreSQL stores users, sessions, accounts, conversations, matches, moves, profile data, uploaded avatar references, and operations data.
7. Backup sidecar periodically writes database dumps into a Docker volume.

## Assets

### High-Value Assets

- Better Auth session tokens and session cookie integrity.
- `BETTER_AUTH_SECRET`.
- OAuth provider credentials and OAuth account tokens stored in the account table.
- `REALTIME_INTERNAL_SECRET`.
- PostgreSQL data and backup artifacts.
- Direct-message bodies and conversation membership.
- Match private-room passwords and challenge decline tokens.
- User account identifiers, emails, password hashes, verification tokens, and reset tokens.
- Operations status token and operations allowlists.

### Public Or Low-Sensitivity Assets

- Public profile display names and usernames.
- User stats, ratings, win/loss counts, and match history, by confirmed product decision.
- Public leaderboard data.
- Public lobby listings.

## Trust Boundaries

| Boundary                      | Trusted Side                    | Untrusted Side                    | Notes                                                      |
| ----------------------------- | ------------------------------- | --------------------------------- | ---------------------------------------------------------- |
| Browser to Caddy              | Caddy/app infrastructure        | Internet users and browsers       | All user input starts here.                                |
| Caddy to Next.js              | Docker network                  | Public internet                   | Caddy is expected to be the only public app ingress.       |
| Caddy to realtime             | Docker network                  | Public Socket.IO clients          | Browser socket auth still required.                        |
| Next.js to PostgreSQL         | App server and Prisma           | Route/user input                  | Prisma lowers injection risk but authz is still app-owned. |
| Next.js to realtime internals | App server                      | Realtime internal endpoints       | Protected by shared internal secret.                       |
| Realtime socket rooms         | Authenticated socket handlers   | Client-provided room IDs/payloads | Room joins must remain server-authorized.                  |
| Avatar storage and serving    | Server filesystem/Route Handler | User-supplied files               | File type normalization and explicit image headers matter. |
| Docker host/volumes           | Operators                       | App container processes           | Root containers raise post-compromise impact.              |

## Attacker Capabilities

- Anonymous internet user can visit public pages, signup/login, hit public APIs, and open Socket.IO connections.
- Authenticated user can create rooms, join queues, submit moves, send messages to accepted friends, upload avatars, and trigger realtime events.
- Malicious authenticated user can script high request volume, race game actions, attempt ID guessing, and upload malformed images.
- Cross-site attacker can attempt browser-driven state changes against cookie-authenticated endpoints.
- Network attacker is mostly out of scope when HTTPS through Caddy is working, but future non-local deployments need real trusted certificates.
- Insider or compromised service with access to Docker network can attempt internal realtime endpoint calls if the internal secret is known.
- Supply-chain attacker can exploit vulnerable packages if vulnerable code paths become reachable in production or CI.

## Attack Surfaces

- Auth APIs: `/api/auth/signup`, `/api/auth/login`, `/api/auth/logout`, Better Auth catch-all routes, password reset and verification flows.
- Game APIs: create/join/cancel/resign/queue/move/state/challenge routes under `/api/matches`.
- Chat APIs: conversation list, direct conversation creation, message send/read APIs.
- Profile APIs/actions: public profile pages, stats, history, avatar upload Server Action.
- Realtime service: browser Socket.IO namespace and internal `/internal/*` publish endpoints.
- Operations endpoints: `/api/health`, `/api/status`, `/status`.
- Static assets under `public/` and avatar files served through `/api/avatars/[filename]`.
- Docker/Caddy/PostgreSQL/backup scripts and volumes.
- Dependency installation/build/runtime graph.

## Top Abuse Paths

| ID  | Abuse Path                                       | Impact                                                              | Existing Controls                                                            | Gaps                                                          | Recommended Mitigations                                               |
| --- | ------------------------------------------------ | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------- |
| T1  | Abuse vulnerable dependency path from lockfile   | Runtime or build-time compromise, DoS, memory disclosure            | Bun lockfile, Caddy ingress                                                  | `bun audit` has high/moderate findings                        | Update dependencies, move tooling to dev deps, CI audit gate          |
| T2  | Credential stuffing or signup abuse              | Account takeover attempts, user enumeration pressure, DB/email load | Input validation, Better Auth credential handling                            | No repo-visible rate limits                                   | Add IP/account rate limits and generic auth responses                 |
| T3  | Browser-driven CSRF against custom mutation APIs | Queue/match/chat/logout side effects                                | SameSite cookies, JSON APIs, Better Auth guards for auth endpoints           | Custom mutation handlers lack shared origin/CSRF guard        | Add shared same-origin guard and JSON content-type enforcement        |
| T4  | Authenticated request flooding                   | DB/realtime exhaustion, queue churn, match spam, chat spam          | Auth checks, some idempotency in moves                                       | No app-owned throttles                                        | Per-user/IP quotas for game, chat, queue, upload, friend flows        |
| T5  | Raw error leakage                                | Internal schema/service detail disclosure                           | Production mode configured                                                   | Many handlers return `error.message`                          | Generic client errors plus server-side structured logs                |
| T6  | Upload content confusion                         | Stored malicious/polyglot file, metadata leakage, storage growth    | 5 MB limit, magic-byte checks, canonical extension, re-encode, route headers | Multi-instance storage and quota strategy remains future work | Shared object storage or volume quotas for multi-instance deployments |
| T7  | Realtime internal secret reuse                   | Wider blast radius if auth secret leaks                             | Caddy does not proxy internals                                               | Internal secret falls back to Better Auth secret              | Require distinct `REALTIME_INTERNAL_SECRET` in production             |
| T8  | Missing browser security headers                 | Weaker XSS/clickjacking/MIME-sniffing defense                       | React escaping, no dangerous sinks found                                     | No CSP/security headers in Next/Caddy config                  | Add CSP, nosniff, frame-ancestors, referrer, permissions policy       |
| T9  | Container post-compromise privilege              | Larger container blast radius                                       | Docker isolation                                                             | App/realtime run as root                                      | Add non-root production user and narrow writable paths                |
| T10 | Sensitive code knowledge concentrated            | Slower review/incident response                                     | 17 contributors in history                                                   | Auth ownership concentrated                                   | CODEOWNERS and secondary reviewer requirements                        |

## Focus Paths

### Authentication And Sessions

Observed controls:

- Better Auth is used for session and OAuth flows.
- Login and signup validate payloads before calling Better Auth.
- Account linking requires verified local email.
- Password reset revokes sessions.
- Better Auth cookies default to HttpOnly/SameSite behavior in the installed package.

Threats:

- Credential stuffing against login.
- Signup flooding.
- User enumeration through duplicate-account or email verification behavior.
- Session theft through future XSS or weak CSP.
- CSRF/state-change attempts against custom app APIs using the same session cookie.

Mitigations:

- Add app-level rate limiting for login, signup, reset request, and verification resend.
- Keep auth errors generic where possible.
- Add CSP and security headers.
- Apply same-origin/CSRF guard to custom application mutations.
- Keep `BETTER_AUTH_SECRET` distinct from all service-to-service secrets.

### Match And Queue Flows

Observed controls:

- Protected endpoints require a session.
- Move submission verifies participant ownership before writing.
- Move writes use transaction and guarded state-version transitions.
- Private room passwords are hashed.
- Challenge matching checks friendship before creating a private challenge.

Threats:

- Authenticated user spams queue, room creation, joins, cancels, resigns, or moves.
- Race attempts against game state.
- CSRF against cookie-authenticated match mutations.
- Error details leak Prisma constraints or internal state.

Mitigations:

- Add per-user and per-IP quotas.
- Keep idempotency keys for moves and extend them where useful.
- Add same-origin checks to all mutating match endpoints.
- Return generic errors to clients.
- Monitor queue churn and abnormal move rates.

### Chat And Friendship

Observed controls:

- Direct conversations require accepted friendship.
- Conversation access is checked before message access.
- Realtime chat subscriptions use authorization helpers.

Threats:

- Authenticated chat spam.
- CSRF to create conversations or mark messages read.
- Message body storage abuse if max size/content policy is weak.
- Future frontend rendering regressions could turn message content into XSS.

Mitigations:

- Add message send/read/conversation rate limits.
- Add server-side message size limits and content validation.
- Keep React text rendering as the only message rendering path.
- Add CSP and avoid rich HTML rendering unless sanitized.

### Realtime Service

Observed controls:

- Browser sockets are authenticated from Better Auth sessions.
- User rooms require socket identity match.
- Match and chat subscriptions verify DB authorization.
- Caddy only proxies `/socket.io/*`, not internal realtime endpoints.

Threats:

- Socket connection floods.
- Unauthorized room join attempts.
- Internal publish endpoint abuse if the service-to-service secret leaks.
- Challenge payload leakage through misdirected user rooms.

Mitigations:

- Rate-limit socket connections and subscription attempts.
- Require distinct `REALTIME_INTERNAL_SECRET` in production.
- Keep internal endpoints unreachable from public ingress.
- Log rejected subscription attempts with route/event names and user IDs.

### Uploads And Static Media

Observed controls:

- File must be a `File`.
- Size must be greater than 0 and at most 5 MB.
- JPEG, PNG, and WebP magic bytes are checked.
- Uploads are written to a dedicated public uploads directory.

Threats:

- Polyglot image/static file confusion.
- User-controlled extension influences static content type.
- Image metadata leakage.
- Storage exhaustion by repeated avatar uploads.

Mitigations:

- Canonicalize extension from detected type.
- Re-encode and strip metadata.
- Serve through a controlled route or add strict static headers.
- Rate-limit uploads and clean up old avatar files.

### Operations, Health, And Backups

Observed controls:

- `/api/status` requires an allowlisted session or operations token.
- Backup sidecar writes dumps to a separate Docker volume.
- Restore script requires explicit confirmation.

Threats:

- `/api/health` leaks raw DB errors during failure.
- Backup dumps contain all sensitive data.
- Operations token misuse if weak or logged.
- Restore commands are destructive if run against live data.

Mitigations:

- Return generic health failure messages publicly.
- Treat backup volume as sensitive data.
- Rotate and strongly randomize operations tokens.
- Keep restore drills documented and isolated.

### Deployment And Future Vercel Variant

Current Docker/Caddy deployment:

- Caddy is the intended public boundary.
- Database and realtime internal endpoints stay on the Docker bridge network.
- Rate limiting must be implemented in app and can optionally be supplemented by Caddy or an upstream proxy.

Future Vercel deployment considerations:

- Re-evaluate Socket.IO hosting because long-lived sockets and internal realtime routes may need a separate service.
- Use a shared external store for rate limits, such as Redis, because serverless instances are not stable counters.
- Configure security headers through Next.js or Vercel configuration.
- Re-check trusted origins, OAuth callback URLs, cookie secure behavior, and environment variables.
- Keep database and realtime internal service endpoints private.

## Ownership And Operational Notes

The ownership map generated under `security-audit/ownership-map-out/` found no orphaned sensitive code, but auth-tagged code ownership is concentrated. Add CODEOWNERS or review rules for:

- `app/api/auth/**`
- `app/lib/auth*`
- `app/api/matches/**`
- `app/api/conversations/**`
- `realtime/**`
- `shared/realtime-internal.ts`
- `prisma/schema.prisma`
- `prisma/migrations/**`
- `Dockerfile`
- `docker-compose*.yml`
- `infra/caddy/**`

## Security Requirements Backlog

1. `bun audit` must pass without high vulnerabilities before release.
2. Mutating custom Route Handlers must enforce same-origin or CSRF token validation.
3. Auth, matchmaking, match mutation, chat, friend, upload, and reset flows must have app-owned rate limits.
4. Client responses must not include raw exception messages.
5. Caddy or Next.js must set security headers and CSP.
6. Realtime internal calls must use a distinct secret in production.
7. Uploaded images must use canonical content type and extension, with metadata stripping where practical.
8. Production containers must run as non-root.
9. Backup artifacts must be treated as sensitive production data.
10. Security-sensitive paths must have explicit review ownership.

## Quality Check

- Grounded in repository files and generated audit artifacts.
- Includes current Docker/Caddy deployment and future Vercel considerations.
- Separates intentionally public data from sensitive assets.
- Highlights both code-level and operational risks.
- Avoids claiming confirmed exploitability where evidence only shows missing defense-in-depth.
- Aligns with local Next.js docs: production self-hosting should use reverse proxy protections, and app/backend code should implement rate limiting for expensive or abuse-prone operations.
