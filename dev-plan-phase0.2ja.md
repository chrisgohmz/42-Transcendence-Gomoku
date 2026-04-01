# 開発方針メモ：Phase 0.2 通信基盤確認

## 背景と目的

現状のリポジトリは `frontend / backend / PostgreSQL` の Docker 構成と、Next.js + Socket.IO + Prisma の疎通確認まで完了している。ゲーム盤面・ルール判定・マッチング・認証・履歴・ランキングはまだ未実装。

MVP は「まずオンライン五目並べを成立させる」ことに切る。その前段として、以下を **後でそのまま育てられる本番寄りの部品** として実装しながら確認する。

- サーバー権威のゲーム状態管理
- REST と WebSocket の責務分離
- DB 永続化を伴う着手確定
- 再接続や拡張に耐える API 契約

UI は簡略化してよいが、API やデータ構造は最初から将来拡張しやすい形に寄せる。盤面表示は **1x5 の簡易ボード** でよいが、座標表現は最初から `{ x, y }` を使う。

---

## 設計原則

### 1. サーバー権威

「正しいゲーム状態はサーバーだけが持つ」という方針を採用する。

- 合法手判定はバックエンドが行う
- DB 保存が成功した着手だけを正式状態とする
- クライアントは `game:update` を受けて初めて盤面を更新する
- クライアントはローカルで仮確定しない

### 2. REST と WebSocket の責務分離

`REST + WebSocket` の併用は採用する。ただし、同じ責務を二重に持たせない。

- REST: コマンド送信とエラー応答
- WebSocket: 確定済み状態の配信

この設計では、石を置いた本人も相手プレイヤーも **同じ `game:update`** を受けて盤面を更新する。

### 3. 表示名と内部識別子を分離

`playerName` は表示用の値であり、権限判定には使わない。

- 表示用: `displayName`
- 内部識別: `playerId`
- 席情報: `seat` (`BLACK` / `WHITE`)

#### Phase 0 における `playerId` の保持方針

`playerId` は、ルーム作成または参加の成功時にバックエンドが発行し、フロントエンドは **`sessionStorage`** に保持する。

- 対象: `roomId`, `playerId`, `seat`, `displayName`
- 理由: タブ内リロードには耐えたいが、永続ログインの責務までは持たせないため
- スコープ: 同一タブの一時セッション

保存イメージ:

```ts
sessionStorage["proto:roomSession:<roomId>"] = JSON.stringify({
  roomId,
  playerId,
  seat,
  displayName,
});
```

Phase 0 では以下の扱いとする。

- `sessionStorage` に情報があれば、その `playerId` で再接続する
- 情報がなければ、リロード後は再参加または新規作成とする
- Cookie や認証セッションへの統合は Phase 1 以降で扱う

### 4. UI は簡略、契約は汎用

Phase 0 では 1x5 の簡易 UI を使うが、将来の 15x15・連珠・観戦・再接続に備え、以下は最初から汎用形にする。

- 座標: `position: { x, y }`
- 盤面サイズ: `boardSize`
- ルール種別: `ruleType`
- バージョン: `stateVersion`
- 公開範囲: `visibility`

---

## 4 種類の通信パターンと位置づけ

| フロント視点の通信パターン         | Phase 0 での対応実装                                    |
| ---------------------------------- | ------------------------------------------------------- |
| ① ブラウザ完結                     | 名前入力・手番表示・クリック可能/不可の制御             |
| ② クリック → サーバー → レスポンス | 着手を REST で送信し、受理/拒否を返す                   |
| ③ フェッチ → レンダリング          | `GET /rooms` と `GET /rooms/:id/state` で一覧・状態取得 |
| ④ サーバープッシュ                 | `game:update` を room 全員へ配信し、盤面を同期          |

---

## 全体フロー

