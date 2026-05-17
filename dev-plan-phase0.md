# Development Plan Memo: Phase 0.5 Communication Foundation Verification

## Background and Purpose

The current repository has progressed beyond the Docker setup centered on `app / realtime / caddy / PostgreSQL` and the Next.js + Socket.IO + Prisma communication foundation. Authentication, the 15x15 board, legal move validation, terminal-state handling, solo AI, matchmaking, the history API, and the leaderboard read model are now implemented. Profile statistics for the signed-in user, fully live leaderboard data, and automatic statistics/progression updates after match completion remain in scope for Issue #36.<!-- updated: aligned with implemented auth, rule validation, history API, leaderboard read model, and the remaining Issue #36 scope -->

The implementation layout has also moved away from a split `apps/frontend` / `apps/backend` structure. The Next.js application now lives in `app/`, the Socket.IO entry point lives in `realtime/`, and the public-facing entry route lives in `infra/caddy/`.

At the same time, `prisma/schema.prisma` already contains more than the minimum required for a match:

- Authentication foundations through `User / OAuthAccount / UserSession`
- Social foundations through `Friendship`
- Chat foundations through `Conversation / ConversationParticipant / DirectMessage`
- Match, statistics, and progression foundations through `Match / MatchParticipant / MatchMove / UserGameStats / AchievementDefinition / UserAchievement`<!-- updated: the current Prisma schema also contains achievement definitions and user achievements -->

The MVP focus remains the same: get online Gomoku working first. However, in Phase 0.5, the implementation plan should be reorganized around the current Prisma schema and current directory structure so that we build **production-oriented parts that can be extended directly later**.

- Server-authoritative game state management
- Clear separation of responsibilities between REST and WebSocket
- Confirmed moves backed by DB persistence
- Using `Match / MatchParticipant / MatchMove` in a way that remains connectable to `User / Conversation`
- API contracts that can withstand reconnection and future extension

The UI can stay simplified, but the API and data structures should be shaped from the start for future extensibility. The current UI assumes a **15x15 Gomoku board**, and coordinates use `{ x, y }`.<!-- updated: the current implementation no longer uses the 1x5 prototype board -->

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
- Internal identifier: `participantId`. In the API, `participantId` is treated as an alias for `MatchParticipant.id`
- Auth linkage: `userId`. If logged in, it connects to `MatchParticipant.userId` and `Match.createdByUserId`
- Role: `role` (`PLAYER` / `SPECTATOR`)
- Seat information: `seat` (`BLACK` / `WHITE` / `null`)

Phase 0 targets only two-player matches, so in normal cases we only handle participants with `role = PLAYER` and `seat != null`. However, the schema is already designed with spectating and authentication integration in mind, so the documentation should also stay aligned around `MatchParticipant`.

#### Strategy for Keeping `participantId` in Phase 0

`participantId` refers to the `MatchParticipant.id` returned by the API server when match creation or join succeeds. The frontend stores this in **`sessionStorage`**.

- Stored fields: `matchId`, `participantId`, `role`, `seat`, `displayName`
- Active-session pointer: `match:session:v1:active` stores the active `matchId`. The old `proto:matchSession:v1:*` keys remain only for read compatibility.<!-- updated: current match-session-storage.ts uses match:session:v1:* as the canonical key prefix -->
- Reason: we want reloads within the same tab to work, but we do not want to take on the responsibility of persistent login yet
- Scope: a temporary session tied to the same tab

Storage image:

```ts
sessionStorage["match:session:v1:<matchId>"] = JSON.stringify({
  matchId,
  participantId,
  role,
  seat,
  displayName,
  updatedAt,
});
sessionStorage["match:session:v1:active"] = matchId;
```

In Phase 0, the behavior is:

- If data exists in `sessionStorage`, reconnect with that `participantId`
- If no data exists, treat a reload as requiring rejoin or new creation
- Integration with `userId` and auth sessions is handled in Phase 1 and later

### 4. Minimal UI, Generic Contracts

