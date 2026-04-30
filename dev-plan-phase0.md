# Development Plan Memo: Phase 0.5 Communication Foundation Verification

## Background and Purpose

The current repository already has a Docker setup centered on `app / realtime / caddy / PostgreSQL`, and basic connectivity for Next.js + Socket.IO + Prisma has been verified. The game board, rule validation, matchmaking, authentication, history, and rankings are still unimplemented.

The implementation layout has also moved away from a split `apps/frontend` / `apps/backend` structure. The Next.js application now lives in `app/`, the Socket.IO entry point lives in `realtime/`, and the public-facing entry route lives in `infra/caddy/`.

At the same time, `prisma/schema.prisma` already contains more than the minimum required for a match:

- Authentication foundations through `User / OAuthAccount / UserSession`
- Social foundations through `Friendship`
- Chat foundations through `Conversation / ConversationParticipant / DirectMessage`
- Match and statistics foundations through `Match / MatchParticipant / MatchMove / UserGameStats`

The MVP focus remains the same: get online Gomoku working first. However, in Phase 0.5, the implementation plan should be reorganized around the current Prisma schema and current directory structure so that we build **production-oriented parts that can be extended directly later**.

- Server-authoritative game state management
- Clear separation of responsibilities between REST and WebSocket
- Confirmed moves backed by DB persistence
- Using `Match / MatchParticipant / MatchMove` in a way that remains connectable to `User / Conversation`
- API contracts that can withstand reconnection and future extension

The UI can stay simplified, but the API and data structures should be shaped from the start for future extensibility. The board display may be a **simplified 1x5 board**, but coordinates should use `{ x, y }` from day one.

---

## Current System Structure

The communication foundation has gone through three stages during development:

1. A linear structure where a frontend server (Next.js) served as the entry point, with a backend server (Node.js + Next.js + Socket.IO custom server) behind it
2. A unified application server where frontend and backend were merged, and Next.js and Socket.IO ran together inside Node.js
3. The current parallel structure of `app` (Next.js) and `realtime` (Socket.IO)

The current responsibility split in Compose is as follows:

- `app`: runs `next dev` / `next start`, and is responsible for UI rendering, Route Handlers, authentication, DB access through Prisma, and REST APIs
- `realtime`: runs `bun realtime/server.ts`, and is responsible for accepting Socket.IO connections, room management, and broadcasting `match:subscribe` and `game:update`
- `caddy`: terminates `https://localhost:8443`, reverse-proxying `/socket.io/*` to `realtime:3001` and all other pages and `/api/*` to `app:3000`
- `database`: provides PostgreSQL

From the browser's point of view, it connects only to the single origin `https://localhost:8443`, but internally SSR/REST traffic and realtime traffic run in separate processes.

The current Next.js docs also treat the built-in `next start` server as the standard option, while custom servers are considered an exceptional path. Self-hosting guidance also recommends placing a reverse proxy in front. Because of that, Slice 3 onward should assume the model where **`app` confirms state and `realtime` handles delivery**.

---

## Design Principles

### 1. Server Authority

We adopt the policy that "only the server holds the correct game state."

- Legal move validation is performed by the API server (the Route Handlers in `app`)
- Only moves successfully saved to the DB become official state
- The client updates the board only after receiving `game:update`
- The client does not locally confirm moves optimistically

### 2. Separation of REST and WebSocket Responsibilities

We use `REST + WebSocket` together, but the same responsibility must not exist in both places.

- REST: `app` handles command submission and error responses
- WebSocket: `realtime` handles delivery of already-confirmed state
- Public entry point: `caddy` preserves a single origin while routing `/api/*` and `/socket.io/*`

In this design, both the player who placed a stone and the opponent update their boards from the **same `game:update`** event.

### 3. Separate Display Name, Participant ID, and Auth ID

In the current schema, display names, match participant IDs, and authenticated user IDs are treated as distinct things.

