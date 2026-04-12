# Development Notes: Phase 0.3 Communication Foundation Check

## Background and Goal

The current repository already has Docker-based `frontend / backend / PostgreSQL` setup in place, and basic connectivity between Next.js, Socket.IO, and Prisma has been confirmed. The game board, rule validation, matchmaking, authentication, match history, and rankings are still unimplemented.

At the same time, `apps/backend/prisma/schema.prisma` already includes more than the minimum game schema:

- Authentication foundation via `User / OAuthAccount / UserSession`
- Social foundation via `Friendship`
- Chat foundation via `Conversation / ConversationParticipant / DirectMessage`
- Match and stats foundation via `Match / MatchParticipant / MatchMove / UserGameStats`

The MVP goal remains the same: first make online Gomoku playable. However, in Phase 0.3, the implementation plan is rewritten to match the current Prisma schema and treat these pieces as **production-oriented building blocks that can be extended later without rework**.

- Server-authoritative game state management
- Clear separation of responsibilities between REST and WebSocket
- MatchMove confirmation backed by DB persistence
- Use `Match / MatchParticipant / MatchMove` in a way that remains compatible with `User / Conversation`
- API contracts that tolerate reconnection and future expansion

The UI can stay simple, but APIs and data structures should be designed from the beginning so they can grow later. The board display can be a **simple 1x5 board**, but coordinates should use `{ x, y }` from the start.

---

## Design Principles

### 1. Server authority

Adopt the rule that "the server is the only source of truth for valid game state."

- Legal move validation is handled by the backend
- Only moves successfully saved to the DB become official state
- The client updates the board only after receiving `game:update`
- The client does not locally finalize moves on its own

### 2. Clear separation between REST and WebSocket

Use both `REST + WebSocket`, but do not give them overlapping responsibilities.

- REST: command submission and error responses
- WebSocket: delivery of confirmed state

With this design, both the player who placed the stone and the opponent update their board from the same `game:update`.

### 3. Separate display names, participant IDs, and authenticated user IDs

In the current schema, display names, match participant IDs, and authenticated user IDs are treated as different things.

- For display: `displayName` in the API, `MatchParticipant.displayNameSnapshot` in the DB
- Internal identifier: `playerId`; in the API this is an alias of `MatchParticipant.id`
- Authentication linkage: `userId`; if the user is logged in, connect this through `MatchParticipant.userId` and `Match.createdByUserId`
- Role: `role` (`PLAYER` / `SPECTATOR`)
- Seat: `seat` (`BLACK` / `WHITE` / `null`)

Phase 0 only targets a 2-player game, so in practice we handle only participants where `role = PLAYER` and `seat != null`. However, since the schema already anticipates spectators and authentication, the document should also consistently use `MatchParticipant`.

#### `playerId` storage policy in Phase 0

`playerId` refers to the `MatchParticipant.id` returned by the backend when room creation or join succeeds. The frontend stores it in `sessionStorage`.

- Stored values: `roomId`, `playerId`, `role`, `seat`, `displayName`
- Reason: we want reloads in the same tab to work, but we do not want to take on persistent login responsibilities yet
- Scope: temporary session within the same tab

Storage example:

```ts
sessionStorage["proto:roomSession:<roomId>"] = JSON.stringify({
  roomId,
  playerId,
  role,
  seat,
  displayName,
});
```

Phase 0 uses the following rules:

- If session data exists in `sessionStorage`, reconnect using that `playerId`
- If it does not exist, after reload the user must rejoin or create a new room
- Integration with `userId` or authentication sessions is deferred to Phase 1 and later

### 4. Keep the UI simple, keep the contracts generic

Phase 0 uses a simple 1x5 UI, but the following should already use generic shapes from the start so we can later support 15x15, Renju, spectators, and reconnection:

- Coordinates: `position: { x, y }`
- Board size: `boardSize`
- Rule type: `ruleType`
- Version: `stateVersion`
- Visibility: `visibility`
- Participation type: `role`
- End-of-game info: `winningSeat`, `endReason`

---