The initial Phase 0 plan assumed a simplified 1x5 UI, but the current implementation uses a 15x15 board. To prepare for Renju, spectating, and reconnection in the future, the following should remain generic:<!-- updated: current UI and state builder operate with 15x15 boardSize -->

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
     - whether participantId is a valid MatchParticipant inside the match
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

| Method   | Path                       | Description                                              |
| -------- | -------------------------- | -------------------------------------------------------- |
| `POST`   | `/api/matches`             | Create a public human match for the authenticated user   |
| `GET`    | `/api/matches`             | Return joinable `WAITING` matches                        |
| `POST`   | `/api/matches/:id/join`    | Join the specified match as White                        |
| `POST`   | `/api/matches/:id/moves`   | Send a move command                                      |
| `POST`   | `/api/matches/:id/resign`  | Resign and confirm the terminal state                    |
| `GET`    | `/api/matches/:id/state`   | Return the current state for reconnection/sync           |
| `POST`   | `/api/matches/solo`        | Create a solo AI match                                   |
| `POST`   | `/api/matches/:id/ai-turn` | Confirm the AI move in a solo AI match                   |
| `GET`    | `/api/matches/queue`       | Return the current matchmaking queue status              |
| `POST`   | `/api/matches/queue`       | Join the matchmaking queue                               |
| `DELETE` | `/api/matches/queue`       | Leave the matchmaking queue                              |
| `GET`    | `/api/matches/history`     | Return terminal match history for the authenticated user |

<!-- updated: current Route Handlers include solo / ai-turn / resign / queue / history -->

### Create Match API

```ts
// POST /api/matches

// Request
// Current implementation does not require a body. It uses the signed-in user's displayName / username.
{}

// Response
{
  matchId: string,
  participantId: string, // MatchParticipant.id
  role: "PLAYER",
  seat: "BLACK",
  stateVersion: number,
  status: "WAITING",
  createdAt: string
}
```

At creation time, the backend does the following:

- Create one `Match`
- Create one `MatchParticipant` for the creator with `role = PLAYER` and `seat = BLACK`
- Populate `Match.createdByUserId` and `MatchParticipant.userId` from the signed-in user
- Store `displayNameSnapshot` as `context.user.displayName || context.user.username`
- Use `standardGomokuBoardSize`; currently this is 15
- Start with `winningSeat`, `endReason`, `startedAt`, and `finishedAt` as `null`
- After creation, publish the initial `game:update` to realtime through the internal notification path<!-- updated: current create match is auth-required, uses 15x15, saves the user name, and publishes the initial game:update -->

### Join Match API

```ts
// POST /api/matches/:id/join

// Request
{
  displayName?: string // defaults to the signed-in user's displayName / username
}

// Response
{
  matchId: string,
  participantId: string, // MatchParticipant.id
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
  participantId: string,
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
  error:
    | "invalid_payload"
    | "occupied"
    | "not_your_turn"
    | "invalid_position"
    | "match_not_found"
    | "participant_not_found"
    | "game_not_started"
    | "game_finished"
    | "match_cancelled"
    | "not_a_player"
    | "duplicate_request"
    | "stale_state"
    | "move_conflict",
  detail?: string
}
```

<!-- updated: current Route Handler returns an error field rather than ok:false/reason -->

`baseVersion` represents "which state the client was looking at when it submitted the move." In the current schema, `MatchMove.baseVersion` already exists as nullable, so in Phase 0.5 the direction is "optional for now, but send it when available."

`requestId` is treated as an **idempotency key and response-correlation key** generated by the frontend for each move.

- The frontend generates `requestId` before sending
- The server stores it in `MatchMove.requestId` and returns the same value in the response
- If the same `requestId` arrives again during retry, the server can prevent duplicate moves while still letting the frontend correlate the response to the original action
- Uniqueness is guaranteed through `@@unique([matchId, requestId])` on `MatchMove`

Also, `occupied` should be protected not only by an application-layer pre-check, but also by `@@unique([matchId, x, y])` on `MatchMove`.

### State Retrieval API