- Display use: `displayName` in the API, and `MatchParticipant.displayNameSnapshot` in the DB
- Internal identifier: `playerId`. In the API, `playerId` is treated as an alias for `MatchParticipant.id`
- Auth linkage: `userId`. If logged in, it connects to `MatchParticipant.userId` and `Match.createdByUserId`
- Role: `role` (`PLAYER` / `SPECTATOR`)
- Seat information: `seat` (`BLACK` / `WHITE` / `null`)

Phase 0 targets only two-player matches, so in normal cases we only handle participants with `role = PLAYER` and `seat != null`. However, the schema is already designed with spectating and authentication integration in mind, so the documentation should also stay aligned around `MatchParticipant`.

#### Strategy for Keeping `playerId` in Phase 0

`playerId` refers to the `MatchParticipant.id` returned by the API server when match creation or join succeeds. The frontend stores this in **`sessionStorage`**.

- Stored fields: `matchId`, `playerId`, `role`, `seat`, `displayName`
- Reason: we want reloads within the same tab to work, but we do not want to take on the responsibility of persistent login yet
- Scope: a temporary session tied to the same tab

Storage image:

```ts
sessionStorage["proto:matchSession:<matchId>"] = JSON.stringify({
  matchId,
  playerId,
  role,
  seat,
  displayName,
});
```

In Phase 0, the behavior is:

- If data exists in `sessionStorage`, reconnect with that `playerId`
- If no data exists, treat a reload as requiring rejoin or new creation
- Integration with `userId` and auth sessions is handled in Phase 1 and later

### 4. Minimal UI, Generic Contracts

Phase 0 uses a simplified 1x5 UI, but to prepare for 15x15 boards, Renju, spectating, and reconnection in the future, the following should be generic from the beginning:

- Coordinates: `position: { x, y }`
- Board size: `boardSize`
- Rule type: `ruleType`
- Version: `stateVersion`
- Visibility: `visibility`
- Participation type: `role`
- End information: `winningSeat`, `endReason`

---

## Four Communication Patterns and Their Roles

| Communication pattern from the frontend's point of view | Phase 0 implementation                                                                 |
| ------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1. Browser-only                                         | Name input, turn display, and click-enabled/disabled control                           |
| 2. Click -> Server -> Response                          | `https://localhost:8443` -> `caddy` -> `app` REST returns accept/reject                |
| 3. Fetch -> Render                                      | Fetch and display `GET /api/matches` and `GET /api/matches/:id/state` from `app`       |
| 4. Server push                                          | `https://localhost:8443/socket.io/*` -> `caddy` -> `realtime` broadcasts `game:update` |

---

## Overall Flow

```text
Public entry point:
  The browser connects only to https://localhost:8443
  - /api/* and normal pages go through Caddy -> app(Next.js)
  - /socket.io/* goes through Caddy -> realtime(Socket.IO)

Player 1:
  Enter name -> POST /api/matches to create a match
             -> reaches app through Caddy
             -> create 1 Match record
             -> create 1 MatchParticipant(role=PLAYER, seat=BLACK)

Player 2:
  Enter name -> GET /api/matches to fetch the list
             -> POST /api/matches/:id/join to join
             -> reaches app through Caddy
             -> create 1 MatchParticipant(role=PLAYER, seat=WHITE)

When two players are present:
  Match.status = IN_PROGRESS
  Match.nextTurnSeat = BLACK
  Record Match.startedAt

Both sides:
  Connect to realtime Socket.IO through Caddy
  and subscribe to the match with match:subscribe

When submitting a move:
  1. A player clicks a cell
  2. If the frontend can tell the action is obviously invalid, do not send it
     - Example: the cell is already occupied
     - Example: it is not your turn
  3. Send POST /api/matches/:id/moves
  4. app validates:
     - whether playerId is a valid MatchParticipant inside the match
     - whether role is PLAYER
     - whether seat matches the current turn
     - whether the position is valid
     - whether the target cell is empty
  5. If invalid, return a REST error response
  6. If valid, save MatchMove(participantId, x, y, requestId, baseVersion, stateVersion)
     and update Match.stateVersion and nextTurnSeat
     - `moveNumber` is determined by the server, not the frontend
     - numbering is based on the current move count in that match, plus 1
  7. After the save succeeds, app asks realtime to broadcast
     - not by in-process emit, but through internal notification across the Docker network
  8. realtime broadcasts game:update to everyone in the match
  9. Both the player who moved and the opponent update the board from the same game:update
```

