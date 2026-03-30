# Development Plan: Phase 0.2 — Communication Layer Verification

## Background and Purpose

The repository already has a working Docker setup with `frontend / backend / PostgreSQL`, and basic connectivity has been confirmed for Next.js + Socket.IO + Prisma. The game board, rule validation, matchmaking, authentication, match history, and rankings are all still unimplemented.

The MVP target is to get an online Gomoku game working end-to-end. Before reaching that, the goal of this phase is to build the following as **production-grade components that can be grown in place** rather than thrown away:

- Server-authoritative game state management
- Clear separation of responsibilities between REST and WebSocket
- Move confirmation backed by DB persistence
- An API contract that can handle reconnection and future extension

The UI can be simplified, but the API shapes and data structures should be future-friendly from the start. The board display can be a **1x5 mini board**, but coordinates must use `{ x, y }` from day one.

---

## Design Principles

### 1. Server Authority

The policy is: **the server is the sole source of truth for game state.**

- Move legality is always validated by the backend
- Only moves that have been successfully written to the DB become official
- The client updates the board only after receiving `game:update`
- The client never optimistically confirms a move locally

### 2. Separation of REST and WebSocket Responsibilities

Both REST and WebSocket are used, but their responsibilities must not overlap.

- REST: sending commands and receiving error responses
- WebSocket: distributing confirmed state to all participants

Under this design, both the player who made the move and the opponent update their boards from the **same `game:update` event**.

### 3. Separating Display Name from Internal Identifier

`playerName` is for display only and must not be used for authorization.

- Display: `displayName`
- Internal identity: `playerId`
- Seat assignment: `seat` (`BLACK` / `WHITE`)

#### `playerId` Storage Policy in Phase 0

`playerId` is issued by the backend upon successful room creation or join. The frontend stores it in **`sessionStorage`**.

- Fields stored: `roomId`, `playerId`, `seat`, `displayName`
- Rationale: the session should survive a tab reload, but persistent login is out of scope for this phase
- Scope: same-tab temporary session

Storage example:

```ts
sessionStorage["proto:roomSession:<roomId>"] = JSON.stringify({
  roomId,
  playerId,
  seat,
  displayName,
})
```

Phase 0 behavior:

- If `sessionStorage` holds a session, reconnect using that `playerId`
- If not, a reload means re-joining or creating a new room
- Cookie-based or authenticated session integration is deferred to Phase 1

### 4. Simplified UI, Generic Contract

Phase 0 uses a simplified 1x5 UI, but the following fields are designed for the full game from the start, to support 15x15, Renju, spectating, and reconnection later:

- Coordinate: `position: { x, y }`
- Board size: `boardSize`
- Rule type: `ruleType`
- State version: `stateVersion`
- Visibility: `visibility`

---

## Four Communication Patterns

| Pattern (frontend perspective) | Implementation in Phase 0 |
|---|---|
| ① Browser-only | Name input, turn display, click enable/disable control |
| ② Click → Server → Response | Send a move via REST; receive accept or reject |
| ③ Fetch → Render | `GET /rooms` and `GET /rooms/:id/state` for list and state |
| ④ Server Push | Broadcast `game:update` to the whole room; sync the board |

---

## Overall Flow

```text
Player 1:
  Enter name → POST /rooms to create a room

Player 2:
  Enter name → GET /rooms to see the list
             → POST /rooms/:id/join to enter

Both:
  Subscribe to the room via WebSocket

On a move:
  1. Player clicks a cell
  2. If the move is obviously invalid, the frontend suppresses the request
     - e.g. cell is already occupied
     - e.g. it is not this player's turn
  3. POST /rooms/:id/moves is sent
  4. Backend validates move legality
  5. If invalid, return an error via REST
  6. If valid, save to DB and increment stateVersion
  7. After successful save, broadcast game:update to all room members
  8. Both the mover and the opponent update the board from the same game:update
```

---

## Sequence Diagram

