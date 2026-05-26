# Security Best Practices Report

Generated: 2026-05-26

Scope: full repository static audit for the Next.js app, custom API Route Handlers, Better Auth integration, Prisma/PostgreSQL data layer, Socket.IO realtime service, Docker/Caddy deployment, dependency graph, and git ownership topology.

Methods used:

- Read the repo-provided security skills: `security-best-practices`, `security-threat-model`, and `security-ownership-map`.
- Read relevant local Next.js documentation from `node_modules/next/dist/docs/`.
- Ran static code searches for CSRF/origin guards, security headers, dangerous frontend sinks, raw SQL, outbound fetches, and rate limiting.
- Ran `bun audit`.
- Ran the ownership mapper: `python3 .agents/skills/security-ownership-map/scripts/run_ownership_map.py --repo . --out security-audit/ownership-map-out --since "12 months ago" --emit-commits`.

Limitations:

- This is a repository-grounded static audit, not a production penetration test.
- No live production environment, secret values, OAuth provider configuration, DNS, CDN, WAF, or external reverse-proxy configuration were inspected.
- The final threat model is intentionally deferred until the assumptions at the end of this report are confirmed.

## Executive Summary

No confirmed critical unauthenticated RCE, direct SQL injection, obvious stored XSS sink, or broad authorization bypass was found in the code reviewed.

The strongest controls observed are: Better Auth session integration, HttpOnly/SameSite session cookie defaults, zod/runtime validation on important auth and game payloads, Prisma ORM usage instead of ad hoc SQL, explicit authorization checks on match and direct-message access, authenticated Socket.IO subscriptions, and Docker/Caddy topology that does not publicly proxy realtime internal endpoints.

The highest-priority risks identified during the audit were:

1. The dependency graph had `bun audit` findings, including two high-severity `fast-uri` advisories and a runtime `ws` advisory through Socket.IO.
2. The app does not define centralized browser security headers or a CSP.
3. Cookie-authenticated, state-changing application APIs do not have a shared same-origin/CSRF guard visible in the repo.
4. Abuse-prone endpoints do not show rate limiting or resource throttling in app or Caddy configuration.
5. Several API handlers return raw exception messages to clients.

## Remediation Status

Updated on branch `security-audit-remediation`:

- Resolved dependency advisories with Bun overrides and refreshed `bun.lock`; `bun audit` now reports no vulnerabilities.
- Added app-level rate limiting for auth wrappers/actions, match creation/join/moves/queue/challenges, chat, friend actions, profile settings, and avatar uploads.
- Added same-origin/origin guards for mutating custom Route Handlers.
- Added global security headers, including CSP, `nosniff`, frame blocking, referrer policy, and permissions policy.
- Removed raw exception details from public API responses and moved diagnostics to server logs.
- Hardened avatar upload filenames by deriving the stored extension from detected image bytes and using random filenames.
- Required a distinct `REALTIME_INTERNAL_SECRET` in production Docker Compose and realtime startup.
- Switched the production Docker image to a non-root runtime user.

## Positive Controls Observed

- Authentication is consistently checked on protected Route Handlers using `getCurrentSession()` or Better Auth APIs.
- Match move submission verifies that the submitted participant belongs to the authenticated user before accepting a move (`app/api/matches/[id]/moves/route.ts:89`).
- Direct conversation creation checks accepted friendship before creating a DM (`app/api/conversations/direct/route.ts:59`).
- Profile image upload enforces size and magic-byte checks for JPEG, PNG, and WebP (`app/[locale]/profile/actions.ts:13`, `app/[locale]/profile/actions.ts:21`).
- The realtime service uses authenticated Socket.IO sessions and does not trust arbitrary room joins.
- Caddy only proxies `/socket.io/*` to realtime and all other public traffic to the app (`infra/caddy/Caddyfile:8`).
- The production Docker Compose database service is only on the internal bridge network, not directly published to the host (`docker-compose.yml:1`, `docker-compose.yml:144`).

## Findings

### SEC-001: Dependency Graph Contains High and Moderate Vulnerability Advisories

Rule ID: JS-DEPS-001

Severity: High

Location:

- `package.json:33`
- `package.json:44`
- `package.json:48`
- `package.json:54`
- `package.json:55`
- `package.json:56`

Evidence:

`bun audit` reported 13 advisories:

- High: `fast-uri <=3.1.1`, host-confusion and path-traversal advisories.
- Moderate: `ws >=8.0.0 <8.20.1`, uninitialized memory disclosure through `socket.io` and `socket.io-client`.
- Moderate: `postcss <8.5.10`, CSS stringify XSS advisory.
- Moderate: `@hono/node-server <1.19.13`.
- Moderate/low: `hono <4.12.18`.
- Moderate: `brace-expansion >=5.0.0 <5.0.6`.
- Moderate: `ip-address <=10.1.0`.
- Moderate: `qs >=6.11.1 <=6.15.1`.

The high `fast-uri` path is currently transitive through packages such as `shadcn`, `stylelint`, and Prisma tooling. The `ws` advisory is more directly relevant because Socket.IO is part of the realtime runtime.

Impact:

The practical exploitability depends on whether the vulnerable transitive package is reachable in production code paths. Even when some paths are dev/tooling-only, a vulnerable lockfile increases supply-chain risk, CI risk, and future accidental runtime exposure. The Socket.IO `ws` advisory is runtime-adjacent and should be prioritized.

Fix:

- Run `bun update` and re-run `bun audit`.
- Move CLI/tooling-only packages such as `shadcn` out of production dependencies if they are not imported by runtime code.
- Update Socket.IO dependencies as patched releases become available for the `ws` advisory.
- Consider dependency overrides for vulnerable transitive packages only after confirming compatibility.

Mitigation:

- Keep Caddy as the only public ingress.
- Avoid exposing local tooling servers in production.
- Add a CI job that fails on high-severity `bun audit` findings.

False positive notes:

Some high-severity findings appear to be reachable only through dev/tooling packages today. They are still included because the lockfile is the deployable dependency graph and `shadcn` is currently listed under production `dependencies`.

### SEC-002: Missing Centralized Security Headers and CSP

Rule ID: NEXT-HEADERS-001, NEXT-CSP-001, REACT-CSP-001

Severity: Medium

Location:

- `next.config.ts:61`
- `next.config.ts:71`
- `proxy.ts:5`
- `proxy.ts:7`
- `infra/caddy/Caddyfile:5`
- `infra/caddy/Caddyfile:13`

Evidence:

`next.config.ts` configures dev origins, cache components, Turbopack, and transpilation, but no `headers()` security policy. `proxy.ts` only wires `next-intl` middleware and excludes API/static/socket paths. The Caddyfile proxies traffic but does not set security headers.

Impact:

Without centralized headers, the app has weaker browser-side defense in depth against XSS, clickjacking, MIME sniffing, excessive referrer leakage, and overly broad browser permissions. This matters because the app has authenticated pages, chat content, user profile content, OAuth flows, and uploaded public media.

Fix:

- Add security headers in `next.config.ts` or Caddy:
  - `Content-Security-Policy`
  - `X-Content-Type-Options: nosniff`
  - `Referrer-Policy: strict-origin-when-cross-origin`
  - `Permissions-Policy`
  - `X-Frame-Options: DENY` or CSP `frame-ancestors 'none'`
- Start with a report-only CSP if needed, then enforce once violations are understood.
- If using CSP nonces, follow the local Next.js CSP docs because nonce-based CSP changes rendering/cache behavior.

Mitigation:

- Keep React escaping as the default rendering path.
- Continue avoiding `dangerouslySetInnerHTML`, `innerHTML`, `eval`, and `new Function`; no app usage was found in the static search.

False positive notes:

Headers could be applied outside this repo by a CDN or production ingress. They are not present in the repository-controlled Next.js or Caddy configuration.

### SEC-003: State-Changing Custom APIs Lack a Shared Same-Origin/CSRF Guard

Rule ID: NEXT-CSRF-001

Severity: Medium

Location:

- `app/api/matches/route.ts:29`
- `app/api/matches/[id]/moves/route.ts:52`
- `app/api/conversations/direct/route.ts:18`
- `app/api/matches/queue/route.ts:42`
- `app/api/matches/queue/route.ts:62`
- `proxy.ts:7`
- `app/lib/auth-origins.ts:85`
- `app/lib/auth-origins.ts:88`

Evidence:

Many state-changing APIs authenticate with cookies and then perform writes, but the repo does not show a shared `Origin`/`Referer` or CSRF-token check for application Route Handlers. The `proxy.ts` matcher excludes `/api`, so it is not enforcing an origin policy for APIs. `app/lib/auth-origins.ts` has origin helpers, but `isTrustedAuthOrigin()` returns true when the trusted-origin list is empty.

Examples:

- Create a match: `app/api/matches/route.ts:29`
- Submit a move: `app/api/matches/[id]/moves/route.ts:52`
- Create a direct conversation: `app/api/conversations/direct/route.ts:18`
- Join/cancel matchmaking queue: `app/api/matches/queue/route.ts:42`, `app/api/matches/queue/route.ts:62`

Impact:

SameSite=Lax cookies and JSON APIs reduce practical CSRF risk, and Better Auth-provided endpoints have their own origin protections. However, relying only on cookie defaults leaves state-changing application endpoints exposed to future cookie-setting changes, same-site sibling-domain attacks, unusual browser behavior, or endpoints that later accept simple form submissions. A CSRF or same-origin bypass could create/cancel rooms, join queues, mark messages read, submit game actions, or logout a user.

Fix:

- Add a shared request guard, for example `assertSameOriginRequest(request)`, and call it before every mutating app API.
- Reject unsafe methods when `Origin` is absent or not in the configured allowlist.
- Require `Content-Type: application/json` for JSON mutation endpoints.
- Make trusted-origin configuration fail closed in production instead of accepting every origin when no allowlist is configured.

Mitigation:

- Keep Better Auth cookies `HttpOnly`, `Secure`, and `SameSite=Lax`.
- Keep Caddy as the only public origin and avoid wildcard subdomains sharing the same site.

False positive notes:

Next.js Server Actions have framework-level origin checks, and Better Auth APIs perform their own checks. This finding is about custom app Route Handlers that mutate application state.

### SEC-004: No Visible Rate Limiting on Abuse-Prone Endpoints

Rule ID: NEXT-DOS-001

Severity: Medium

Location:

- `app/api/auth/login/route.ts:32`
- `app/api/auth/signup/route.ts:34`
- `app/api/matches/route.ts:29`
- `app/api/matches/[id]/moves/route.ts:52`
- `app/api/conversations/direct/route.ts:18`
- `app/api/matches/queue/route.ts:42`
- `infra/caddy/Caddyfile:5`

Evidence:

Static search did not find application rate limiting, throttling, or quota middleware. Caddy is configured as a simple reverse proxy and does not apply throttles. The repo has public or authenticated endpoints that can create users, attempt logins, create matches, submit moves, join queues, and create chat conversations.

Impact:

Attackers can attempt credential stuffing, account signup abuse, queue churn, match creation churn, move spam, and message/conversation spam. Even authenticated abuse can degrade database and realtime service performance.

Fix:

- Add IP plus account-based rate limits for login, signup, password reset, matchmaking, match creation, move submission, chat message creation, and friend requests.
- Apply stricter unauthenticated limits to auth endpoints.
- Apply per-user limits and idempotency controls to game/chat mutations.
- Log rate-limit events with request IDs and user IDs where available.

Mitigation:

- Keep Docker/Caddy as the public ingress.
- Use upstream infrastructure rate limiting if available, but document it because it is not visible in repo.

False positive notes:

An external CDN/WAF may provide this control in production. No such configuration is present in this repository.

### SEC-005: Raw Exception Messages Are Returned to Clients

Rule ID: NEXT-ERROR-001, NEXT-LOG-001

Severity: Medium

Location:

- `app/lib/api-errors.ts:13`
- `app/lib/api-errors.ts:17`
- `app/api/auth/login/route.ts:101`
- `app/api/auth/login/route.ts:104`
- `app/api/auth/signup/route.ts:143`
- `app/api/auth/signup/route.ts:146`
- `app/api/matches/route.ts:131`
- `app/api/matches/route.ts:135`
- `app/api/matches/[id]/moves/route.ts:267`
- `app/api/matches/[id]/moves/route.ts:280`
- `app/api/conversations/direct/route.ts:86`
- `app/api/conversations/direct/route.ts:88`
- `app/api/health/route.ts:17`
- `app/api/health/route.ts:23`

Evidence:

`getErrorMessage()` returns `error.message`, and several handlers put that value in a `detail` or `error` field in the client response. The unauthenticated health endpoint returns the raw database error message on failure.

Impact:

Raw exceptions can reveal database constraint names, table/column names, internal URLs, service names, validation internals, or library behavior. This makes targeted attacks easier and can accidentally expose operational details.

Fix:

- Return stable generic client errors.
- Log the raw exception server-side with a request ID, route name, user ID where available, and severity.
- Return the request ID to the client for support/debugging.
- Make `/api/health` return a generic degraded response unless the caller is an authenticated operations user or internal monitor.

Mitigation:

- Keep `NODE_ENV=production` in Compose.
- Avoid logging secrets or full request bodies in server logs.

False positive notes:

Some errors may be harmless today, but this pattern is broad enough that future database or internal-service errors could leak useful details.

### SEC-006: Profile Visibility Scope Should Be Clarified

Rule ID: APP-PRIVACY-001

Severity: Low

Location:

- `prisma/schema.prisma:51`
- `prisma/schema.prisma:109`
- `prisma/schema.prisma:116`
- `app/[locale]/profile/[username]/page.tsx:134`
- `app/[locale]/profile/[username]/page.tsx:175`
- `app/[locale]/profile/[username]/page.tsx:188`
- `app/[locale]/profile/[username]/page.tsx:228`
- `app/[locale]/profile/[username]/page.tsx:256`

Evidence:

The Prisma schema defines `ProfileVisibility` with `PUBLIC`, `FRIENDS`, and `PRIVATE`, and stores `UserProfile.visibility`. The public profile page fetches the `User` by username without loading the profile visibility, calculates friendship state, and then always loads and renders profile stats and recent match history. `isRevealed` only gates avatar/presence-style presentation, not stats or match history.

Impact:

After assumption validation, public stats and match history are intended product behavior and do not need to be hidden from other users. The remaining risk is policy ambiguity: future UI copy, settings, or contributors may interpret `UserProfile.visibility` as covering all profile data when the current implementation only gates reveal-style presentation such as avatar/presence.

Fix:

- Document exactly which profile fields `UserProfile.visibility` controls.
- Rename or split the setting if it only covers presence/avatar reveal.
- Add tests that assert stats and match history remain public by design while reveal-only fields stay gated.

Mitigation:

- Avoid UI copy that says private profiles hide stats or match history.

False positive notes:

This was downgraded after the product owner confirmed that stats and match history are intentionally public.

### SEC-007: Profile Image Upload Uses User-Controlled Extension and Public Static Storage

Rule ID: NEXT-FILES-001

Severity: Medium

Location:

- `app/[locale]/profile/actions.ts:13`
- `app/[locale]/profile/actions.ts:21`
- `app/[locale]/profile/actions.ts:74`
- `app/[locale]/profile/actions.ts:75`
- `app/[locale]/profile/actions.ts:80`
- `app/[locale]/profile/actions.ts:82`

Evidence:

The upload action validates file size and magic bytes, which is good. It then builds the stored filename from the user ID, timestamp, and `path.extname(file.name)`, writes bytes directly under `public/uploads`, and returns a static `/uploads/...` URL. The stored extension is taken from the original filename rather than from the detected image type, and the image is not re-encoded.

Impact:

Magic-byte validation blocks many dangerous uploads, including SVG, but user-controlled extensions and direct public serving still leave room for content-type confusion, image parser edge cases, polyglot files, metadata leakage, and long-lived public files. This risk becomes more important if public static headers are relaxed or future image formats are added.

Fix:

- Detect the image type and force a canonical extension: `.jpg`, `.png`, or `.webp`.
- Re-encode uploaded images with a trusted image library to strip metadata and normalize content.
- Serve avatars through a route that sets explicit `Content-Type`, `Content-Disposition: inline`, cache policy, and `X-Content-Type-Options: nosniff`.
- Consider storing uploads outside `public/` and deleting/replacing old avatars.

Mitigation:

- Keep the current 5 MB cap.
- Continue rejecting SVG and unknown file types.

False positive notes:

The existing magic-byte check substantially lowers risk. This is a hardening finding, not evidence of a currently exploitable arbitrary file upload.

### SEC-008: Realtime Internal Secret Falls Back to the Better Auth Secret

Rule ID: APP-SECRETS-001

Severity: Medium

Location:

- `shared/realtime-internal.ts:130`
- `shared/realtime-internal.ts:131`
- `docker-compose.yml:65`
- `docker-compose.yml:67`
- `docker-compose.yml:103`
- `README.md` realtime setup section

Evidence:

`readRealtimeInternalSecret()` returns `REALTIME_INTERNAL_SECRET` or falls back to `BETTER_AUTH_SECRET`. Docker Compose sets `REALTIME_INTERNAL_SECRET` to an empty default unless explicitly configured. The README documents the fallback.

Impact:

Secret reuse increases blast radius. If the Better Auth secret leaks, the same value can authenticate service-to-service realtime internal calls in environments where those endpoints are reachable. Some internal realtime events carry sensitive payloads such as challenge passwords and decline tokens.