## Four Communication Patterns and Their Role

| Frontend-side communication pattern | Phase 0 implementation                                                        |
| ----------------------------------- | ----------------------------------------------------------------------------- |
| 1. Browser-only                     | Name input, turn display, click enabled/disabled control                      |
| 2. Click -> server -> response      | Send move via REST and receive accept/reject response                         |
| 3. Fetch -> render                  | Fetch room list and current state via `GET /rooms` and `GET /rooms/:id/state` |
| 4. Server push                      | Send `game:update` to everyone in the room and sync the board                 |

---

## Overall Flow

```text
Player 1:
  Enter name -> create room via POST /rooms
             -> create one Match record
             -> create one MatchParticipant(role=PLAYER, seat=BLACK)

Player 2:
  Enter name -> fetch room list via GET /rooms
             -> join via POST /rooms/:id/join
             -> create one MatchParticipant(role=PLAYER, seat=WHITE)

Once two players are present:
  Match.status = IN_PROGRESS
  Match.nextTurnSeat = BLACK
  Record Match.startedAt

Both players:
  Subscribe to the room via WebSocket

When making a move:
  1. The player clicks a cell
  2. If the action is obviously invalid, the frontend does not send it
     - example: the cell is already occupied
     - example: it is not your turn
  3. Send POST /rooms/:id/moves
  4. The backend checks:
     - whether playerId is a valid MatchParticipant in the room
     - whether role is PLAYER
     - whether seat matches the current turn
     - whether the position is valid
     - whether the target cell is unoccupied
  5. If invalid, return a REST error response
  6. If valid, save MatchMove(participantId, x, y, requestId, baseVersion, stateVersion)
     and update Match.stateVersion and nextTurnSeat
     - `moveNumber` is assigned by the server, not the frontend
     - numbering is based on the current number of moves in the room, then saved as `+1`
  7. After the save succeeds, broadcast game:update to everyone in the room
  8. Both the player who moved and the opponent update their board from the same game:update
```

Notes:

- If the room creator is logged in, `Match.createdByUserId` can be filled
- If a participant is logged in, `MatchParticipant.userId` can be filled
- Even if chat is not implemented in Phase 0, future room chat can be attached through `Conversation.matchId`

---

## Sequence Diagram

```text
Player1       Frontend1      Backend           DB           Frontend2
  |               |             |               |                |
  | Enter name    |             |               |                |
  |--click------->|             |               |                |
  |               | POST /rooms |               |                |
  |               |------------>| INSERT room   |                |
  |               |             | INSERT participant(BLACK)      |
  |               |             |-------------> |                |
  |               | <-----------| roomId/player |                |
  |               |             |               |                |
  |      (Player2 joins via GET /rooms -> POST /join)            |
  |               |             | INSERT participant(WHITE)      |
  |               |             | UPDATE Match.status=IN_PROGRESS     |
  |               |             |               |                |
  |      (Both clients subscribe to the room via WebSocket)      |
  |               | WS subscribe|               |                |
  |               |------------>|               |                |
  |               |             |<--------------| WS subscribe   |
  |               |             |               |                |
  | Click a cell  |             |               |                |
  |--click------->|             |               |                |
  |               | POST /moves |               |                |
  |               |------------>| Validate move |                |
  |               |             | INSERT move   |                |
  |               |             | UPDATE room   |                |
  |               |             |-------------> |                |
  |               | <-----------| {ok:true}     |                |
  |               |             | WS game:update|--------------->|
  |               |<------------| WS game:update|                |
  | Update board  |             |               | Update board   |
```

Notes:

- A successful REST response means "accepted"
- The only source of truth for official board updates is WebSocket `game:update`
- Error display is returned only to the requesting player through REST failure responses

---

## API List

### REST

| Method | Path                   | Description                                                      |
| ------ | ---------------------- | ---------------------------------------------------------------- |
| `POST` | `/api/rooms`           | Create a room                                                    |
| `GET`  | `/api/rooms`           | Return a list of joinable rooms                                  |
| `POST` | `/api/rooms/:id/join`  | Join the specified room                                          |
| `POST` | `/api/rooms/:id/moves` | Send a move command                                              |
| `GET`  | `/api/rooms/:id/state` | Return the current state; used for reconnection and initial sync |