```text
Player1       Frontend1      Backend           DB           Frontend2
  |               |             |               |                |
  | enter name    |             |               |                |
  |--click------->|             |               |                |
  |               | POST /rooms |               |                |
  |               |------------>| INSERT room   |                |
  |               |             |-------------> |                |
  |               | <-----------| roomId/player |                |
  |               |             |               |                |
  |      (Player2 does GET /rooms → POST /join)                  |
  |               |             |               |                |
  |      (Both subscribe to room via WebSocket)                   |
  |               | WS subscribe|               |                |
  |               |------------>|               |                |
  |               |             |<--------------| WS subscribe   |
  |               |             |               |                |
  | click a cell  |             |               |                |
  |--click------->|             |               |                |
  |               | POST /moves |               |                |
  |               |------------>| validate move |                |
  |               |             | INSERT move   |                |
  |               |             |-------------> |                |
  |               | <-----------| {ok:true}     |                |
  |               |             | WS game:update|--------------->|
  |               |<------------| WS game:update|                |
  | update board  |             |               |  update board  |
```

Notes:

- A successful REST response means the move was **accepted**, nothing more
- The board is updated exclusively through the WebSocket `game:update` event
- On REST failure, only the mover receives the error message

---

## API Reference

### REST Endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/rooms` | Create a room |
| `GET` | `/api/rooms` | List rooms available to join |
| `POST` | `/api/rooms/:id/join` | Join the specified room |
| `POST` | `/api/rooms/:id/moves` | Submit a move |
| `GET` | `/api/rooms/:id/state` | Get current state; used for reconnection and initial sync |

### Create Room

```ts
// POST /api/rooms

// Request
{
  displayName: string,
  visibility?: "public" | "private",
  ruleType?: "gomoku",
  boardSize?: 15
}

// Response
{
  roomId: string,
  playerId: string,
  seat: "BLACK"
}
```

### Join Room

```ts
// POST /api/rooms/:id/join

// Request
{
  displayName: string
}

// Response
{
  roomId: string,
  playerId: string,
  seat: "WHITE"
}
```

When the second player joins and the room becomes full, the backend does the following within the same transaction or immediately after:

- Update `Room.status` to `PLAYING`
- Set `nextTurnSeat` to `BLACK`
- Record `startedAt` if needed

The game start is communicated not by a dedicated `room:started` event, but through the `status: "playing"` field in the next `game:update`.

### Submit Move

```ts
// POST /api/rooms/:id/moves

// Request
{
  playerId: string,
  position: { x: number, y: number },
  requestId: string,
  baseVersion: number
}

// Response (success)
{
  ok: true,
  accepted: true,
  requestId: string
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
    | "stale_state",
  requestId: string
}
```

`baseVersion` indicates which state the client was looking at when the move was made. It is not required in Phase 0, but including it from the start makes the system resilient to retries, delays, and concurrent moves.

### Get State

```ts
// GET /api/rooms/:id/state

{
  roomId: string,
  status: "waiting" | "playing" | "finished",
  boardSize: number,
  ruleType: "gomoku",
  stateVersion: number,
  nextTurnSeat: "BLACK" | "WHITE" | null,
  players: Array<{
    playerId: string,
    displayName: string,
    seat: "BLACK" | "WHITE"
  }>,
  moves: Array<{
    moveNumber: number,
    playerId: string,
    position: { x: number, y: number }
  }>
}
```

---

## WebSocket Events

| Direction | Event | Description |
|---|---|---|
| Client → Server | `room:subscribe` | Begin subscribing to a room |
| Server → Client | `room:subscribed` | Subscription confirmed |
| Server → Client | `game:update` | Latest confirmed game state broadcast to all room members |
| Server → Client | `room:closed` | Room has ended or been cleaned up |

### `game:update` payload

```ts
{
  roomId: string,
  stateVersion: number,
  boardSize: number,
  nextTurnSeat: "BLACK" | "WHITE" | null,
  lastMove: {
    moveNumber: number,
    playerId: string,
    position: { x: number, y: number }
  } | null,
  board: Cell[][],
  status: "waiting" | "playing" | "finished"
}
```

