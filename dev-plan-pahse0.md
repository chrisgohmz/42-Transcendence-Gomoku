# Development Plan: Phase 0.5 — Communication Foundation Verification

## Background and Purpose

The current repository has a Docker setup centered on `app / PostgreSQL`, with basic connectivity verified for Next.js + Socket.IO + Prisma. Game board rendering, rule validation, matchmaking, authentication, history, and ranking are all still unimplemented.

The implementation directory has also migrated away from a split `apps/frontend` / `apps/backend` structure to a unified `app/` directory.

In addition, `prisma/schema.prisma` already includes more than the bare minimum for matches:

- Authentication foundation via `User / OAuthAccount / UserSession`
- Social foundation via `Friendship`
- Chat foundation via `Conversation / ConversationParticipant / DirectMessage`
- Match and statistics foundation via `Match / MatchParticipant / MatchMove / UserGameStats`

The MVP goal remains "get online Gomoku working first." However, Phase 0.5 revisits the implementation plan to align with the current Prisma schema and directory structure, building **production-oriented components that can be grown as-is later.**

- Server-authoritative game state management
- Clear separation of responsibilities between REST and WebSocket
- Move confirmation with DB persistence
- Using `Match / MatchParticipant / MatchMove` in a way that keeps them connectable to `User / Conversation`
- An API contract resilient to reconnection and future extension

The UI may be simplified, but API and data structures should be designed for extensibility from the start. The board display can be a **1x5 minimal board**, but coordinates must use `{ x, y }` from the beginning.

---

## Design Principles

### 1. Server Authority

The policy is: "only the server holds the correct game state."

- The backend performs all legal move validation
- Only moves successfully saved to the DB are treated as official state
- The client updates the board only upon receiving `game:update`
- The client does not optimistically confirm moves locally

### 2. Separation of REST and WebSocket Responsibilities

`REST + WebSocket` are used together, but the same responsibility is never duplicated across both.

- REST: command submission and error responses
- WebSocket: delivery of confirmed state

In this design, both the player who placed a stone and the opponent update their boards upon receiving the **same `game:update`** event.

### 3. Separating Display Name, Participant ID, and Auth ID

In the current schema, display name, match participant ID, and authenticated user ID are treated as distinct concepts.

- Display: `displayName` in the API; `MatchParticipant.displayNameSnapshot` in the DB
- Internal identifier: `playerId`. The `playerId` in the API is treated as an alias for `MatchParticipant.id`
- Auth linkage: `userId`. If logged in, connected to `MatchParticipant.userId` and `Match.createdByUserId`
- Role: `role` (`PLAYER` / `SPECTATOR`)
- Seat: `seat` (`BLACK` / `WHITE` / `null`)

Phase 0 targets only two-player matches, so only participants with `role = PLAYER` and `seat != null` are typically handled. However, since the schema anticipates spectating and auth integration, the documentation is aligned around `MatchParticipant`.

#### Strategy for Storing `playerId` in Phase 0

`playerId` refers to the `MatchParticipant.id` returned by the backend upon successful match creation or join. The frontend stores this in **`sessionStorage`**.

- Fields stored: `matchId`, `playerId`, `role`, `seat`, `displayName`
- Rationale: Must survive in-tab reloads, but should not take on the responsibilities of persistent login
- Scope: Temporary session within the same tab

Storage example:

```ts
sessionStorage["proto:matchSession:<matchId>"] = JSON.stringify({
  matchId,
  playerId,
  role,
  seat,
  displayName,
});
```

Phase 0 behavior:

- If `sessionStorage` has data, reconnect using that `playerId`
- If no data, treat post-reload as a re-join or new creation
- Integration with `userId` and auth sessions is deferred to Phase 1 and beyond

### 4. Minimal UI, Generic Contracts

Phase 0 uses a 1x5 minimal UI, but the following fields are generic from the start in preparation for future 15x15 boards, Renju rules, spectating, and reconnection:

- Coordinates: `position: { x, y }`
- Board size: `boardSize`
- Rule type: `ruleType`
- Version: `stateVersion`
- Visibility: `visibility`
- Participant type: `role`
- End state: `winningSeat`, `endReason`

---