```text
プレイヤー1:
  名前入力 → POST /rooms でルーム作成

プレイヤー2:
  名前入力 → GET /rooms で一覧取得
           → POST /rooms/:id/join で参加

両者:
  WebSocket で room を購読

着手時:
  1. プレイヤーがマスをクリック
  2. フロントで明らかに無効な操作なら送信しない
     - 例: 既に埋まっている
     - 例: 自分の手番ではない
  3. POST /rooms/:id/moves を送る
  4. バックエンドが合法手判定を行う
  5. NG なら REST でエラー応答を返す
  6. OK なら DB に保存し stateVersion を進める
  7. 保存成功後、game:update を room 全員へ配信する
  8. 着手した本人も相手も、同じ game:update を受けて盤面を更新する
```

---

## シーケンス図

```text
Player1       Frontend1      Backend           DB           Frontend2
  |               |             |               |                |
  | 名前入力      |             |               |                |
  |--click------->|             |               |                |
  |               | POST /rooms |               |                |
  |               |------------>| INSERT room   |                |
  |               |             |-------------> |                |
  |               | <-----------| roomId/player |                |
  |               |             |               |                |
  |      (Player2 が GET /rooms → POST /join で参加)             |
  |               |             |               |                |
  |      (両者が WebSocket で room を購読)                       |
  |               | WS subscribe|               |                |
  |               |------------>|               |                |
  |               |             |<--------------| WS subscribe   |
  |               |             |               |                |
  | マスをクリック|             |               |                |
  |--click------->|             |               |                |
  |               | POST /moves |               |                |
  |               |------------>| 合法手判定    |                |
  |               |             | INSERT move   |                |
  |               |             |-------------> |                |
  |               | <-----------| {ok:true}     |                |
  |               |             | WS game:update|--------------->|
  |               |<------------| WS game:update|                |
  | 盤面更新      |             |               |   盤面更新     |
```

注記:

- REST 成功レスポンスは「受理された」ことを返す
- 盤面の正式更新は WebSocket の `game:update` を唯一の真実とする
- REST 失敗時のみ、本人にエラー表示を返す

---

## API 一覧

### REST

| メソッド | パス                   | 説明                                   |
| -------- | ---------------------- | -------------------------------------- |
| `POST`   | `/api/rooms`           | ルームを作成する                       |
| `GET`    | `/api/rooms`           | 参加可能なルーム一覧を返す             |
| `POST`   | `/api/rooms/:id/join`  | 指定ルームに参加する                   |
| `POST`   | `/api/rooms/:id/moves` | 着手コマンドを送信する                 |
| `GET`    | `/api/rooms/:id/state` | 現在状態を返す。再接続や初期同期に使う |

### ルーム作成 API

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

### ルーム参加 API

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

ルーム参加時に 2 人揃った場合、バックエンドは同じトランザクション内または直後の処理で以下を行う。

- `Room.status` を `PLAYING` に更新する
- `nextTurnSeat` を `BLACK` に設定する
- 必要なら `startedAt` を記録する

対局開始の事実は、専用の `room:started` ではなく、次の `game:update` に含まれる `status: "playing"` で表現する。

### 着手 API

