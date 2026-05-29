# Security Best Practices Report

Date: 2026-05-29
Scope: full repository
Stack: TypeScript, Next.js 16, React 19, Better Auth, Prisma, Redis, Socket.IO, Bun

## Executive Summary

The audit found no open critical or high-severity security findings after this branch's fixes.
One profile authorization gap was fixed during the sweep: public profile pages now enforce the
stored `ProfileVisibility` policy before loading or rendering stats, achievements, head-to-head
records, or match history.

Dependency audit result: `bun audit` reported no known vulnerable dependencies.

## What Was Reviewed

- Next.js Route Handlers, Proxy, security headers, CSP, and production posture.
- Authentication/session boundaries, same-origin mutation guards, JSON request guards, and rate limits.
- Server/client boundaries for Prisma, Redis, email, and secret-reading modules.
- Frontend dangerous sinks including `dangerouslySetInnerHTML`, DOM HTML sinks, dynamic code execution, redirects, browser storage, and cross-window messaging.
- File/avatar handling, path traversal defenses, content types, and cache headers.
- Prisma raw-query and command-execution sinks.
- Socket.IO realtime internal endpoints and shared internal secret handling.

## Critical

No open critical findings.

## High

### SEC-001: Public Profile Details Bypassed `ProfileVisibility` - Fixed

Rule ID: APP-PRIVACY-001 / NEXT-AUTHZ-001
Severity: High before fix; fixed in this branch
Location:

- `app/[locale]/profile/[username]/page.tsx:153`
- `app/[locale]/profile/[username]/page.tsx:200`
- `app/[locale]/profile/[username]/page.tsx:209`
- `app/lib/profile-visibility.ts:10`

Evidence:
The Prisma schema and seed data define `ProfileVisibility` values (`PUBLIC`, `FRIENDS`, `PRIVATE`),
but the public profile page previously loaded stats and match history without checking that policy.
The current implementation loads `profile.visibility`, computes `canViewDetails`, and only calls
`getProfileStatsForUser()` and head-to-head queries when the viewer is authorized.

Impact:
Before the fix, non-friends could infer private or friends-only users' rating, wins/losses,
achievement state, and recent match history by visiting their public profile URL.

Fix:
Added `canViewProfileDetails()` and wired it into the public profile page. Unauthorized viewers now
see private placeholders and the server skips the protected data queries.

Verification:

- `bun test app/lib/profile-visibility.test.ts`
- `bun test app/lib/request-security.test.ts app/api/mutation-security.coverage.test.ts`
- `bun run typecheck`
- `bun run lint`

## Medium

No open medium findings.

## Low / Defense In Depth

- `app/lib/request-security.ts:41` enforces same-origin mutation requests and fails closed in production when trusted origins are not configured.
- `app/api/mutation-security.coverage.test.ts:23` verifies every mutating Route Handler uses the shared mutation guard.
- `next.config.ts:61` applies baseline security headers globally.
- `proxy.ts:30` and `app/lib/content-security-policy.ts:82` apply nonce-based CSP to rendered app pages.
- `app/api/avatars/[filename]/route.ts` serves only opaque, validated avatar filenames with explicit image content types and `nosniff`.
- `app/lib/matches/realtime-publisher.ts` persists only non-secret realtime retry payloads to the
  server-side outbox; challenge invite secrets are not queued and failed invite delivery still
  cancels the room.
- The `redis.eval` use in `app/lib/rate-limit.ts:248` is a static Lua script with untrusted values passed as Redis keys/arguments, not string-concatenated script source.

## Residual Notes

- TLS, WAF, CDN, and reverse-proxy production settings are not fully visible from application code. Verify them in deployment infrastructure.
- `.env` is present locally but is ignored by git; do not commit local secret material.