`game:update` is sent to **all room members, including the player who made the move**.

---

## Error Handling Policy

### What the frontend may suppress

The following can be detected locally before sending, so the frontend may block the request without contacting the server:

- A cell that is already occupied
- A move attempted when it is clearly not this player's turn

In these cases, silent blocking is acceptable, but at least one of the following feedback methods is preferred:

- Disable the click target
- Suppress the hover effect
- Show a static message like "Waiting for opponent's move"

These are **UX pre-checks only** and do not replace server authority. If the client's state is stale or two moves are submitted simultaneously, the backend may return the same rejection reason regardless.

### What must be returned via REST

The following cannot be determined without asking the server, so they are returned as REST error responses:

- `occupied`
- `not_your_turn`
- `game_finished`
- `room_not_found`
- `stale_state`

`occupied` and `not_your_turn` may still reach the server because:

- The client was looking at a stale `game:update`
- Another player moved at nearly the same time
- A request was retried or duplicated

Therefore the policy is:

- Frontend: suppress requests where the invalidity is locally obvious
- Backend: always performs the final validation and returns the reason when needed

Error display text:

- `occupied` → `That cell is already taken`
- `not_your_turn` → `Waiting for opponent's move`
- `game_finished` → `This game has already ended`
- `stale_state` → `The board has been updated`

### Network failures

If the REST request itself fails, treat it separately:

- `network_error`
- `timeout`

Display examples:

- `Connection failed`
- `Please try again`

---

## Database Schema

```prisma
enum RoomStatus {
  WAITING
  PLAYING
  FINISHED
}

enum RuleType {
  GOMOKU
  RENJU
}

enum Visibility {
  PUBLIC
  PRIVATE
}

enum Seat {
  BLACK
  WHITE
}

model Room {
  id              String       @id @default(cuid())
  status          RoomStatus   @default(WAITING)
  ruleType        RuleType     @default(GOMOKU)
  visibility      Visibility   @default(PUBLIC)
  boardSize       Int          @default(15)
  stateVersion    Int          @default(0)
  nextTurnSeat    Seat?
  startedAt       DateTime?
  finishedAt      DateTime?
  createdAt       DateTime     @default(now())
  players         RoomPlayer[]
  moves           Move[]
}

model RoomPlayer {
  id              String   @id @default(cuid())
  roomId          String
  room            Room     @relation(fields: [roomId], references: [id])
  displayName     String
  seat            Seat
  createdAt       DateTime @default(now())

  @@unique([roomId, seat])
}

model Move {
  id              String     @id @default(cuid())
  roomId          String
  room            Room       @relation(fields: [roomId], references: [id])
  playerId        String
  player          RoomPlayer @relation(fields: [playerId], references: [id])
  moveNumber      Int
  x               Int
  y               Int
  requestId       String?
  stateVersion    Int
  createdAt       DateTime   @default(now())

  @@unique([roomId, moveNumber])
  @@unique([roomId, requestId])
}
```

Even though the Phase 0 UI uses a 1x5 board, the DB uses `x / y` coordinates and `stateVersion` so that upgrading to 15x15 requires no schema changes.

---

## File Structure

### Frontend

```text
apps/frontend/
  app/
    proto/
      page.tsx               ← Phase 0 verification page
  components/
    proto/
      NameInput.tsx          ← Player name input
      RoomList.tsx           ← Room list display
      MiniBoard.tsx          ← 1x5 simplified board UI
      TurnBanner.tsx         ← Turn indicator and error display
  hooks/
    useRoom.ts               ← Room creation, joining, state fetching
    useSocketGame.ts         ← Room subscription and game:update handling
```

### Backend