Notes:

- If a logged-in user creates the match, `Match.createdByUserId` can be populated
- If a logged-in participant joins, `MatchParticipant.userId` can be populated
- Even if chat is not implemented in Phase 0, the match and conversation can later be connected one-to-one through `Conversation.matchId`

---

## Sequence Diagram

```text
Player1     Frontend1       App            DB        Realtime      Frontend2
  |             |            |              |            |             |
  | Enter name  |            |              |            |             |
  |--click----->|            |              |            |             |
  |             | POST /api/matches ------->| INSERT match           |  |
  |             |            | INSERT participant(BLACK) |            |  |
  |             |            |------------->|            |             |
  |             |<-----------| matchId/player            |             |
  |             |            |              |            |             |
  |   (Player2 joins via GET /api/matches -> POST /api/matches/:id/join)           |
  |             |            | INSERT participant(WHITE) |            |             |
  |             |            | UPDATE Match.status=IN_PROGRESS        |             |
  |             |            |------------->|            |             |
  |             | WS subscribe ------------------------->| join room   |             |
  |             |<--------------------------------------| subscribed  |             |
  |             |            |              |            |             |
  | Click cell  |            |              |            |             |
  |--click----->|            |              |            |             |
  |             | POST /api/matches/:id/moves --------->|             |             |
  |             |            | legal move validation     |             |             |
  |             |            | INSERT move  |            |             |
  |             |            | UPDATE match |            |             |
  |             |            |------------->|            |             |
  |             |<-----------| {ok:true}    |            |             |
  |             |            | notify latest state ----->|             |
  |             |<--------------------------------------| WS game:update
  | Update board|            |              |            | Update board|
```

Notes:

- For readability, the diagram omits the `caddy` hop. The public entry point remains `https://localhost:8443`
- A successful REST response only means "accepted"
- The official board update treats WebSocket `game:update` as the single source of truth
- Fan-out of `game:update` is handled by realtime, while app is responsible for state confirmation
- Only REST failures return an error message to the submitting player

---

## API List

### REST

The public URL is based on `caddy` at `https://localhost:8443`. All `/api/*` routes below reach Route Handlers in `app`.

| Method | Path                     | Description                                    |
| ------ | ------------------------ | ---------------------------------------------- |
| `POST` | `/api/matches`           | Create a match                                 |
| `GET`  | `/api/matches`           | Return a list of joinable matches              |
| `POST` | `/api/matches/:id/join`  | Join the specified match                       |
| `POST` | `/api/matches/:id/moves` | Send a move command                            |
| `GET`  | `/api/matches/:id/state` | Return the current state for reconnection/sync |

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

At creation time, the backend does the following:

- Create one `Match`
- Create one `MatchParticipant` for the creator with `role = PLAYER` and `seat = BLACK`
- If the user is logged in, populate `Match.createdByUserId` and `MatchParticipant.userId`
- Start with `winningSeat`, `endReason`, `startedAt`, and `finishedAt` as `null`

Implementation notes at the current stage:

- `POST` in `app/api/matches/route.ts` assumes a logged-in session
- The `displayName` input is not wired yet, and a temporary fixed value is currently saved
- In the actual implementation, `playerId` is returned under the name `participantId` (its meaning is still `MatchParticipant.id`)

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

When the second player joins, the backend should do the following in the same transaction or immediately after it:

- Update `Match.status` to `IN_PROGRESS`
- Set `nextTurnSeat` to `BLACK`
- Record `startedAt` if needed
- Keep `winningSeat` and `endReason` as `null`

The start of the game is expressed not with a dedicated `match:started`, but through `status: "IN_PROGRESS"` inside the next `game:update`.

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

`baseVersion` represents "which state the client was looking at when it submitted the move." In the current schema, `MatchMove.baseVersion` already exists as nullable, so in Phase 0.5 the direction is "optional for now, but send it when available."