### Match Creation API

```ts
// POST /api/rooms

// Request
{
  displayName: string,
  visibility?: "PUBLIC" | "PRIVATE",
  ruleType?: "GOMOKU" | "RENJU",
  boardSize?: 15
}

// Response
{
  roomId: string,
  playerId: string, // MatchParticipant.id
  role: "PLAYER",
  seat: "BLACK"
}
```

When creating a room, the backend does the following:

- Create one `Match`
- Create one `MatchParticipant` for the creator with `role = PLAYER` and `seat = BLACK`
- If the creator is logged in, fill `Match.createdByUserId` and `MatchParticipant.userId`
- Leave `winningSeat`, `endReason`, `startedAt`, and `finishedAt` as `null`

### Match Join API

```ts
// POST /api/rooms/:id/join

// Request
{
  displayName: string
}

// Response
{
  roomId: string,
  playerId: string, // MatchParticipant.id
  role: "PLAYER",
  seat: "WHITE"
}
```

When the second player joins, the backend performs the following in the same transaction or immediately afterward:

- Update `Match.status` to `IN_PROGRESS`
- Set `nextTurnSeat` to `BLACK`
- Record `startedAt` if needed
- Keep `winningSeat` and `endReason` as `null`

The start of the match is represented not by a dedicated `room:started` event, but by `status: "IN_PROGRESS"` included in the next `game:update`.

### MatchMove API

```ts
// POST /api/rooms/:id/moves

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
    | "room_not_found"
    | "game_not_started"
    | "game_finished"
    | "room_cancelled"
    | "not_a_player"
    | "stale_state",
  requestId: string | null
}
```

`baseVersion` shows which state version the client was looking at when it made the move. Since `MatchMove.baseVersion` already exists in the current schema as nullable, Phase 0.3 treats it as "optional for now, but send it when available."

`requestId` is treated as an **idempotency key and response correlation key** generated by the frontend for each move.

- The frontend generates `requestId` before sending the request
- The server stores it in `MatchMove.requestId` and returns the same value in the response
- If the same `requestId` is retried, the system should avoid creating duplicate moves while still allowing the frontend to identify which action the response belongs to
- Uniqueness is enforced by `MatchMove` `@@unique([matchId, requestId])`

Also, `occupied` is protected not only by app-level validation, but also by `MatchMove` `@@unique([matchId, x, y])`.

### State Fetch API

