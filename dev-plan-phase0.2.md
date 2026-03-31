# Development Plan Memo: Phase 0.2 – Communication Layer Verification

## Document language & source of truth

The canonical Japanese version of this document is maintained in **`dev-plan-phase0.2ja.md`**.
This file is reserved for the English version of the same plan.

Until the full English translation is completed, please refer to `dev-plan-phase0.2ja.md` for the detailed specification.

## Background and goals (EN summary)

The existing repository already has a Docker-based setup for `frontend / backend / PostgreSQL`, and basic connectivity with Next.js + Socket.IO + Prisma is confirmed. Game board logic, rule validation, matchmaking, authentication, history, and ranking are not yet implemented.

For the MVP, the scope is narrowed to "make online Gomoku work first." As a preparation step, we will implement and verify the following as **production-oriented components that can be grown as-is later**:

- Server-authoritative game state management
- Separation of responsibilities between REST and WebSocket
- Move confirmation with DB persistence
- API contracts that tolerate reconnection and future extensions

UI can be simplified, but APIs and data structures should be designed from the start for future extensibility. The board UI may use a **simple 1x5 board**, but the coordinate representation should already be `{ x, y }`.

---

## Design principles (outline)

1. **Server authority** – The backend is the only source of truth for game state and validates legal moves. Only moves successfully stored in the DB are considered official. Clients update their board only when they receive `game:update`. Clients do not locally "pre-confirm" moves.

2. **Separation of REST and WebSocket responsibilities** – REST: command submission and error responses. WebSocket: distribution of confirmed state (`game:update` is shared by both players).

3. **Separation of display name and internal identifiers** – Display: `displayName`. Internal ID: `playerId`. Seat information: `seat` (`BLACK` / `WHITE`).

### `playerId` handling policy in Phase 0

On successful room creation or join, the backend issues a `playerId`, and the frontend stores it in **`sessionStorage`**.

- Stored values: `roomId`, `playerId`, `seat`, `displayName`
- Rationale: it should survive reloads within the same tab, but it is not responsible for persistent login.

---

For complete and authoritative details, consult the Japanese document: `dev-plan-phase0.2ja.md`.

<!-- NOTE: This file intentionally avoids duplicating the full Japanese text. -->