```ts
// GET /api/matches/:id/state?participantId=<MatchParticipant.id>

{
  matchId: string,
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED",
  visibility: "PUBLIC" | "PRIVATE",
  // ruleType exists in the DB and history API, but current GET /state responses do not include it yet
  boardSize: number,
  stateVersion: number,
  nextTurnSeat: "BLACK" | "WHITE" | null,
  winningSeat: "BLACK" | "WHITE" | null,
  endReason: string | null,
  participants: Array<{
    participantId: string,
    displayName: string, // returns MatchParticipant.displayNameSnapshot
    role: "PLAYER" | "SPECTATOR",
    seat: "BLACK" | "WHITE" | null,
    joinedAt: string,
    leftAt: string | null
  }>,
  moves: Array<{
    moveNumber: number,
    participantId: string, // API representation of MatchMove.participantId
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

| Direction        | Event name                                       | Description                                                                                  |
| ---------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| Client -> Server | `match:subscribe`                                | Start subscribing to a match                                                                 |
| Server -> Client | `match:subscribed`                               | Subscription completion notice                                                               |
| Server -> Client | `game:update`                                    | Broadcast the latest confirmed game state to all                                             |
| Server -> Client | `match:error`                                    | Subscription failure or invalid payload error                                                |
| Client -> Server | `queue:join` / `queue:leave`                     | Join/leave the matchmaking queue                                                             |
| Server -> Client | `queue:status` / `queue:matched` / `queue:error` | Queue state and match notifications                                                          |
| Server -> Client | `match:closed`                                   | Planned event. Current implementation represents terminal state with the final `game:update` |

<!-- updated: current realtime handlers include match:error and queue events, while match:closed is not implemented -->

These events are used from the browser by connecting to `https://localhost:8443/socket.io/*`. `caddy` forwards that traffic to `realtime:3001`.

### `game:update` Example

```ts
{
  matchId: string,
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED",
  visibility: "PUBLIC" | "PRIVATE",
  // ruleType is commented out in shared/match-events.ts and is not included in current game:update payloads
  boardSize: number,
  stateVersion: number,
  nextTurnSeat: "BLACK" | "WHITE" | null,
  winningSeat: "BLACK" | "WHITE" | null,
  endReason: string | null,
  participants: Array<{
    participantId: string,
    displayName: string,
    role: "PLAYER" | "SPECTATOR",
    seat: "BLACK" | "WHITE" | null
  }),
  lastMove: {
    moveNumber: number,
    participantId: string,
    position: { x: number, y: number },
    requestId: string | null,
    stateVersion: number
  } | null,
  moves: Array<{
    moveNumber: number,
    participantId: string,
    position: { x: number, y: number },
    requestId: string | null,
    baseVersion: number | null,
    stateVersion: number
  }>,
  board: Cell[][]
}
```

<!-- updated: current GameUpdatePayload in shared/match-events.ts excludes ruleType and includes lastMove.requestId plus moves -->

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
  metadata        Json?
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
  id                  String       @id @default(cuid(2)) // participantId in the current API
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

model UserGameStats {
  id                   Int       @id @default(autoincrement())
  userId               String
  ruleType             RuleType
  boardSize            Int
  matchesPlayed        Int       @default(0)
  wins                 Int       @default(0)
  losses               Int       @default(0)
  draws                Int       @default(0)
  botMatchesPlayed     Int       @default(0)
  botWins              Int       @default(0)
  currentStreak        Int       @default(0)
  bestStreak           Int       @default(0)
  rating               Int?
  averageMoveTimeMs    Int?
  totalPlayTimeSeconds Int       @default(0)
  lastPlayedAt         DateTime?
  updatedAt            DateTime  @updatedAt

  @@unique([userId, ruleType, boardSize])
  @@index([userId])
  @@index([ruleType, boardSize, rating, wins, losses])
}