`requestId` is treated as an **idempotency key and response-correlation key** generated by the frontend for each move.

- The frontend generates `requestId` before sending
- The server stores it in `MatchMove.requestId` and returns the same value in the response
- If the same `requestId` arrives again during retry, the server can prevent duplicate moves while still letting the frontend correlate the response to the original action
- Uniqueness is guaranteed through `@@unique([matchId, requestId])` on `MatchMove`

Also, `occupied` should be protected not only by an application-layer pre-check, but also by `@@unique([matchId, x, y])` on `MatchMove`.

### State Retrieval API

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

By returning `participants`, the Phase 0 frontend can use only the two records where `role === "PLAYER"` for now, while later extending the same structure to spectator displays.

---

## WebSocket Events

| Direction        | Event name         | Description                                        |
| ---------------- | ------------------ | -------------------------------------------------- |
| Client -> Server | `match:subscribe`  | Start subscribing to a match                       |
| Server -> Client | `match:subscribed` | Subscription completion notice                     |
| Server -> Client | `game:update`      | Broadcast the latest confirmed game state to all   |
| Server -> Client | `match:closed`     | Notify `FINISHED` / `CANCELLED` or cleanup on exit |

These events are used from the browser by connecting to `https://localhost:8443/socket.io/*`. `caddy` forwards that traffic to `realtime:3001`.

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

`game:update` is sent to **everyone in the match, including the player who just moved**.

---

## Error Display Policy

### Errors the Frontend May Safely Suppress

The following can be identified entirely on the frontend before sending, so they may be treated as invalid operations without sending REST at all:

- A cell that is already occupied
- A state that is clearly not the current player's turn
- A move action from a participant already known to have `role !== PLAYER`

Even a completely silent no-op can work here, but at minimum one of the following is desirable:

- Disable clicking
- Suppress hover affordances
- Show a fixed message such as `Waiting for the opponent's move`

However, these are **UX-level pre-checks**, not a replacement for server authority. If the client state is stale or simultaneous operations happen, the backend may still reject the same action for the same reason.

### Errors REST Should Return

The following cannot be determined without asking the server, so they should be handled as REST responses:

- `occupied`
- `not_your_turn`
- `not_a_player`
- `game_finished`
- `match_cancelled`
- `match_not_found`
- `stale_state`

`occupied` and `not_your_turn` are normally prevented by the frontend ahead of time, but they may still come back from REST for the following reasons:

- The client was looking at an outdated `game:update`
- Another player moved almost at the same time
- Multiple submissions or retries occurred

Therefore, the implementation policy is:

- Frontend: stop invalid operations before sending when possible
- Backend: always make the final decision and return the same reason when necessary

The displayed messages can stay simple:

- `occupied` -> `You cannot place a stone there`
- `not_your_turn` -> `Wait for the opponent's move`
- `not_a_player` -> `This participant cannot place moves`
- `game_finished` -> `This game has already finished`
- `match_cancelled` -> `This match has ended`
- `stale_state` -> `The board has been updated`

### Communication Failures

If REST itself fails, treat it separately:

- `network_error`
- `timeout`

Display examples:

- `Communication failed`
- `Please try again`

---

## DB Schema Design

The parts of `prisma/schema.prisma` that directly relate to the match domain are excerpted below.

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

Even though the Phase 0 UI is only 1x5, the DB already contains the following, so it can grow directly into 15x15 play or spectating:

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
  schema.prisma               <- current schema source
generated/
  prisma/                     <- client generated from schema.prisma
app/
  lib/
    prisma.ts                 <- Prisma client entry point
```

### Currently Confirmed Phase 0-Related Files

```text
app/
  page.tsx                    <- guide/entry page describing the current app + realtime parallel structure
  proto/
    page.tsx                  <- Phase 0 test page
  api/
    health/
      route.ts                <- healthcheck for the app service
    matches/
      route.ts                <- GET, POST /api/matches (implemented)
      [id]/
        join/route.ts         <- POST /api/matches/:id/join (implemented)
  components/
    status-panel.tsx          <- connectivity display for app / database / Socket.IO
    proto/
      MatchCreateButton.tsx   <- create_match action
      MatchJoinButton.tsx     <- join_match action