Fix:

- Require a distinct `REALTIME_INTERNAL_SECRET` in production.
- Fail app and realtime startup when `NODE_ENV=production` and the secret is missing.
- Update Compose, `.env.example`, and README to remove the production fallback.
- Rotate the Better Auth secret if it has also been used as a service-to-service secret in shared environments.

Mitigation:

- Keep realtime internal endpoints off the public Caddy route.
- Keep services on the private Docker network.

False positive notes:

Caddy does not currently proxy realtime internal paths publicly, so the main risk is secret separation and future network exposure rather than immediate internet reachability.

### SEC-009: Production Containers Run as Root

Rule ID: CONTAINER-USER-001

Severity: Low

Location:

- `Dockerfile:1`
- `Dockerfile:3`
- `Dockerfile:25`
- `Dockerfile:33`
- `docker-compose.yml:72`
- `docker-compose.yml:73`

Evidence:

The Dockerfile does not create or switch to an unprivileged user. The app writes uploaded files to `/app/public/uploads` through a mounted volume.

Impact:

If an attacker achieves code execution or arbitrary file write inside the app or realtime container, running as root increases the impact within the container. Container isolation still helps, but least privilege should be the default for production services.

Fix:

- Create a non-root user in the production image.
- Chown only required writable directories, especially `/app/public/uploads`.
- Add `USER <non-root-user>` before `CMD`.
- Consider read-only root filesystems and explicit writable mounts where practical.

Mitigation:

- Keep Docker volumes scoped to the service.
- Avoid mounting the source tree in production.

False positive notes:

This does not mean host root access is available. It is a container hardening issue.

### SEC-010: Security-Sensitive Ownership Is Concentrated

Rule ID: OWNERSHIP-BUSFACTOR-001

Severity: Low

Location:

- `security-audit/ownership-map-out/summary.json`
- `security-audit/ownership-map-out/files.csv`
- `security-audit/ownership-map-out/edges.csv`

Evidence:

The ownership map found:

- 115 commits analyzed over the last 12 months.
- 17 people.
- 673 files.
- No orphaned sensitive code.
- One contributor identity controls 83% of auth-tagged code.
- Bus-factor 1 hotspots include auth route tests and `app/api/auth/[...all]/route.ts`.

Impact:

Security-sensitive areas can become hard to review, maintain, and respond to if too much context lives with one person. This is an operational risk rather than a direct exploit.

Fix:

- Add or update `CODEOWNERS` for auth, realtime, Prisma schema/migrations, Docker/Caddy, and security-sensitive API routes.
- Require at least one secondary reviewer for auth/realtime changes.
- Rotate ownership of auth tests and incident-response runbooks.

Mitigation:

- Keep generated ownership artifacts in `security-audit/ownership-map-out/` for review and visualization.

False positive notes:

Small student/team projects naturally have concentrated ownership. The finding is included because the request asked for a comprehensive security audit.

## Non-Findings and Lower-Risk Areas

- No application usage of `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, or `postMessage` was found.
- No user-controlled outbound fetch target was found in app code; realtime publishing URLs are environment-configured.
- Prisma is used for database access. The raw SQL found for matchmaking uses `Prisma.sql` with a constant advisory-lock key.
- Direct-message access checks require direct conversation membership and accepted friendship.
- Match state and move APIs contain participant/user authorization checks.
- `.env` is ignored by git and Docker build context according to repo configuration.

## Recommended Remediation Order

1. Update dependencies and re-run `bun audit`.
2. Add centralized security headers and an initial CSP.
3. Add a shared same-origin/CSRF guard to mutating app APIs.
4. Add rate limits to auth, queue, match, chat, and friend-request flows.
5. Remove raw error details from client responses.
6. Clarify the scope of `UserProfile.visibility`.
7. Harden avatar upload storage and serving.
8. Require a distinct realtime internal secret in production.
9. Switch production containers to non-root users.
10. Add security CODEOWNERS/review rules.

## Threat Model Assumption Validation

Confirmed by the user on 2026-05-26:

1. Current production/evaluation deployment is Docker Compose + Caddy as the only public ingress. Vercel may be considered in the future.
2. User stats and match history are intentionally public and do not need to be hidden from other users.
3. Rate limiting should be implemented inside the app. Next.js production does not provide general application-level rate limiting by default; official guidance is to implement rate limiting in the Next.js backend and also enable host/proxy limits when available.

The final threat model is written to `transcendence-threat-model.md`.