```ts
// POST /api/rooms/:id/moves

// Request
{
  playerId: string,
  position: { x: number, y: number },
  requestId: string,
  baseVersion: number
}

// Response（成功）
{
  ok: true,
  accepted: true,
  requestId: string
}

// Response（失敗）
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

`baseVersion` は「クライアントがどの状態を見て着手したか」を示す。Phase 0 では必須ではないが、入れておくと再送・遅延・同時着手に強くなる。

### 状態取得 API

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

## WebSocket イベント

| 方向            | イベント名        | 内容                                       |
| --------------- | ----------------- | ------------------------------------------ |
| Client → Server | `room:subscribe`  | room の購読開始                            |
| Server → Client | `room:subscribed` | 購読完了通知                               |
| Server → Client | `game:update`     | 確定済みの最新ゲーム状態を room 全員へ配信 |
| Server → Client | `room:closed`     | ルーム終了や切断整理を通知                 |

### `game:update` の例

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

`game:update` は **着手した本人を含む room 全員** に送る。

---

## エラー表示方針

### フロントで握りつぶしてよいもの

以下は、送信前にフロントだけで分かるため、REST を送らずに無効操作として扱ってよい。

- 既に埋まっているマス
- 明らかに自分の手番でない状態

この場合は「完全無反応」でも動くが、最低限以下のどれかは欲しい。

- クリック不可にする
- hover を出さない
- `相手の手を待っています` のような固定表示を出す

ただし、これらは **UX 上の事前チェック** であり、サーバー権威の代替ではない。クライアント状態が古い場合や同時操作が起きた場合には、バックエンドが同じ理由で拒否することがある。

### REST で返すべきもの

以下はサーバーに確認しないと確定できないため、REST レスポンスで扱う。

- `occupied`
- `not_your_turn`
- `game_finished`
- `room_not_found`
- `stale_state`

`occupied` と `not_your_turn` は、フロントが通常は事前に防ぐ対象だが、以下の理由で REST でも返しうる。

- クライアントが古い `game:update` を見ていた
- ほぼ同時に別プレイヤーが着手した
- 多重送信や再送が起きた

したがって実装方針は以下とする。

- フロント: 分かる範囲では送信前に止める
- バックエンド: 常に最終判定を行い、必要なら同じ理由を返す

表示は簡素でよい。

- `occupied` → `そこには置けません`
- `not_your_turn` → `相手の手を待っています`
- `game_finished` → `この対局は終了しています`
- `stale_state` → `盤面が更新されました`

### 通信失敗

REST 自体が失敗した場合は、別扱いにする。

- `network_error`
- `timeout`

表示例:

- `通信に失敗しました`
- `再試行してください`

---

## DB テーブル設計

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
  id              String      @id @default(cuid())
  status          RoomStatus  @default(WAITING)
  ruleType        RuleType    @default(GOMOKU)
  visibility      Visibility  @default(PUBLIC)
  boardSize       Int         @default(15)
  stateVersion    Int         @default(0)
  nextTurnSeat    Seat?
  startedAt       DateTime?
  finishedAt      DateTime?
  createdAt       DateTime    @default(now())
  players         RoomPlayer[]
  moves           Move[]
}

model RoomPlayer {
  id              String      @id @default(cuid())
  roomId          String
  room            Room        @relation(fields: [roomId], references: [id])
  displayName     String
  seat            Seat
  createdAt       DateTime    @default(now())

  @@unique([roomId, seat])
}

model Move {
  id              String      @id @default(cuid())
  roomId          String
  room            Room        @relation(fields: [roomId], references: [id])
  playerId        String
  player          RoomPlayer  @relation(fields: [playerId], references: [id])
  moveNumber      Int
  x               Int
  y               Int
  requestId       String?
  stateVersion    Int
  createdAt       DateTime    @default(now())

  @@unique([roomId, moveNumber])
  @@unique([roomId, requestId])
}
```

Phase 0 の UI は 1x5 でも、DB は `x / y` と `stateVersion` を持つことで 15x15 にそのまま伸ばせる。

---

## ファイル構成

現在のリポジトリ構成に合わせ、以下のように整理する。

### フロントエンド

```text
apps/frontend/
  app/
    proto/
      page.tsx               ← Phase 0 の検証ページ
  components/
    proto/
      NameInput.tsx          ← プレイヤー名入力
      RoomList.tsx           ← ルーム一覧表示
      MiniBoard.tsx          ← 1x5 UI の簡易盤面
      TurnBanner.tsx         ← 手番とエラー表示
  hooks/
    useRoom.ts               ← ルーム作成・参加・状態取得
    useSocketGame.ts         ← room 購読と game:update 受信
```

### バックエンド

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
      room-store.ts          ← Prisma を使った room 管理
    game/
      move-validator.ts      ← 合法手判定
      state-builder.ts       ← Move から state を組み立てる
    socket/
      game-handler.ts        ← room:subscribe と game:update 配信
  prisma/
    schema.prisma
  server.ts                  ← Next.js + Socket.IO の起動点