model AchievementDefinition {
  id          Int      @id @default(autoincrement())
  code        String   @unique
  name        String
  description String
  points      Int      @default(0)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model UserAchievement {
  id            Int      @id @default(autoincrement())
  userId        String
  achievementId Int
  unlockedAt    DateTime @default(now())
  progress      Int      @default(0)
  completedAt   DateTime?

  @@unique([userId, achievementId])
  @@index([userId])
  @@index([achievementId])
}
```

<!-- updated: added current Match.metadata and the statistics/achievement tables used by Issue #36 to the excerpt -->

The initial Phase 0 UI assumed 1x5, but the current DB and UI already use 15x15. Because the DB has the following fields, it can also grow into spectating and match replay.<!-- updated: the current UI has progressed to 15x15 -->

- `x / y`
- `stateVersion`
- `baseVersion`
- `role`
- `seat`
- `winningSeat`
- `endReason`

---

## File Structure Notes

### Currently Confirmed Prisma / DB Files

```text
prisma/
  schema.prisma               <- current schema source
  seed.ts                     <- seed users / match / stats / achievements
  migrations/                 <- migrations for auth, match, stats index, metadata, etc.
generated/
  prisma/                     <- client generated from schema.prisma
app/
  lib/
    prisma.ts                 <- Prisma client entry point
```

<!-- updated: current repo includes seed.ts, multiple migrations, and the UserGameStats index migration -->

### Currently Confirmed Match / Realtime Files

```text
app/
  [locale]/
    home/page.tsx             <- home dashboard
    human/page.tsx            <- human lobby
    game/page.tsx             <- AI / game entry point
    leaderboard/page.tsx      <- leaderboard page
    profile/page.tsx          <- signed-in user's profile page
    profile/[username]/page.tsx <- public profile page
  api/
    health/route.ts
    matches/
      route.ts                <- GET, POST /api/matches
      history/route.ts        <- GET /api/matches/history
      queue/route.ts          <- GET, POST, DELETE /api/matches/queue
      solo/route.ts           <- POST /api/matches/solo
      [id]/
        join/route.ts         <- POST /api/matches/:id/join
        moves/route.ts        <- POST /api/matches/:id/moves
        resign/route.ts       <- POST /api/matches/:id/resign
        state/route.ts        <- GET /api/matches/:id/state
        ai-turn/route.ts      <- POST /api/matches/:id/ai-turn
  components/
    ai-lobby-client.tsx
    human-lobby-client.tsx
    ai-match-room.tsx
    human-match-room.tsx
    match-board.tsx
    gomoku-board.tsx
    leaderboardtable.tsx
    home-dashboard.tsx
  hooks/
    useHumanLobby.ts          <- human match creation/join/list fetch
    useMatchInitialize.ts     <- sessionStorage + GET state initial sync
    useSocketGame.ts          <- match:subscribe + game:update receipt
  lib/
    leaderboard.ts            <- builds leaderboard entries from UserGameStats
    game/state-builder.ts     <- builds board from MatchMove
    matches/
      ai-engine.ts
      ai-solo.ts
      game-update.ts          <- game:update payload builder
      match-history.ts        <- terminal match history read model
      matchmaking.ts          <- queue / stale cleanup
      move-request-validation.ts
      move-rules.ts           <- legal move / five-in-row / draw / resign validation
      participant-access.ts
      realtime-publisher.ts   <- internal notification from app to realtime
      submit-move.ts          <- client-side move submit helper
      match-session-storage.ts
shared/
  ai-difficulty.ts
  match-events.ts             <- payload types shared by app / realtime / frontend
  match-events-validation.ts  <- runtime validation for internal notifications and subscribe payloads
  realtime-internal.ts        <- internal endpoint secret / payload helpers
realtime/
  server.ts                   <- Socket.IO / internal endpoint entry point
  handlers/
    match-subscription.ts     <- match:subscribe / match:subscribed / initial game:update
    matchmaking-queue.ts      <- queue:join / queue:leave
  lib/
    internal-game-update.ts   <- broadcasts game:update to room from /internal/game-update
    internal-friendship-update.ts
    presence.ts
    rooms.ts
    socket-auth.ts
infra/
  caddy/
    Caddyfile                 <- routes /socket.io/* to realtime and everything else to app
```

<!-- updated: app/proto and components/proto no longer exist; locale routes, matches API, hooks, shared, and realtime handlers/libs have been added -->

### Candidate Placement for Issue #36 Additions / Updates

```text
app/
  api/
    profile/
      stats/route.ts          <- REST API for signed-in user's stats, progression, and rank summary
    leaderboard/route.ts      <- REST API for leaderboard entries and current user's rank
  components/
    profile-stats-panel.tsx   <- signed-in user's stat cards and level/progress display
    match-history-list.tsx    <- match history with opponent, date/time, result
    progression-summary.tsx   <- lightweight achievement/progression display
  hooks/
    useProfileStats.ts        <- fetches profile stats over REST and refetches after realtime refresh if needed
    useLeaderboard.ts         <- fetches leaderboard over REST
  lib/
    stats/
      profile-stats.ts        <- builds profile read model from Match / MatchParticipant / UserGameStats
      progression.ts          <- derives level / progress / achievement signals
      result-sync.ts          <- updates UserGameStats / UserAchievement from terminal matches
realtime/
  lib/
    internal-stats-update.ts  <- optionally sends stats:refresh to user rooms
shared/
  stats-events.ts             <- shared payload type if stats refresh event is added
```

<!-- updated: Issue #36 placement aligned with current app/api, hooks, lib, and realtime structure -->

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

In the current implementation, Slices 0 to 10 are updated as complete. Subscription is handled by `realtime`, state confirmation by `app`, and the bridge between them by internal notification. Solo AI, matchmaking queue, match history API, leaderboard read model, and aggregate public-profile stats have also been added. Issue #36 builds on top of this as Slices 11 onward, adding statistics/progression updates, the signed-in user's profile history, and a leaderboard backed by live data.<!-- updated: file inspection showed that the Slice 3-10 equivalents and additional features are already implemented -->

```text
Slice 0: minimal create_match connectivity (done)
  - Purpose: an authenticated user can create a match as the BLACK participant
  - Files: app/api/matches/route.ts, app/hooks/useHumanLobby.ts
  - Implement: create Match / MatchParticipant and publish the initial game:update
  - Confirm: POST /api/matches returns matchId / participantId / stateVersion

Slice 1: add list_matches (done)
  - Purpose: users can list joinable WAITING matches
  - Files: app/api/matches/route.ts, app/hooks/useHumanLobby.ts, app/components/game-lobby-table.tsx
  - Implement: return status=WAITING matches and participant snapshots
  - Confirm: the created match appears in the human lobby

Slice 2: add join_match (done)
  - Purpose: the second player can join as WHITE and start the match
  - Files: app/api/matches/[id]/join/route.ts, app/hooks/useHumanLobby.ts
  - Implement: add MatchParticipant and update IN_PROGRESS / nextTurnSeat=BLACK / startedAt / stateVersion
  - Confirm: after Join, two participants and the IN_PROGRESS state are visible

Slice 3: add subscribe_match (done)
  - Purpose: clients can subscribe to a match room with Socket.IO and receive current state
  - Files: realtime/handlers/match-subscription.ts, app/hooks/useSocketGame.ts, shared/match-events.ts
  - Implement: match:subscribe / match:subscribed / initial game:update
  - Confirm: subscribed and a full-state game:update arrive after subscription

Slice 4: minimal submit_move (done)
  - Purpose: save a move through REST and broadcast the confirmed state through realtime
  - Files: app/api/matches/[id]/moves/route.ts, app/lib/matches/realtime-publisher.ts, realtime/lib/internal-game-update.ts
  - Implement: save MatchMove and send game:update to the room through /internal/game-update
  - Confirm: after a move, both the mover and opponent receive game:update

Slice 5: add not_your_turn (done)
  - Purpose: reject out-of-turn moves with server authority
  - Files: app/lib/matches/move-rules.ts, app/api/matches/[id]/moves/route.ts
  - Implement: compare the participant seat with Match.nextTurnSeat
  - Confirm: a move by the wrong player returns 409 not_your_turn

Slice 6: add occupied (done)
  - Purpose: reject a move on an already occupied cell
  - Files: app/lib/matches/move-rules.ts, app/api/matches/[id]/moves/route.ts, prisma/schema.prisma
  - Implement: protect with an application-level occupied check and @@unique([matchId, x, y])
  - Confirm: moving to the same coordinate returns occupied

Slice 7: add stateBuilder (done)
  - Purpose: rebuild and broadcast the full board from MatchMove records
  - Files: app/lib/game/state-builder.ts, app/lib/matches/game-update.ts, shared/match-events.ts
  - Implement: build GameUpdatePayload with board / lastMove / moves
  - Confirm: the full board, not only the latest move, is rendered

Slice 8: add GET /state (done)
  - Purpose: perform initial sync over REST after reload or reconnection
  - Files: app/api/matches/[id]/state/route.ts, app/hooks/useMatchInitialize.ts, app/lib/matches/match-state.ts
  - Implement: validate participantId and return board / participants / moves
  - Confirm: using the participantId in sessionStorage restores the same board after reload

Slice 9: make real use of stateVersion / baseVersion (done)
  - Purpose: reject moves submitted from stale state and duplicate submissions
  - Files: app/lib/matches/move-rules.ts, app/api/matches/[id]/moves/route.ts, app/lib/matches/move-request-validation.ts
  - Implement: use baseVersion stale_state, requestId duplicate_request, and updateMany guarded transitions
  - Confirm: a move from an old stateVersion returns 409 stale_state

Slice 10: prepare terminal state entry point (done)
  - Purpose: store win/loss, draw, resign, queue cancel/expire/abandon as terminal states
  - Files: app/lib/matches/move-rules.ts, app/api/matches/[id]/moves/route.ts, app/api/matches/[id]/resign/route.ts, app/api/matches/[id]/ai-turn/route.ts, app/lib/matches/matchmaking.ts
  - Implement: update FINISHED / CANCELLED, winningSeat, endReason, finishedAt, MatchParticipant.result, and publish the final game:update
  - Confirm: five-in-row, draw, resign, and queue cancel are reflected in DB and game:update

Slice 11: add result_stats_sync
  - Purpose: automatically update UserGameStats and achievement progress from terminal match results
  - Files:
    - app/lib/stats/result-sync.ts
    - app/lib/stats/progression.ts
    - app/lib/stats/result-sync.test.ts
    - app/lib/stats/progression.test.ts
  - Implement:
    - Do not change the Prisma schema. Use the existing UserGameStats / AchievementDefinition / UserAchievement tables
    - Treat matches with Match.status FINISHED / CANCELLED and populated MatchParticipant.result as eligible for statistics updates
    - For PLAYER participants with a userId, aggregate terminal MatchParticipant records and compute matchesPlayed / wins / losses / draws / botMatchesPlayed / botWins / streak / lastPlayedAt by ruleType + boardSize, then overwrite UserGameStats (source of truth is MatchParticipant; no delta adds)
    - Define level / progress as pure derived functions from rating, wins, matchesPlayed, and achievement points
    - Upsert lightweight achievement progress such as first win, win streak, and AI win into the existing tables
  - Confirm: a terminal match fixture recalculates stats, and calling the same sync twice does not double-count values

Slice 12: connect stats sync to terminal routes
  - Purpose: update statistics and progression after match completion without manual fixes
  - Files:
    - app/api/matches/[id]/moves/route.ts
    - app/api/matches/[id]/resign/route.ts
    - app/api/matches/[id]/ai-turn/route.ts
    - app/lib/matches/matchmaking.ts
    - app/api/matches/[id]/rules-routes.test.ts
    - app/api/matches/[id]/ai-turn/route.test.ts
    - app/lib/matches/matchmaking.test.ts
  - Implement:
    - Immediately after saving FINISHED / CANCELLED and MatchParticipant.result, call stats sync for affected human userIds
    - Following the existing policy where realtime publish failures do not undo successful moves, log stats sync failures without corrupting the already-confirmed terminal DB state
    - Make a consistent decision on whether queue cancel / expire / abandoned count toward matchesPlayed, and keep them excludable from leaderboard eligibility
  - Confirm: after wins, losses, resigns, and AI match completion, UserGameStats.updatedAt and wins/losses/draws are updated

Slice 13: add profile stats REST API
  - Purpose: let the UI fetch the signed-in user's stats, rank, level/progress, and history summary over REST
  - Files:
    - app/api/profile/stats/route.ts
    - app/lib/stats/profile-stats.ts
    - app/lib/matches/match-history.ts
    - app/api/profile/stats/route.test.ts
  - Implement:
    - Read the authenticated user's UserGameStats, UserAchievement, and terminal Match / MatchParticipant records, then return wins / losses / rating / rank / level / progress / recentMatches
    - Include opponent displayName, finishedAt, result, endReason, and moveCount in recentMatches
    - Calculate rank via the shared rank helper in app/lib/leaderboard.ts, returning null for unranked users (defined in Slice 15)
    - Keep the existing GET /api/matches/history for game-record details; make the profile stats API a lightweight summary for profile display
  - Confirm: as a logged-in user, GET /api/profile/stats returns stat cards and the latest 20 recent-match summaries

Slice 14: connect profile stats / match history view
  - Purpose: players can view their own statistics and match history from the UI
  - Files:
    - app/[locale]/profile/page.tsx
    - app/components/profile-stats-panel.tsx
    - app/components/match-history-list.tsx
    - app/components/progression-summary.tsx
    - app/hooks/useProfileStats.ts
    - app/i18n/messages/en.ts
    - app/i18n/messages/ja.ts
    - app/i18n/messages/zh.ts
  - Implement:
    - Replace current hard-coded rating / winRate / wins / losses / recentMatches / achievements with REST-fetched data
    - Show opponent, date/time, result, endReason, and move count in the match history view
    - Show level/progress and lightweight achievement signals in the right column of the profile
    - Add empty / loading / error states so users with no matches still render cleanly
  - Confirm: /profile shows DB-backed wins/losses, ranking, level progress, and recent matches

Slice 15: make leaderboard REST read model use live data
  - Purpose: calculate leaderboard data from match results stored in the DB
  - Files:
    - app/api/leaderboard/route.ts
    - app/lib/leaderboard.ts
    - app/lib/stats/result-sync.ts
    - app/lib/leaderboard.test.ts
    - app/api/leaderboard/route.test.ts
  - Implement:
    - Treat terminal Match / MatchParticipant.result records as the authoritative source for leaderboard, with UserGameStats as the materialized read model maintained by result-sync
    - Preserve the current sort rule: rating desc, wins desc, losses asc
    - Provide a single rank calculation helper in app/lib/leaderboard.ts and reuse it from Slice 13
    - Explicitly define leaderboard eligibility such as boardSize=15, ruleType=GOMOKU, and bot-only exclusion
    - Return current user rank and top 100 entries over REST
  - Confirm: after adding a terminal match and running stats sync, GET /api/leaderboard changes rank, wins/losses, and winRate to match the DB results

Slice 16: make leaderboard page display live data
  - Purpose: the Leaderboard page shows DB-backed rank and progression signals instead of preview data
  - Files:
    - app/[locale]/leaderboard/page.tsx
    - app/components/leaderboardtable.tsx
    - app/hooks/useLeaderboard.ts
    - app/i18n/messages/en.ts
    - app/i18n/messages/ja.ts
    - app/i18n/messages/zh.ts
  - Implement:
    - Replace previewEntries fallback and hard-coded Your Rank / Top Players / distribution with live data or an empty state
    - Display current user rank, rating, wins, losses, winRate, and level/progress signals
    - When data is empty, show a "no ranked matches yet" state and do not use seeded preview names
  - Confirm: /leaderboard renders only DB UserGameStats / result-sync data, and an empty DB does not show preview names

Slice 17: add stats refresh realtime signal
  - Purpose: immediately after match completion, profile/leaderboard UI can receive a trigger to refetch REST data
  - Files:
    - shared/stats-events.ts
    - shared/realtime-internal.ts
    - app/lib/stats/realtime-publisher.ts
    - realtime/lib/internal-stats-update.ts
    - realtime/server.ts
    - realtime/lib/internal-stats-update.test.ts
  - Implement:
    - After stats sync succeeds, app sends an internal stats update to realtime for the affected userId / username
    - app posts to realtime /internal/stats-update over HTTP using the shared realtime-internal secret header (same internal HTTP pattern as game-update)
    - realtime sends `stats:refresh` through the existing user-room pattern
    - Keep the payload lightweight, such as userId, reason, matchId, and updatedAt; fetch actual data again over REST
  - Confirm: after match termination, the affected user's Socket.IO client receives stats:refresh

Slice 18: connect profile / leaderboard realtime refetch
  - Purpose: statistics, progression, and rank update after match completion while the pages stay open
  - Files:
    - app/hooks/useProfileStats.ts
    - app/hooks/useLeaderboard.ts
    - app/components/profile-stats-panel.tsx
    - app/components/leaderboardtable.tsx
    - app/lib/socket-client.ts
  - Implement:
    - Refetch GET /api/profile/stats and GET /api/leaderboard when `stats:refresh` arrives
    - Ignore payloads for other users
    - Add 800ms debounce for bursts of events
  - Confirm: after a match ends, wins/losses and rank/progress display on /profile and /leaderboard change without a manual refresh
```

<!-- updated: aligned implemented Slices 0-10 with current state and added Issue #36 Slices 11-18 at the existing granularity -->

`move-rules.ts` and `state-builder.ts` are implemented in the current codebase. Issue #36 should focus on updating the statistics, history, leaderboard, and progression read models from terminal match results, not on game rules.<!-- updated: the moveValidator-equivalent implementation is already complete -->

---

## Phase 0 Exit Criteria

- Player 1 can create a match
- Player 2 can view the match list and join
- `MatchParticipant.id` can be kept as `participantId` and used for resync
- Both players can subscribe to the same match
- Both REST and Socket.IO are reachable through the single origin `https://localhost:8443`
- Move confirmation goes through API-side legal validation and DB persistence
- Illegal moves are returned to the submitting player as REST errors
- Official board updates are distributed to everyone through realtime `game:update`
- Both the player who moved and the opponent update from the same event
- Resync is possible through `GET /state`
- Human matches require authenticated userId, while only AI participants allow `userId = null`<!-- updated: the current match create/join/subscribe APIs require authenticated users -->
- `app / realtime / caddy / database` can be started locally with Docker Compose

---

## Transition Plan from Phase 0 to Phase 1

| Phase 0 component                      | Phase 1 use                                                       |
| -------------------------------------- | ----------------------------------------------------------------- |
| `match-board.tsx` / `gomoku-board.tsx` | Extend to spectating, replay, and review displays                 |
| `move-rules.ts`                        | Extend to Renju and additional terminal reasons                   |
| `state-builder.ts`                     | Reuse for spectating, reconnection, and move replay               |
| `Match / MatchParticipant / MatchMove` | Extend to Renju, public/private matches, and spectating           |
| `role / userId`                        | Connect to authentication, spectating, and friend flows           |
| `stateVersion / baseVersion`           | Foundation for simultaneous moves, retries, reconnection          |
| `winningSeat / endReason`              | Foundation for result display and match history                   |
| `Conversation.matchId`                 | Connect to match chat                                             |
| `UserGameStats / UserAchievement`      | Connect to Issue #36 records, ratings, rankings, and progression  |
| `GET /state`                           | Foundation for reconnection, page reload, and mid-game spectating |

<!-- updated: aligned component names with current files instead of MiniBoard / move-validator and made UserGameStats / UserAchievement part of Issue #36 -->

The purpose of Phase 0 is not "to build a simple game," but to **build the communication core first, in a way that can support a future Gomoku.com-like service while fitting the current schema and current directory structure**.