realtime/
  server.ts                   <- entry point of the realtime service
infra/
  caddy/
    Caddyfile                 <- routing for `/socket.io/*` and other HTTP traffic
```

### Candidate Placement for Continued Phase 0 Implementation

```text
app/
  proto/
    page.tsx                  <- Phase 0 test page
  api/
    matches/
      route.ts                <- GET, POST /api/matches
      [id]/
        join/route.ts         <- POST /api/matches/:id/join
        moves/route.ts        <- POST /api/matches/:id/moves
        state/route.ts        <- GET /api/matches/:id/state
  components/
    proto/
      NameInput.tsx           <- player name input
      MatchList.tsx           <- match list display
      MiniBoard.tsx           <- simplified 1x5 board UI
      TurnBanner.tsx          <- turn and error display
  hooks/
    useMatch.ts               <- match creation/join/state retrieval
    useSocketGame.ts          <- match subscription and game:update receipt
  lib/
    prisma.ts                 <- Prisma client
    matches/
      match-store.ts          <- match / participant / move management using Prisma
    game/
      move-validator.ts       <- legal move validation
      state-builder.ts        <- build state from MatchMove
    realtime/
      realtime-publisher.ts   <- request broadcast from app to realtime through internal notification
realtime/
  server.ts                   <- Socket.IO server entry point
  handlers/
    match-subscription.ts     <- match:subscribe / match:subscribed
    game-broadcast.ts         <- receive internal notifications from app and fan out game:update to the room
  lib/
    rooms.ts                  <- room management
shared/
  match-events.ts             <- event payload types shared by app / realtime / frontend
prisma/
  schema.prisma
infra/
  caddy/
    Caddyfile
```

Because `app` and `realtime` are separate processes, it is easier to manage shared types and event contracts by placing them under a root-level location like `shared/`, rather than keeping them trapped inside `app/lib`.

Implementations for `Conversation` and `DirectMessage` are unnecessary in Phase 0, but if match chat is added later, it can be extended from `Conversation.matchId`.

---

## Implementation Order

In this phase, progress should be made not through large layer-based implementations, but through very small vertical slices where **1 command = 1 visible result**.

Each slice should ideally contain only the following four things:

- One frontend action
- One REST or WebSocket responsibility
- One DB change, or the minimum possible DB change
- One visible confirmation on the screen that "it worked"

Slices 0 to 2 are completed entirely inside `app` through REST and DB updates, so the current parallel structure has little impact there. The impact starts from Slice 3 onward, where the system needs to be rebuilt around the responsibility split of **subscription in `realtime`, state confirmation in `app`, and internal notification between them**.

```text
Slice 0: minimal create_match connectivity (done)
  - Schema: use existing Match / MatchParticipant
  - Save: store MatchParticipant(role=PLAYER, seat=BLACK) for the creator
  - Front: Create Match button only
  - API: POST /api/matches
  - Confirm: matchId and playerId (currently participantId in the implementation) appear on screen

Slice 1: add list_matches (done)
  - API: GET /api/matches
  - Query: return matches where status=WAITING and visibility=PUBLIC
  - Front: display the created match list
  - Confirm: the match created just before appears in the list

Slice 2: add join_match (done)
  - Schema: use existing MatchParticipant
  - Save: store the joining participant with role=PLAYER, seat=WHITE
  - Transition: when two players are present, update Match.status=IN_PROGRESS, nextTurnSeat=BLACK, startedAt
  - Front: add Join button
  - Confirm: the two displayName / seat values appear on screen

Slice 3: add subscribe_match
  - WS: implement match:subscribe / match:subscribed in `realtime`
  - Route: the browser connects to `https://localhost:8443/socket.io/*` and reaches realtime through Caddy
  - Front: display subscription status
  - Confirm: subscribed appears on screen