```

---

## 実装順序

この Phase では、レイヤーごとの大きな実装ではなく、**1 コマンド = 1 つの見える成果** を確認する極小の縦スライスで進める。

各スライスは、できるだけ以下の 4 点だけを持つ。

- フロントの操作が 1 つある
- REST または WebSocket の責務が 1 つある
- DB の変更が 1 つか最小限である
- 画面で「動いた」が確認できる

```text
Slice 0: create_room の最小疎通
  - Schema: Room(id, status, createdAt) だけ
  - Front: Create room ボタンだけ
  - API: POST /api/rooms
  - Confirm: roomId が画面に表示される

Slice 1: list_rooms を追加
  - API: GET /api/rooms
  - Front: 作成済み room 一覧を表示
  - Confirm: 直前に作った room が一覧に見える

Slice 2: join_room を追加
  - Schema: RoomPlayer を追加
  - API: POST /api/rooms/:id/join
  - Front: Join ボタンを追加
  - Confirm: 2 人の displayName / seat が画面に見える
  - Note: 2 人揃ったら backend が Room.status を PLAYING に更新する

Slice 3: subscribe_room を追加
  - WS: room:subscribe / room:subscribed
  - Front: 購読状態を表示
  - Confirm: subscribed が画面に出る

Slice 4: submit_move の最小版
  - Schema: Move を追加
  - API: POST /api/rooms/:id/moves
  - Rule: 最初は保存できることの確認を優先する
  - Confirm: 保存後に game:update が両画面へ届く

Slice 5: not_your_turn を追加
  - Rule: 手番チェックだけ入れる
  - Confirm: 間違った人が打つと REST エラーになる

Slice 6: occupied を追加
  - Rule: 占有チェックを入れる
  - Confirm: 既に埋まった場所に置けない

Slice 7: stateBuilder を追加
  - Logic: Move から board を組み立てる
  - WS: game:update に board を載せる
  - Confirm: 最後の一手だけでなく盤面全体が描画される
  - Confirm: status が WAITING → PLAYING に変わったことも game:update で見える

Slice 8: GET /state を追加
  - API: GET /api/rooms/:id/state
  - Front: 再読込時の初期同期を実装
  - Front: sessionStorage の playerId を使って自席情報も復元する
  - Confirm: リロード後に同じ盤面へ戻る

Slice 9: stateVersion / baseVersion を追加
  - Rule: stale_state を扱えるようにする
  - Confirm: 古い状態からの着手を拒否できる
```

`moveValidator` は最初から全部作らない。まずは「保存できる」「配信できる」を通し、その後にルールを 1 つずつ追加する。

---

## Phase 0 完了条件

- プレイヤー1がルームを作成できる
- プレイヤー2がルーム一覧を見て参加できる
- 両者が同じ room を購読できる
- 着手はバックエンドの合法手判定と DB 保存を経由して確定する
- 不正手は REST エラーとして本人に返る
- 正式な盤面更新は `game:update` で全員に配信される
- 着手した本人も相手も、同じイベントで盤面を更新する
- `GET /state` で再同期できる
- Docker Compose でローカル起動できる

---

## Phase 0 → Phase 1 への移行方針

| Phase 0 の部品             | Phase 1 での用途                         |
| -------------------------- | ---------------------------------------- |
| `MiniBoard.tsx`            | `Board.tsx`（15x15）へ置き換え           |
| `move-validator.ts`        | 五目並べの勝敗判定へ拡張                 |
| `state-builder.ts`         | 観戦・再接続・棋譜再生に流用             |
| `Room / RoomPlayer / Move` | 連珠・公開/非公開・観戦へ拡張            |
| `stateVersion`             | 同時着手・再送・再接続対応の基礎         |
| `useSocketGame.ts`         | 対局通知、チャット、観戦通知にも拡張     |
| `GET /state`               | 再接続・ページ再読込・観戦途中参加の基礎 |

Phase 0 の目的は「簡易ゲームを作ること」ではなく、**将来の Gomoku.com 風サービスでも通用する通信の芯を先に作ること** とする。