## Four Communication Patterns

| Pattern (from the frontend's perspective) | Phase 0 implementation                                               |
| ----------------------------------------- | -------------------------------------------------------------------- |
| ① Browser-only                            | Name input, turn display, click enable/disable control               |
| ② Click → Server → Response               | Send move via REST; receive accept/reject response                   |
| ③ Fetch → Render                          | Fetch list and state via `GET /matches` and `GET /matches/:id/state` |
| ④ Server push                             | Broadcast `game:update` to all match participants to sync the board  |

---

## Overall Flow

```text
Player 1:
  Enter name → POST /matches to create match
             → Create 1 Match record
             → Create 1 MatchParticipant(role=PLAYER, seat=BLACK)

Player 2:
  Enter name → GET /matches to fetch list
             → POST /matches/:id/join to join
             → Create 1 MatchParticipant(role=PLAYER, seat=WHITE)

When both players have joined:
  Match.status = IN_PROGRESS
  Match.nextTurnSeat = BLACK
  Record Match.startedAt

Both players:
  Subscribe to the match via WebSocket

On move submission:
  1. Player clicks a cell
  2. If the move is obviously invalid on the frontend, do not send
     - e.g. cell already occupied
     - e.g. not the player's turn
  3. Send POST /matches/:id/moves
  4. Backend validates:
     - Is playerId a valid MatchParticipant within this match?
     - Is role PLAYER?
     - Is seat the current turn's seat?
     - Is the position valid?
     - Is the target cell unoccupied?
  5. If invalid, return an error response via REST
  6. If valid, save MatchMove(participantId, x, y, requestId, baseVersion, stateVersion)
     and update Match.stateVersion and nextTurnSeat
     - moveNumber is assigned by the server, not the frontend
     - Assigned as the current move count for that match + 1
  7. After successful save, broadcast game:update to all match participants
  8. Both the player who moved and the opponent update their boards from the same game:update
```

Notes:

- Matches created by a logged-in user can populate `Match.createdByUserId`
- Logged-in participants can populate `MatchParticipant.userId`
- Chat is not implemented in Phase 0, but `Conversation.matchId` can later link a match to a conversation one-to-one

---

## Sequence Diagram

```text
Player1       Frontend1      Backend           DB           Frontend2
  |               |             |               |                |
  | Enter name    |             |               |                |
  |--click------->|             |               |                |
  |               | POST /matches               |                |
  |               |------------>| INSERT match  |                |
  |               |             | INSERT participant(BLACK)      |
  |               |             |-------------> |                |
  |               | <-----------| matchId/player|                |
  |               |             |               |                |
  |      (Player2 fetches GET /matches → POST /join to join)     |
  |               |             | INSERT participant(WHITE)      |
  |               |             | UPDATE Match.status=IN_PROGRESS|
  |               |             |               |                |
  |      (Both players subscribe via WebSocket)                  |
  |               | WS subscribe|               |                |
  |               |------------>|               |                |
  |               |             |<--------------| WS subscribe   |
  |               |             |               |                |
  | Click cell    |             |               |                |
  |--click------->|             |               |                |
  |               | POST /moves |               |                |
  |               |------------>| Validate move |                |
  |               |             | INSERT move   |                |
  |               |             | UPDATE match  |                |
  |               |             |-------------> |                |
  |               | <-----------| {ok:true}     |                |
  |               |             | WS game:update|--------------->|
  |               |<------------| WS game:update|                |
  | Update board  |             |               |   Update board |
```

Notes:

- A successful REST response indicates the move was "accepted"
- The board's official update uses the WebSocket `game:update` as the single source of truth
- Error feedback is only returned to the submitting player on REST failure

---

## API Reference

### REST

| Method | Path                     | Description                                              |
| ------ | ------------------------ | -------------------------------------------------------- |
| `POST` | `/api/matches`           | Create a match                                           |
| `GET`  | `/api/matches`           | Return a list of joinable matches                        |
| `POST` | `/api/matches/:id/join`  | Join the specified match                                 |
| `POST` | `/api/matches/:id/moves` | Submit a move command                                    |
| `GET`  | `/api/matches/:id/state` | Return the current state. Used for reconnection and sync |

### Create Match API

```ts
// POST /api/matches

// Request
{
  displayName: string,
  visibility?: "PUBLIC" | "PRIVATE",
  ruleType?: "GOMOKU" | "RENJU",
  boardSize?: 15
}

// Response
{
  matchId: string,
  playerId: string, // MatchParticipant.id
  role: "PLAYER",
  seat: "BLACK"
}
```

On creation, the backend:

- Creates 1 `Match` record
- Creates 1 `MatchParticipant` for the creator with `role = PLAYER`, `seat = BLACK`
- If logged in, populates `Match.createdByUserId` and `MatchParticipant.userId`
- Leaves `winningSeat`, `endReason`, `startedAt`, `finishedAt` as `null`

Current implementation notes:

- The `POST` in `app/api/matches/route.ts` assumes a logged-in session
- `displayName` input is not yet connected; a placeholder value is saved for now
- `playerId` is currently returned under the name `participantId` in the implementation (meaning is `MatchParticipant.id`)

### Join Match API

```ts
// POST /api/matches/:id/join

// Request
{
  displayName: string
}

// Response
{
  matchId: string,
  playerId: string, // MatchParticipant.id
  role: "PLAYER",
  seat: "WHITE"
}
```

When a second player joins and both are now present, the backend does the following within the same transaction or immediately after:

- Updates `Match.status` to `IN_PROGRESS`
- Sets `nextTurnSeat` to `BLACK`
- Records `startedAt` if needed
- `winningSeat` and `endReason` remain `null`

The fact that the game has started is expressed via `status: "IN_PROGRESS"` in the next `game:update`, rather than a dedicated `match:started` event.

### Move Submission API

```ts
// POST /api/matches/:id/moves

// Request
{
  playerId: string,
  position: { x: number, y: number },
  requestId?: string,
  baseVersion?: number
}

// Response (success)
{
  ok: true,
  accepted: true,
  requestId: string | null
}

// Response (failure)
{
  ok: false,
  reason:
    | "occupied"
    | "not_your_turn"
    | "invalid_position"
    | "match_not_found"
    | "game_not_started"
    | "game_finished"
    | "match_cancelled"
    | "not_a_player"
    | "stale_state",
  requestId: string | null
}
```

`baseVersion` indicates which state the client was viewing when it submitted the move. Since `MatchMove.baseVersion` is already nullable in the current schema, the Phase 0.5 policy is: "optional, but send it if you can."

`requestId` is used as an **idempotency key and response correlation key** generated by the frontend before each move submission.

- The frontend generates a `requestId` before sending
- The server saves it to `MatchMove.requestId` and returns the same value in the response
- On retransmission with the same `requestId`, double-moves are prevented while allowing the frontend to match responses to requests
- Uniqueness is enforced by `@@unique([matchId, requestId])` on `MatchMove`

In addition, `occupied` is not only checked at the application layer but is also enforced by `@@unique([matchId, x, y])` on `MatchMove`.

### State Fetch API

```ts
// GET /api/matches/:id/state

{
  matchId: string,
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED",
  visibility: "PUBLIC" | "PRIVATE",
  ruleType: "GOMOKU" | "RENJU",
  boardSize: number,
  stateVersion: number,
  nextTurnSeat: "BLACK" | "WHITE" | null,
  winningSeat: "BLACK" | "WHITE" | null,
  endReason: string | null,
  createdByUserId: string | null,
  participants: Array<{
    playerId: string,
    userId: string | null,
    displayName: string, // returns MatchParticipant.displayNameSnapshot
    role: "PLAYER" | "SPECTATOR",
    seat: "BLACK" | "WHITE" | null,
    joinedAt: string,
    leftAt: string | null
  }>,
  moves: Array<{
    moveNumber: number,
    playerId: string, // API representation of MatchMove.participantId
    position: { x: number, y: number },
    requestId: string | null,
    baseVersion: number | null,
    stateVersion: number
  }>
}
```

By returning `participants`, the Phase 0 frontend can use only the 2 records with `role === "PLAYER"`, while the structure naturally extends to spectator display in the future.

---

## WebSocket Events

| Direction       | Event Name         | Description                                                     |
| --------------- | ------------------ | --------------------------------------------------------------- |
| Client → Server | `match:subscribe`  | Begin subscribing to a match                                    |
| Server → Client | `match:subscribed` | Subscription confirmation                                       |
| Server → Client | `game:update`      | Broadcast confirmed latest game state to all match participants |
| Server → Client | `match:closed`     | Notify of `FINISHED` / `CANCELLED` or disconnection cleanup     |

### `game:update` Example

```ts
{
  matchId: string,
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED",
  visibility: "PUBLIC" | "PRIVATE",
  ruleType: "GOMOKU" | "RENJU",
  boardSize: number,
  stateVersion: number,
  nextTurnSeat: "BLACK" | "WHITE" | null,
  winningSeat: "BLACK" | "WHITE" | null,
  endReason: string | null,
  participants: Array<{
    playerId: string,
    displayName: string,
    role: "PLAYER" | "SPECTATOR",
    seat: "BLACK" | "WHITE" | null
  }>,
  lastMove: {
    moveNumber: number,
    playerId: string,
    position: { x: number, y: number },
    stateVersion: number
  } | null,
  board: Cell[][]
}
```

`game:update` is sent to **all match participants including the player who just moved**.

---

## Error Handling Policy

### Errors the Frontend May Swallow

The following can be detected before sending, so the frontend may treat them as invalid operations without making a REST request:

- A cell that is already occupied
- Clearly not the player's turn based on local state
- A move attempted by a participant known to have `role !== PLAYER`

In these cases "no response at all" still works, but at minimum one of the following should be present:

- Disable clicking
- Suppress hover effects
- Show a static message like "Waiting for opponent"

However, these are **UX pre-checks**, not a substitute for server authority. If the client state is stale or simultaneous moves occur, the backend may still reject for the same reasons.

### Errors Returned via REST

The following cannot be confirmed without checking the server, so they are handled in REST responses:

- `occupied`
- `not_your_turn`
- `not_a_player`
- `game_finished`
- `match_cancelled`
- `match_not_found`
- `stale_state`

`occupied` and `not_your_turn` are normally prevented by the frontend, but may still come from REST for the following reasons:

- The client was looking at a stale `game:update`
- Another player moved almost simultaneously
- A duplicate submission or retransmission occurred

Therefore the implementation policy is:

- Frontend: block where possible before sending
- Backend: always makes the final determination, returning the same reason if needed

Display messages can be simple:

- `occupied` → `That cell is already taken`
- `not_your_turn` → `Waiting for your opponent`
- `not_a_player` → `This participant cannot make moves`
- `game_finished` → `This match has already ended`
- `match_cancelled` → `This match was cancelled`
- `stale_state` → `The board has been updated`

### Network Failures

When the REST request itself fails, handle separately:

- `network_error`
- `timeout`

Display examples:

- `Connection failed`
- `Please try again`

---

## DB Schema Design

The excerpt from `prisma/schema.prisma` directly relevant to the match domain:

```prisma
enum MatchStatus {
  WAITING
  IN_PROGRESS
  FINISHED
  CANCELLED
}

enum MatchVisibility {
  PUBLIC
  PRIVATE
}

enum MatchResult {
  WIN
  LOSS
  DRAW
  CANCELLED
}

enum RuleType {
  GOMOKU
  RENJU
}

enum Role {
  PLAYER
  SPECTATOR
}

enum Seat {
  BLACK
  WHITE
}

model Match {
  id              String          @id @default(cuid(2))
  status          MatchStatus     @default(WAITING)
  visibility      MatchVisibility @default(PUBLIC)
  ruleType        RuleType        @default(GOMOKU)
  boardSize       Int             @default(15)
  stateVersion    Int             @default(0)
  nextTurnSeat    Seat?
  winningSeat     Seat?
  endReason       String?
  createdByUserId String?
  startedAt       DateTime?
  finishedAt      DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  createdBy       User?              @relation("matchCreator", fields: [createdByUserId], references: [id], onDelete: SetNull)
  participants    MatchParticipant[]
  moves           MatchMove[]
  conversation    Conversation?      @relation("MatchConversation")
  analyticsEvents AnalyticsEvent[]

  @@index([status])
  @@index([createdByUserId])
}

model MatchParticipant {
  id                  String       @id @default(cuid(2)) // playerId in Phase 0.2 API
  matchId             String
  userId              String?
  displayNameSnapshot String
  role                Role         @default(PLAYER)
  seat                Seat?
  result              MatchResult?
  joinedAt            DateTime     @default(now())
  leftAt              DateTime?

  match Match       @relation(fields: [matchId], references: [id], onDelete: Cascade)
  user  User?       @relation(fields: [userId], references: [id], onDelete: SetNull)
  moves MatchMove[]

  @@unique([matchId, seat])
  @@unique([matchId, userId])
  @@index([matchId])
  @@index([userId])
}

model MatchMove {
  id            String   @id @default(cuid(2))
  matchId       String
  participantId String
  moveNumber    Int
  x             Int
  y             Int
  requestId     String?
  baseVersion   Int?
  stateVersion  Int
  createdAt     DateTime @default(now())

  match       Match            @relation(fields: [matchId], references: [id], onDelete: Cascade)
  participant MatchParticipant @relation(fields: [participantId], references: [id], onDelete: Cascade)

  @@unique([matchId, moveNumber])
  @@unique([matchId, x, y])
  @@unique([matchId, requestId])
  @@index([matchId])
  @@index([participantId])
}
```

Even though Phase 0 UI uses 1x5, the DB already supports extension to 15x15 and spectating via:

- `x / y`
- `stateVersion`
- `baseVersion`
- `role`
- `seat`
- `winningSeat`
- `endReason`

---

## File Structure Notes

### Currently Confirmed Prisma-Related Files

```text
prisma/
  schema.prisma               ← Current schema source
generated/
  prisma/                     ← Client generated from schema.prisma
app/
  lib/
    prisma.ts                 ← Prisma client entry point
```

### Currently Confirmed Phase 0 Files

```text
app/
  page.tsx                    ← Unified app overview and navigation
  proto/
    page.tsx                  ← Phase 0 verification page
  api/
    matches/
      route.ts                ← GET, POST /api/matches (implemented)
  components/
    proto/
      MatchCreateButton.tsx   ← create_match operation
```

### Proposed File Layout for Phase 0 Implementation

```text
app/
  proto/
    page.tsx                  ← Phase 0 verification page
  api/
    matches/
      route.ts                ← GET, POST /api/matches
      [id]/
        join/route.ts         ← POST /api/matches/:id/join
        moves/route.ts        ← POST /api/matches/:id/moves
        state/route.ts        ← GET /api/matches/:id/state
  components/
    proto/
      NameInput.tsx           ← Player name input
      MatchList.tsx           ← Match list display
      MiniBoard.tsx           ← Minimal 1x5 board UI
      TurnBanner.tsx          ← Turn indicator and error display
  hooks/
    useMatch.ts               ← Match creation, joining, state fetching
    useSocketGame.ts          ← Match subscription and game:update receiving
  lib/
    prisma.ts                 ← Prisma client
    matches/
      match-store.ts          ← Match / participant / move management via Prisma
    game/
      move-validator.ts       ← Legal move validation
      state-builder.ts        ← Build state from MatchMove records
    socket/
      game-handler.ts         ← match:subscribe and game:update broadcast
prisma/
  schema.prisma
```

`Conversation` and `DirectMessage` implementations are not needed in Phase 0, but per-match chat can be added later using `Conversation.matchId` as the entry point.

---

## Implementation Order

This phase proceeds in **minimal vertical slices** — "1 command = 1 visible outcome" — rather than large layer-by-layer implementations.

Each slice ideally contains only these 4 things:

- One frontend operation
- One REST or WebSocket responsibility
- One or minimal DB change
- One visible confirmation on screen

```text
Slice 0: Minimal create_match connectivity (complete)
  - Schema: Use existing Match / MatchParticipant
  - Save: Save MatchParticipant(role=PLAYER, seat=BLACK) for creator
  - Front: Only a Create Match button
  - API: POST /api/matches
  - Confirm: matchId and playerId (participantId in implementation) appear on screen

Slice 1: Add list_matches (complete)
  - API: GET /api/matches
  - Query: Return matches where status=WAITING and visibility=PUBLIC
  - Front: Display list of created matches
  - Confirm: The most recently created match appears in the list

Slice 2: Add join_match (complete)
  - Schema: Use existing MatchParticipant
  - Save: Save participant with role=PLAYER, seat=WHITE
  - Transition: When 2 players are present, update Match.status=IN_PROGRESS, nextTurnSeat=BLACK, startedAt
  - Front: Add a Join button
  - Confirm: Both players' displayName / seat are visible on screen

Slice 3: Add subscribe_match
  - WS: match:subscribe / match:subscribed
  - Front: Display subscription status
  - Confirm: "subscribed" appears on screen

Slice 4: Minimal submit_move
  - Schema: Use existing MatchMove
  - Save: Save moveNumber, participantId, x, y, requestId, baseVersion, stateVersion
  - API: POST /api/matches/:id/moves
  - Rule: Prioritize confirming that saving works first
  - Confirm: After saving, game:update arrives on both screens

Slice 5: Add not_your_turn check
  - Rule: Add turn validation
  - Confirm: Moving out of turn returns a REST error

Slice 6: Add occupied check
  - Rule: Add occupancy validation
  - DB Guard: Also enforced by @@unique([matchId, x, y])
  - Confirm: Cannot place a stone on an already occupied cell

Slice 7: Add stateBuilder
  - Logic: Build board from MatchMove records
  - WS: Include board / participants / status in game:update
  - Confirm: Full board renders, not just the last move
  - Confirm: Status change from WAITING → IN_PROGRESS is also visible in game:update

Slice 8: Add GET /state
  - API: GET /api/matches/:id/state
  - Front: Implement initial sync on page reload
  - Front: Restore seat info using playerId from sessionStorage
  - Confirm: After reload, returns to the same board state

Slice 9: Make stateVersion / baseVersion active
  - Schema: Use existing Match.stateVersion and MatchMove.baseVersion
  - Rule: Handle stale_state
  - Confirm: Moves submitted from a stale state are rejected

Slice 10: Prepare terminal state entry points
  - State: Set up update paths for FINISHED / CANCELLED, winningSeat / endReason / finishedAt
  - Note: Actual win/loss determination may be deferred to Phase 1
  - Note: Phase 0.5 may define CANCELLED as a state, with actual transitions on disconnect or timeout deferred to Phase 1
```

`moveValidator` is not built all at once. First establish "can save" and "can broadcast," then add rules one at a time.

---

## Phase 0 Completion Criteria

- Player 1 can create a match
- Player 2 can view the match list and join
- `MatchParticipant.id` is stored as `playerId` and usable for re-sync
- Both players can subscribe to the same match
- Moves are confirmed via backend validation and DB persistence
- Illegal moves are returned as REST errors to the submitting player
- Official board updates are broadcast via `game:update` to all participants
- Both the mover and the opponent update their boards from the same event
- Re-sync is possible via `GET /state`
- The local match flow works even when `userId` is `null`
- Runs locally via Docker Compose

---

## Migration Strategy: Phase 0 → Phase 1

| Phase 0 Component                      | Phase 1 Use                                                       |
| -------------------------------------- | ----------------------------------------------------------------- |
| `MiniBoard.tsx`                        | Replace with `Board.tsx` (15x15)                                  |
| `move-validator.ts`                    | Extend for Gomoku win/loss detection                              |
| `state-builder.ts`                     | Reuse for spectating, reconnection, and game replay               |
| `Match / MatchParticipant / MatchMove` | Extend for Renju, public/private, and spectating                  |
| `role / userId`                        | Connect to auth, spectating, and friend flow                      |
| `stateVersion / baseVersion`           | Foundation for simultaneous moves, retransmission, reconnection   |
| `winningSeat / endReason`              | Foundation for match result display and history saving            |
| `Conversation.matchId`                 | Connect to per-match chat                                         |
| `UserGameStats`                        | Connect to records, ratings, and rankings                         |
| `GET /state`                           | Foundation for reconnection, page reload, and mid-game spectating |

The goal of Phase 0 is not "build a simple game" but to **first build the communication core that will hold up in a future Gomoku.com-style service, aligned with the current schema and directory structure.**