Slice 4: minimal submit_move
  - Schema: use existing MatchMove
  - Save: store moveNumber, participantId, x, y, requestId, baseVersion, stateVersion
  - API: add POST /api/matches/:id/moves to `app`
  - Bridge: add a path for internal notification from `app` to `realtime` after a successful save
  - Rule: first prioritize confirming that saving works
  - Confirm: after saving, game:update arrives on both screens

Slice 5: add not_your_turn
  - Rule: add turn checking to the move Route Handler in `app`
  - Confirm: when the wrong person plays, a REST error is returned

Slice 6: add occupied
  - Rule: add occupied-cell checking to the move Route Handler in `app`
  - DB Guard: protect it with @@unique([matchId, x, y]) as well
  - Confirm: an already occupied position cannot be used

Slice 7: add stateBuilder
  - Logic: build the board from MatchMove on the `app` side
  - WS: `realtime` fans out the game:update payload built by `app`
  - Confirm: not only the latest move, but the whole board is rendered
  - Confirm: the WAITING -> IN_PROGRESS status change is also visible via game:update

Slice 8: add GET /state
  - API: add GET /api/matches/:id/state to `app`
  - Front: implement initial sync after reload
  - Front: restore the local seat information using playerId from sessionStorage
  - Note: `realtime` is not used as the state store for reconnection; REST remains the source of truth for initial sync
  - Confirm: after reload, the same board state returns

Slice 9: make real use of stateVersion / baseVersion
  - Schema: use existing Match.stateVersion and MatchMove.baseVersion
  - Rule: make stale_state available on the `app` side
  - WS: realtime broadcasts the already-confirmed stateVersion as-is
  - Confirm: moves submitted from stale state can be rejected

Slice 10: prepare the entry point for terminal state
  - State: add paths that update FINISHED / CANCELLED and winningSeat / endReason / finishedAt
  - Note: the actual win/lose judgment may be postponed to Phase 1
  - Note: in Phase 0.5, it is enough to support `CANCELLED` as a state first; actual transitions caused by disconnect or timeout can be postponed to Phase 1
  - WS: after terminal state is confirmed, stream `match:closed` or a final `game:update` from `app` to `realtime`
```

Do not build the whole `moveValidator` upfront. First get "can save" and "can broadcast" working end-to-end, then add rules one by one afterward.

---

## Phase 0 Exit Criteria

- Player 1 can create a match
- Player 2 can view the match list and join
- `MatchParticipant.id` can be kept as `playerId` and used for resync
- Both players can subscribe to the same match
- Both REST and Socket.IO are reachable through the single origin `https://localhost:8443`
- Move confirmation goes through API-side legal validation and DB persistence
- Illegal moves are returned to the submitting player as REST errors
- Official board updates are distributed to everyone through realtime `game:update`
- Both the player who moved and the opponent update from the same event
- Resync is possible through `GET /state`
- The local match flow works even when `userId` is `null`
- `app / realtime / caddy / database` can be started locally with Docker Compose

---

## Transition Plan from Phase 0 to Phase 1

| Phase 0 component                      | Phase 1 use                                                       |
| -------------------------------------- | ----------------------------------------------------------------- |
| `MiniBoard.tsx`                        | Replace with `Board.tsx` (15x15)                                  |
| `move-validator.ts`                    | Extend to full Gomoku win/lose judgment                           |
| `state-builder.ts`                     | Reuse for spectating, reconnection, and move replay               |
| `Match / MatchParticipant / MatchMove` | Extend to Renju, public/private, and spectating                   |
| `role / userId`                        | Connect to authentication, spectating, and friend flows           |
| `stateVersion / baseVersion`           | Foundation for simultaneous moves, retries, reconnection          |
| `winningSeat / endReason`              | Foundation for result display and match history                   |
| `Conversation.matchId`                 | Connect to match chat                                             |
| `UserGameStats`                        | Connect to records, ratings, and rankings                         |
| `GET /state`                           | Foundation for reconnection, page reload, and mid-game spectating |

The purpose of Phase 0 is not "to build a simple game," but to **build the communication core first, in a way that can support a future Gomoku.com-like service while fitting the current schema and current directory structure**.