```text
apps/backend/
  app/
    api/
      rooms/
        route.ts             ← GET, POST /api/rooms
        [id]/
          join/route.ts      ← POST /api/rooms/:id/join
          moves/route.ts     ← POST /api/rooms/:id/moves
          state/route.ts     ← GET /api/rooms/:id/state
  lib/
    rooms/
      room-store.ts          ← Room management via Prisma
    game/
      move-validator.ts      ← Move legality validation
      state-builder.ts       ← Rebuilds game state from Move records
    socket/
      game-handler.ts        ← Handles room:subscribe and broadcasts game:update
  prisma/
    schema.prisma
  server.ts                  ← Next.js + Socket.IO entry point
```

---

## Implementation Order

This phase proceeds as **thin vertical slices** — one visible outcome per slice — rather than building full layers at once.

Each slice should ideally have exactly four things:

- One frontend interaction
- One REST or WebSocket responsibility
- One or minimal DB change
- One visible confirmation that it worked

```text
Slice 0: Minimal room creation
  - Schema: Room(id, status, createdAt) only
  - Frontend: a single "Create Room" button
  - API: POST /api/rooms
  - Confirm: roomId appears on screen

Slice 1: Add room listing
  - API: GET /api/rooms
  - Frontend: display list of existing rooms
  - Confirm: the room just created appears in the list

Slice 2: Add room join
  - Schema: add RoomPlayer
  - API: POST /api/rooms/:id/join
  - Frontend: add a Join button
  - Confirm: both players' displayName and seat are visible on screen
  - Note: when the second player joins, the backend sets Room.status to PLAYING

Slice 3: Add room subscription
  - WS: room:subscribe / room:subscribed
  - Frontend: display subscription status
  - Confirm: "subscribed" appears on screen

Slice 4: Minimal move submission
  - Schema: add Move
  - API: POST /api/rooms/:id/moves
  - Rule: focus on confirming that saves work, not full validation
  - Confirm: after saving, game:update arrives on both screens

Slice 5: Add not_your_turn check
  - Rule: add turn validation only
  - Confirm: a move by the wrong player returns a REST error

Slice 6: Add occupied check
  - Rule: add occupancy validation
  - Confirm: placing a stone on a taken cell is rejected

Slice 7: Add stateBuilder
  - Logic: rebuild the full board from Move records
  - WS: include board in game:update payload
  - Confirm: the entire board renders, not just the last move
  - Confirm: status change from WAITING to PLAYING is visible in game:update

Slice 8: Add GET /state
  - API: GET /api/rooms/:id/state
  - Frontend: implement initial sync on page load
  - Frontend: restore seat info using playerId from sessionStorage
  - Confirm: reloading the page returns to the same board state

Slice 9: Add stateVersion / baseVersion
  - Rule: handle stale_state rejection
  - Confirm: a move submitted against an outdated state is rejected
```

`moveValidator` is not built all at once. Start by confirming that moves can be saved and broadcast, then add one rule at a time.

---

## Phase 0 Completion Criteria

- Player 1 can create a room
- Player 2 can view the room list and join
- Both players can subscribe to the same room
- Moves are confirmed only after passing backend validation and DB write
- Invalid moves return a REST error to the mover only
- Board updates are distributed to all room members via `game:update`
- Both the mover and the opponent update the board from the same event
- `GET /state` enables re-synchronization after reconnect or reload
- The full stack starts locally with Docker Compose

---

## Migration Path: Phase 0 → Phase 1

| Phase 0 component | Role in Phase 1 |
|---|---|
| `MiniBoard.tsx` | Replaced by `Board.tsx` (15x15) |
| `move-validator.ts` | Extended with Gomoku win detection |
| `state-builder.ts` | Reused for spectating, reconnection, and game replay |
| `Room / RoomPlayer / Move` | Extended for Renju, public/private rooms, spectating |
| `stateVersion` | Foundation for concurrent move handling, retries, reconnection |
| `useSocketGame.ts` | Extended for game notifications, chat, and spectating |
| `GET /state` | Foundation for reconnection, page reload, and mid-game spectating |

The goal of Phase 0 is not to build a simplified game. It is to **establish the communication core that will hold up in a full Gomoku.com-style service**.
