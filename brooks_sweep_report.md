# Brooks-Lint Review

**Mode:** Full Sweep
**Scope:** full repository
**Health Score:** 100/100

The sweep found no open findings after the residual realtime durability risk was implemented. The
security-significant profile visibility issue, app-level import cycle, and durable realtime retry
gap were fixed in place.

---

## Findings

No open Brooks-Lint findings.

---

## Fixed During Sweep

**R2 Change Propagation - Realtime Publish Failures Had No Durable Retry**
Symptom: committed match updates could succeed while `game:update`, `queue:matched`, or
`challenge:declined` realtime delivery failed, leaving recovery to logs and ad hoc caller behavior.
Source: Ousterhout - Information Leakage; Fowler - Shotgun Surgery.
Consequence: players could need manual refreshes after transient realtime outages, and each caller
had to own its own failure semantics.
Remedy: added a `RealtimeOutboxEvent` model and migration, a server-only outbox enqueue/drain
module, publisher-level persistence for non-secret match realtime payloads, a replay dispatcher,
`bun run realtime:drain-outbox`, and unit coverage for enqueue, backoff, stale lock reclaim, replay,
and max-attempt exhaustion. Challenge invite delivery remains intentionally unqueued because those
payloads contain room secrets and failed delivery cancels the challenge room instead.

**R6 Domain Model Distortion / Security Authorization - Profile Visibility Was Not Enforced**
Symptom: `ProfileVisibility` existed in the data model, but public profile stats and history were
loaded without checking it.
Source: Evans - Ubiquitous Language and Aggregate Invariants; Clean Architecture - policy must be
enforced at the boundary.
Consequence: the profile privacy model said data could be friends-only/private, while the public
profile route still exposed details.
Remedy: added `app/lib/profile-visibility.ts`, enforced it in
`app/[locale]/profile/[username]/page.tsx`, and added unit coverage in
`app/lib/profile-visibility.test.ts`.

**R5 Dependency Disorder - Leaderboard Search Type Cycle**
Symptom: `app/lib/advanced-search.ts` imported `LeaderboardScope` from `app/lib/leaderboard.ts`,
while `leaderboard.ts` imported search helpers from `advanced-search.ts`.
Source: Martin - Acyclic Dependencies Principle.
Consequence: even type-level cycles make module ownership unclear and show up in dependency scans.
Remedy: moved `LeaderboardScope` into `app/lib/leaderboard-types.ts` and re-exported it from
`leaderboard.ts` to preserve the existing public type API.

**R4 Accidental Complexity - Dead Commented Import**
Symptom: `app/lib/leaderboard.ts` kept a commented-out `cacheLife` import.
Source: Fowler - Dead Code / Speculative Generality.
Consequence: stale scaffolding suggests an abandoned caching direction and adds noise during future
leaderboard work.
Remedy: removed the dead comment.

---

## Verification

- `bun audit`: no vulnerabilities found.
- `bun run lint`: passed.
- `bun run typecheck`: passed.
- `bun test`: passed, 492 passing, 2 skipped.
- `bun test app/lib/realtime-outbox.test.ts app/lib/matches/realtime-publisher.test.ts app/api/matches/[id]/rules-routes.test.ts app/api/matches/[id]/join/route.test.ts app/api/matches/challenge/route.test.ts app/api/matches/[id]/challenge/decline/route.test.ts app/api/matches/solo/route.test.ts app/api/matches/[id]/ai-turn/route.test.ts`: passed.
- `bun test app/lib/profile-visibility.test.ts app/lib/advanced-search.test.ts app/lib/leaderboard.test.ts app/lib/leaderboard.search.test.ts app/lib/leaderboard.scope.test.ts app/lib/leaderboard.rank.test.ts`: passed.
- `bunx --bun madge --circular --extensions ts,tsx --exclude '^generated/' app realtime shared proxy.ts`: no circular dependency found.

## Summary

The sweep now closes the previously residual durable realtime retry risk while preserving the app's
existing route behavior. The highest-impact security fix remains enforcing existing profile privacy
semantics before protected public profile data is queried.