```ts
// GET /api/rooms/:id/state

{
  roomId: string,
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
    displayName: string, // returned from MatchParticipant.displayNameSnapshot
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

By returning `participants`, the Phase 0 frontend can simply use the two records where `role === "PLAYER"`, while future spectator UI can reuse the same shape without redesign.

---

## WebSocket Events

| Direction        | Event name        | Description                                                       |
| ---------------- | ----------------- | ----------------------------------------------------------------- |
| Client -> Server | `room:subscribe`  | Start subscribing to a room                                       |
| Server -> Client | `room:subscribed` | Subscription completed                                            |
| Server -> Client | `game:update`     | Broadcast the latest confirmed game state to everyone in the room |
| Server -> Client | `room:closed`     | Notify clients of `FINISHED` / `CANCELLED` or connection cleanup  |

### Example `game:update`

```ts
{
  roomId: string,
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

`game:update` is sent to **everyone in the room, including the player who made the move**.

---

## Error Display Policy

### Cases the frontend may silently block

The following cases can be determined entirely on the frontend before sending, so it is acceptable to treat them as invalid actions and not send REST requests.

- Clicking an already occupied cell
- A clearly not-your-turn state
- A move attempt by a participant already known to have `role !== PLAYER`

This can still work even with no visible feedback, but at minimum one of the following is desirable:

- Disable clicking
- Do not show hover feedback
- Show a fixed message such as `Waiting for your opponent's move`

However, these are only **UX-oriented pre-checks**, not a replacement for server authority. If the client state is stale or simultaneous actions occur, the backend may still reject the move for the same reasons.

### Cases that should be returned via REST

The following cases require server confirmation, so they should be handled in the REST response.

- `occupied`
- `not_your_turn`
- `not_a_player`
- `game_finished`
- `room_cancelled`
- `room_not_found`
- `stale_state`

`occupied` and `not_your_turn` are usually prevented on the frontend, but they may still be returned by REST for the following reasons:

- The client was looking at an outdated `game:update`
- Another player moved at almost the same time
- Duplicate send or retry happened

Therefore the implementation policy should be:

- Frontend: stop the action before sending whenever it can determine that locally
- Backend: always perform final validation and return the same reason when necessary

Error display can remain simple.

- `occupied` -> `You cannot place a stone there`
- `not_your_turn` -> `Waiting for your opponent's move`
- `not_a_player` -> `This participant is not allowed to make moves`
- `game_finished` -> `This match has already finished`
- `room_cancelled` -> `This room has been closed`
- `stale_state` -> `The board has been updated`

### Network failure

If the REST request itself fails, handle it separately.

- `network_error`
- `timeout`

Example messages:

- `Communication failed`
- `Please try again`

---

## DB Schema Design

The following is the part of `apps/backend/prisma/schema.prisma` directly related to the match domain.

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

Even if the Phase 0 UI is only 1x5, the DB already includes the following fields, so it can be extended directly to 15x15 boards and spectator mode:

- `x / y`
- `stateVersion`
- `baseVersion`
- `role`
- `seat`
- `winningSeat`
- `endReason`

---

## File Structure Notes

### Prisma-related files currently present

```text
apps/backend/
  prisma/
    schema.prisma             <- current schema source of truth
  generated/
    prisma/                   <- client generated from schema.prisma
  lib/
    prisma.ts                 <- Prisma client entry point
```

### Candidate placement for Phase 0 implementation

```text
apps/frontend/
  app/
    proto/
      page.tsx                <- Phase 0 verification page
  components/
    proto/
      NameInput.tsx           <- player name input
      RoomList.tsx            <- room list display
      MiniBoard.tsx           <- simple 1x5 board UI
      TurnBanner.tsx          <- turn and error display
  hooks/
    useRoom.ts                <- room creation, join, and state fetch
    useSocketGame.ts          <- room subscription and game:update handling

apps/backend/
  app/
    api/
      rooms/
        route.ts              <- GET, POST /api/rooms
        [id]/
          join/route.ts       <- POST /api/rooms/:id/join
          moves/route.ts      <- POST /api/rooms/:id/moves
          state/route.ts      <- GET /api/rooms/:id/state
  lib/
    prisma.ts                 <- Prisma client
    rooms/
      room-store.ts           <- room / participant / move management via Prisma
    game/
      move-validator.ts       <- legal move validation
      state-builder.ts        <- build state from MatchMove records
    socket/
      game-handler.ts         <- room:subscribe and game:update broadcast
  prisma/
    schema.prisma
```

`Conversation` and `DirectMessage` do not need implementation in Phase 0, but room chat can later be added through `Conversation.matchId`.

---

## Implementation Order

In this phase, do not implement by large horizontal layers. Instead, move forward using tiny vertical slices where **1 command = 1 visible outcome**.

Each slice should contain only these four things whenever possible:

- One frontend action
- One REST or WebSocket responsibility
- One DB change or the minimum necessary DB usage
- One visible confirmation in the UI

```text
Slice 0: minimum create_room flow
  - Schema: use existing Match / MatchParticipant
  - Save: store MatchParticipant(role=PLAYER, seat=BLACK) for the creator
  - Front: only a Create room button
  - API: POST /api/rooms
  - Confirm: roomId and playerId appear on the screen

Slice 1: add list_rooms
  - API: GET /api/rooms
  - Query: return rooms with status=WAITING and visibility=PUBLIC
  - Front: display a list of created rooms
  - Confirm: the room created just before is visible in the list

Slice 2: add join_room
  - Schema: use existing MatchParticipant
  - Save: store the participant with role=PLAYER, seat=WHITE
  - Transition: when 2 players are present, update Match.status=IN_PROGRESS, nextTurnSeat=BLACK, startedAt
  - Front: add a Join button
  - Confirm: both players' displayName and seat are visible

Slice 3: add subscribe_room
  - WS: room:subscribe / room:subscribed
  - Front: display subscription status
  - Confirm: subscribed appears on the screen

Slice 4: minimum submit_move
  - Schema: use existing MatchMove
  - Save: store moveNumber, participantId, x, y, requestId, baseVersion, stateVersion
  - API: POST /api/rooms/:id/moves
  - Rule: prioritize confirming that saving works first
  - Confirm: after saving, game:update reaches both screens

Slice 5: add not_your_turn
  - Rule: add turn validation
  - Confirm: if the wrong player tries to move, REST returns an error

Slice 6: add occupied
  - Rule: add occupied-cell validation
  - DB Guard: also protect it through @@unique([matchId, x, y])
  - Confirm: placing on an occupied cell is rejected

Slice 7: add stateBuilder
  - Logic: build the board from MatchMove records
  - WS: include board / participants / status in game:update
  - Confirm: the full board is rendered, not just the last move
  - Confirm: the WAITING -> IN_PROGRESS transition is also visible through game:update

Slice 8: add GET /state
  - API: GET /api/rooms/:id/state
  - Front: implement initial sync on reload
  - Front: restore the local seat using playerId from sessionStorage
  - Confirm: after reload, the same board state is restored

Slice 9: actively use stateVersion / baseVersion
  - Schema: use existing Match.stateVersion and MatchMove.baseVersion
  - Rule: support stale_state
  - Confirm: moves from stale client state can be rejected

Slice 10: prepare the entry point for terminal states
  - State: provide an update path for FINISHED / CANCELLED and winningSeat / endReason / finishedAt
  - Note: win/loss judgment itself may be deferred to Phase 1
  - Note: in Phase 0.3, keep CANCELLED as a state in the model first, and defer actual transitions caused by disconnects or timeouts to Phase 1
```

Do not build `moveValidator` fully from the beginning. First make sure "it can be saved" and "it can be broadcast" work, then add rules one by one afterward.

---

## Phase 0 Completion Criteria

- Player 1 can create a room
- Player 2 can see the room list and join
- `MatchParticipant.id` is stored as `playerId` and can be used for resync
- Both players can subscribe to the same room
- Moves are confirmed only through backend validation and DB persistence
- Invalid moves are returned to the requesting player as REST errors
- Official board updates are broadcast to everyone through `game:update`
- Both the player who moved and the opponent update the board from the same event
- The client can resync through `GET /state`
- The local match flow works even when `userId` is `null`
- It can run locally through Docker Compose

---

## Migration Path from Phase 0 to Phase 1

| Phase 0 component                      | Phase 1 use                                                                      |
| -------------------------------------- | -------------------------------------------------------------------------------- |
| `MiniBoard.tsx`                        | Replace with `Board.tsx` (15x15)                                                 |
| `move-validator.ts`                    | Extend to Gomoku win/loss judgment                                               |
| `state-builder.ts`                     | Reuse for spectators, reconnection, and move replay                              |
| `Match / MatchParticipant / MatchMove` | Extend to Renju, public/private rooms, and spectators                            |
| `role / userId`                        | Connect to auth, spectators, and friend flows                                    |
| `stateVersion / baseVersion`           | Foundation for simultaneous move handling, retries, and reconnection             |
| `winningSeat / endReason`              | Foundation for match result display and history persistence                      |
| `Conversation.matchId`                 | Connect to room chat                                                             |
| `UserGameStats`                        | Connect to stats, rating, and ranking                                            |
| `GET /state`                           | Foundation for reconnection, page reload, and joining ongoing games as spectator |

The goal of Phase 0 is not to build a toy game. It is to build the communication core first, in a way that can scale toward a Gomoku.com-style service while staying aligned with the current schema.
