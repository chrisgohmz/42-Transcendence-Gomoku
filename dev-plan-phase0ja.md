# 開発方針メモ：Phase 0.5 通信基盤確認

## 背景と目的

現状のリポジトリは `app / realtime / caddy / PostgreSQL` を中心にした Docker 構成と、Next.js + Socket.IO + Prisma の疎通確認まで完了している。ゲーム盤面・ルール判定・マッチング・認証・履歴・ランキングはまだ未実装。

また、実装ディレクトリも `apps/frontend` / `apps/backend` 分離ではなく、Next.js 側の本体を `app/`、Socket.IO 側の入口を `realtime/`、公開導線を `infra/caddy/` に置く形へ移行している。

一方で、`prisma/schema.prisma` には、対局の最小構成を超えて以下まで先に入っている。

- `User / OAuthAccount / UserSession` による認証基盤
- `Friendship` によるソーシャル基盤
- `Conversation / ConversationParticipant / DirectMessage` によるチャット基盤
- `Match / MatchParticipant / MatchMove / UserGameStats` による対局・統計基盤

MVP は引き続き「まずオンライン五目並べを成立させる」ことに切る。ただし Phase 0.5 では、現在の Prisma スキーマと現行ディレクトリ構成に合わせて、**後でそのまま育てられる本番寄りの部品** として実装方針を整理し直す。

- サーバー権威のゲーム状態管理
- REST と WebSocket の責務分離
- DB 永続化を伴う着手確定
- `Match / MatchParticipant / MatchMove` を `User / Conversation` に接続可能なまま使う
- 再接続や拡張に耐える API 契約

UI は簡略化してよいが、API やデータ構造は最初から将来拡張しやすい形に寄せる。盤面表示は **1x5 の簡易ボード** でよいが、座標表現は最初から `{ x, y }` を使う。

---

## 現行システム構造

通信基盤は開発中に次の 3 段階で変化している。

1. フロントエンドサーバー（Next.js）を入口にし、その背後にバックエンドサーバー（Node.js + Next.js + Socket.IO custom server）を置く直列構造
2. フロントエンドとバックエンドを一本化し、Node.js 上で Next.js と Socket.IO を同居させた単一アプリケーションサーバー構造
3. 現在の `app`（Next.js）と `realtime`（Socket.IO）の並列構造

現在の Compose 上の責務分担は以下とする。

- `app`: Next.js の `next dev` / `next start` を実行し、UI レンダリング、Route Handlers、認証、Prisma 経由の DB アクセス、REST API を担当する
- `realtime`: `bun realtime/server.ts` を実行し、Socket.IO の接続受付、room 管理、`match:subscribe` と `game:update` の配信を担当する
- `caddy`: `https://localhost:8443` を終端し、`/socket.io/*` を `realtime:3001` に、それ以外のページと `/api/*` を `app:3000` に reverse proxy する
- `database`: PostgreSQL を提供する

ブラウザからは単一 origin の `https://localhost:8443` にだけ接続しているように見えるが、内部では SSR/REST と realtime 通信は別プロセスで動く。

Next.js の現行 docs でも、通常は `next start` の組み込みサーバーを使い、custom server は例外的な手段として扱われている。また self-hosting では reverse proxy を前段に置く構成が推奨されているため、今後の Slice 3 以降は **「app が状態を確定し、realtime が配信を担う」** 形を前提に進める。

---

## 設計原則

### 1. サーバー権威

「正しいゲーム状態はサーバーだけが持つ」という方針を採用する。

- 合法手判定は API サーバー（`app` の Route Handler）が行う
- DB 保存が成功した着手だけを正式状態とする
- クライアントは `game:update` を受けて初めて盤面を更新する
- クライアントはローカルで仮確定しない

### 2. REST と WebSocket の責務分離

`REST + WebSocket` の併用は採用する。ただし、同じ責務を二重に持たせない。

- REST: `app` がコマンド送信とエラー応答を担当する
- WebSocket: `realtime` が確定済み状態の配信を担当する
- 公開入口: `caddy` が単一 origin を保ったまま `/api/*` と `/socket.io/*` を振り分ける

この設計では、石を置いた本人も相手プレイヤーも **同じ `game:update`** を受けて盤面を更新する。

### 3. 表示名・参加者ID・認証IDを分離

現行スキーマでは、表示名・対局参加者ID・認証済みユーザーIDは別物として扱う。

- 表示用: API 上の `displayName`、DB 上は `MatchParticipant.displayNameSnapshot`
- 内部識別: `playerId`。API 上の `playerId` は `MatchParticipant.id` の別名として扱う
- 認証連携: `userId`。ログイン済みなら `MatchParticipant.userId` と `Match.createdByUserId` に接続する
- 役割: `role` (`PLAYER` / `SPECTATOR`)
- 席情報: `seat` (`BLACK` / `WHITE` / `null`)

Phase 0 ではプレイヤー 2 人対戦だけを対象にするため、通常は `role = PLAYER`、`seat != null` の参加者だけを扱う。ただしスキーマは観戦や認証統合まで見越しているため、文書上も `MatchParticipant` 前提で揃える。

#### Phase 0 における `playerId` の保持方針

`playerId` は、マッチ作成または参加の成功時に API サーバーが返す `MatchParticipant.id` を指す。フロントエンドはこれを **`sessionStorage`** に保持する。

- 対象: `matchId`, `playerId`, `role`, `seat`, `displayName`
- 理由: タブ内リロードには耐えたいが、永続ログインの責務までは持たせないため
- スコープ: 同一タブの一時セッション

保存イメージ:

```ts
sessionStorage["proto:matchSession:<matchId>"] = JSON.stringify({
  matchId,
  playerId,
  role,
  seat,
  displayName,
});
```

Phase 0 では以下の扱いとする。

- `sessionStorage` に情報があれば、その `playerId` で再接続する
- 情報がなければ、リロード後は再参加または新規作成とする
- `userId` や認証セッションとの統合は Phase 1 以降で扱う

### 4. UI は簡略、契約は汎用

Phase 0 では 1x5 の簡易 UI を使うが、将来の 15x15・連珠・観戦・再接続に備え、以下は最初から汎用形にする。

- 座標: `position: { x, y }`
- 盤面サイズ: `boardSize`
- ルール種別: `ruleType`
- バージョン: `stateVersion`
- 公開範囲: `visibility`
- 参加種別: `role`
- 終了情報: `winningSeat`, `endReason`

---

## 4 種類の通信パターンと位置づけ

| フロント視点の通信パターン         | Phase 0 での対応実装                                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------- |
| ① ブラウザ完結                     | 名前入力・手番表示・クリック可能/不可の制御                                         |
| ② クリック → サーバー → レスポンス | `https://localhost:8443` → `caddy` → `app` の REST で受理/拒否を返す                |
| ③ フェッチ → レンダリング          | `GET /api/matches` と `GET /api/matches/:id/state` を `app` から取得して表示する    |
| ④ サーバープッシュ                 | `https://localhost:8443/socket.io/*` → `caddy` → `realtime` で `game:update` を配信 |

---

## 全体フロー

```text
公開入口:
  ブラウザは https://localhost:8443 にだけ接続する
  - /api/* と通常ページは Caddy → app(Next.js)
  - /socket.io/* は Caddy → realtime(Socket.IO)

プレイヤー1:
  名前入力 → POST /api/matches でマッチ作成
          → Caddy 経由で app に到達
          → Match を 1 件作成
          → MatchParticipant(role=PLAYER, seat=BLACK) を 1 件作成

プレイヤー2:
  名前入力 → GET /api/matches で一覧取得
           → POST /api/matches/:id/join で参加
           → Caddy 経由で app に到達
           → MatchParticipant(role=PLAYER, seat=WHITE) を 1 件作成

参加が 2 人揃ったら:
  Match.status = IN_PROGRESS
  Match.nextTurnSeat = BLACK
  Match.startedAt を記録

両者:
  Caddy 経由で realtime の Socket.IO に接続し、
  match:subscribe で match を購読

着手時:
  1. プレイヤーがマスをクリック
  2. フロントで明らかに無効な操作なら送信しない
     - 例: 既に埋まっている
     - 例: 自分の手番ではない
  3. POST /api/matches/:id/moves を送る
  4. app が以下を判定する
     - playerId が match 内の有効な MatchParticipant か
     - role が PLAYER か
     - seat が現在手番か
     - 位置が有効か
     - 対象マスが未占有か
  5. NG なら REST でエラー応答を返す
  6. OK なら MatchMove(participantId, x, y, requestId, baseVersion, stateVersion) を保存し、
     Match.stateVersion と nextTurnSeat を更新する
     - `moveNumber` はフロントではなくサーバーが決める
     - 採番はその match の現在までの着手数を基準に `+1` して保存する
  7. 保存成功後、app は realtime に配信を依頼する
     - 同一プロセス内 emit ではなく、Docker network 内の内部通知を前提とする
  8. realtime が game:update を match 全員へ配信する
  9. 着手した本人も相手も、同じ game:update を受けて盤面を更新する
```

補足:

- ログイン済みユーザーが作成した match では `Match.createdByUserId` を埋められる
- ログイン済み参加者がいれば `MatchParticipant.userId` を埋められる
- Phase 0 ではチャットを実装しなくても、将来は `Conversation.matchId` で match と会話を 1 対 1 に結べる

---

## シーケンス図

```text
Player1     Frontend1       App            DB        Realtime      Frontend2
  |             |            |              |            |             |
  | 名前入力    |            |              |            |             |
  |--click----->|            |              |            |             |
  |             | POST /api/matches ------->| INSERT match           |  |
  |             |            | INSERT participant(BLACK) |            |  |
  |             |            |------------->|            |             |
  |             |<-----------| matchId/player            |             |
  |             |            |              |            |             |
  |   (Player2 が GET /api/matches → POST /api/matches/:id/join で参加)           |
  |             |            | INSERT participant(WHITE) |            |             |
  |             |            | UPDATE Match.status=IN_PROGRESS        |             |
  |             |            |------------->|            |             |
  |             | WS subscribe ------------------------->| join room   |             |
  |             |<--------------------------------------| subscribed  |             |
  |             |            |              |            |             |
  | マスをクリック            |              |            |             |
  |--click----->|            |              |            |             |
  |             | POST /api/matches/:id/moves --------->|             |             |
  |             |            | 合法手判定   |            |             |
  |             |            | INSERT move  |            |             |
  |             |            | UPDATE match |            |             |
  |             |            |------------->|            |             |
  |             |<-----------| {ok:true}    |            |             |
  |             |            | notify latest state ----->|             |
  |             |<--------------------------------------| WS game:update
  | 盤面更新    |            |              |            | 盤面更新    |
```

注記:

- 図では読みやすさのため `caddy` の hop を省略している。公開入口は引き続き `https://localhost:8443`
- REST 成功レスポンスは「受理された」ことを返す
- 盤面の正式更新は WebSocket の `game:update` を唯一の真実とする
- `game:update` の fan-out は realtime が担当し、状態確定は app が担当する
- REST 失敗時のみ、本人にエラー表示を返す

---

## API 一覧

### REST

公開 URL は `caddy` の `https://localhost:8443` を前提とする。以下の `/api/*` はすべて `app` の Route Handler に到達する。

| メソッド | パス                     | 説明                                   |
| -------- | ------------------------ | -------------------------------------- |
| `POST`   | `/api/matches`           | マッチを作成する                       |
| `GET`    | `/api/matches`           | 参加可能なマッチ一覧を返す             |
| `POST`   | `/api/matches/:id/join`  | 指定マッチに参加する                   |
| `POST`   | `/api/matches/:id/moves` | 着手コマンドを送信する                 |
| `GET`    | `/api/matches/:id/state` | 現在状態を返す。再接続や初期同期に使う |

### マッチ作成 API

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

作成時にバックエンドは以下を行う。

- `Match` を 1 件作成する
- 作成者用の `MatchParticipant` を `role = PLAYER`, `seat = BLACK` で 1 件作成する
- ログイン済みなら `Match.createdByUserId` と `MatchParticipant.userId` を埋める
- `winningSeat`, `endReason`, `startedAt`, `finishedAt` は `null` のまま始める

現時点の実装注記:

- `app/api/matches/route.ts` の `POST` はログイン済みセッションを前提にしている
- `displayName` 入力は未接続で、現在は暫定固定値を保存している
- `playerId` は実装上 `participantId` 名で返している（意味は `MatchParticipant.id`）

### マッチ参加 API

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

マッチ参加時にプレイヤー 2 人が揃った場合、バックエンドは同じトランザクション内または直後の処理で以下を行う。

- `Match.status` を `IN_PROGRESS` に更新する
- `nextTurnSeat` を `BLACK` に設定する
- 必要なら `startedAt` を記録する
- `winningSeat` と `endReason` はまだ `null`

対局開始の事実は、専用の `match:started` ではなく、次の `game:update` に含まれる `status: "IN_PROGRESS"` で表現する。

### 着手 API

```ts
// POST /api/matches/:id/moves

// Request
{
  playerId: string,
  position: { x: number, y: number },
  requestId?: string,
  baseVersion?: number
}

// Response（成功）
{
  ok: true,
  accepted: true,
  requestId: string | null
}

// Response（失敗）
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

`baseVersion` は「クライアントがどの状態を見て着手したか」を示す。現行スキーマでは `MatchMove.baseVersion` が nullable で用意済みなので、Phase 0.5 では「今は任意、ただし送れるなら送る」に寄せる。

`requestId` は、フロントエンドが着手のたびに生成する **冪等キー兼レスポンス照合キー** として扱う。

- フロントは送信前に `requestId` を生成する
- サーバーは `MatchMove.requestId` に保存し、レスポンスにも同じ値をそのまま返す
- 再送時に同じ `requestId` が来た場合は、二重着手を防ぎつつ「どの操作に対する応答か」をフロントが対応付けられるようにする
- 一意性は `MatchMove` の `@@unique([matchId, requestId])` を使って担保する

また、`occupied` はアプリ層で事前判定するだけでなく、`MatchMove` の `@@unique([matchId, x, y])` でも守られる想定にする。

### 状態取得 API

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
    displayName: string, // MatchParticipant.displayNameSnapshot を返す
    role: "PLAYER" | "SPECTATOR",
    seat: "BLACK" | "WHITE" | null,
    joinedAt: string,
    leftAt: string | null
  }>,
  moves: Array<{
    moveNumber: number,
    playerId: string, // MatchMove.participantId の API 表現
    position: { x: number, y: number },
    requestId: string | null,
    baseVersion: number | null,
    stateVersion: number
  }>
}
```

`participants` を返す形にしておけば、Phase 0 のフロントは `role === "PLAYER"` の 2 件だけを使い、将来はそのまま観戦者表示にも伸ばせる。

---

## WebSocket イベント

| 方向            | イベント名         | 内容                                        |
| --------------- | ------------------ | ------------------------------------------- |
| Client → Server | `match:subscribe`  | match の購読開始                            |
| Server → Client | `match:subscribed` | 購読完了通知                                |
| Server → Client | `game:update`      | 確定済みの最新ゲーム状態を match 全員へ配信 |
| Server → Client | `match:closed`     | `FINISHED` / `CANCELLED` や切断整理を通知   |

これらのイベントはブラウザからは `https://localhost:8443/socket.io/*` に接続して使う。`caddy` が `realtime:3001` へ転送する。

### `game:update` の例

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

`game:update` は **着手した本人を含む match 全員** に送る。

---

## エラー表示方針

### フロントで握りつぶしてよいもの

以下は、送信前にフロントだけで分かるため、REST を送らずに無効操作として扱ってよい。

- 既に埋まっているマス
- 明らかに自分の手番でない状態
- `role !== PLAYER` と分かっている参加者の着手操作

この場合は「完全無反応」でも動くが、最低限以下のどれかは欲しい。

- クリック不可にする
- hover を出さない
- `相手の手を待っています` のような固定表示を出す

ただし、これらは **UX 上の事前チェック** であり、サーバー権威の代替ではない。クライアント状態が古い場合や同時操作が起きた場合には、バックエンドが同じ理由で拒否することがある。

### REST で返すべきもの

以下はサーバーに確認しないと確定できないため、REST レスポンスで扱う。

- `occupied`
- `not_your_turn`
- `not_a_player`
- `game_finished`
- `match_cancelled`
- `match_not_found`
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
- `not_a_player` → `この参加者は着手できません`
- `game_finished` → `この対局は終了しています`
- `match_cancelled` → `このマッチは終了しました`
- `stale_state` → `盤面が更新されました`

### 通信失敗

REST 自体が失敗した場合は、別扱いにする。

- `network_error`
- `timeout`

表示例:

- `通信に失敗しました`
- `再試行してください`

---

## DB スキーマ設計

`prisma/schema.prisma` のうち、対局領域に直接関係する部分を抜粋すると以下になる。

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

Phase 0 の UI は 1x5 でも、DB はすでに以下を持っているため 15x15 や観戦にそのまま伸ばせる。

- `x / y`
- `stateVersion`
- `baseVersion`
- `role`
- `seat`
- `winningSeat`
- `endReason`

---

## ファイル構成メモ

### 現在確認できる Prisma 関連ファイル

```text
prisma/
  schema.prisma               ← 現行スキーマ本体
generated/
  prisma/                     ← schema.prisma から生成された client
app/
  lib/
    prisma.ts                 ← Prisma client 利用起点
```

### 現在確認できる Phase 0 関連ファイル

```text
app/
  page.tsx                    ← 現在の app + realtime 並列構成の説明と導線
  proto/
    page.tsx                  ← Phase 0 の検証ページ
  api/
    health/
      route.ts                ← app service の healthcheck
    matches/
      route.ts                ← GET, POST /api/matches（実装済み）
      [id]/
        join/route.ts         ← POST /api/matches/:id/join（実装済み）
  components/
    status-panel.tsx          ← app / database / Socket.IO の疎通表示
    proto/
      MatchCreateButton.tsx   ← create_match 操作
      MatchJoinButton.tsx     ← join_match 操作
realtime/
  server.ts                   ← realtime service の入口
infra/
  caddy/
    Caddyfile                 ← `/socket.io/*` とその他 HTTP の振り分け
```

### Phase 0 実装を進める場合の候補配置

```text
app/
  proto/
    page.tsx                  ← Phase 0 の検証ページ
  api/
    matches/
      route.ts                ← GET, POST /api/matches
      [id]/
        join/route.ts         ← POST /api/matches/:id/join
        moves/route.ts        ← POST /api/matches/:id/moves
        state/route.ts        ← GET /api/matches/:id/state
  components/
    proto/
      NameInput.tsx           ← プレイヤー名入力
      MatchList.tsx           ← マッチ一覧表示
      MiniBoard.tsx           ← 1x5 UI の簡易盤面
      TurnBanner.tsx          ← 手番とエラー表示
  hooks/
    useMatch.ts               ← マッチ作成・参加・状態取得
    useSocketGame.ts          ← match 購読と game:update 受信
  lib/
    prisma.ts                 ← Prisma client
    matches/
      match-store.ts          ← Prisma を使った match / participant / move 管理
    game/
      move-validator.ts       ← 合法手判定
      state-builder.ts        ← MatchMove から state を組み立てる
    realtime/
      realtime-publisher.ts   ← app から realtime へ内部通知して配信を依頼する
realtime/
  server.ts                   ← Socket.IO サーバーの入口
  handlers/
    match-subscription.ts     ← match:subscribe / match:subscribed
    game-broadcast.ts         ← app からの内部通知を受けて room に game:update を配信
  lib/
    rooms.ts                  ← room 管理
shared/
  match-events.ts             ← app / realtime / frontend で共有する event payload 型
prisma/
  schema.prisma
infra/
  caddy/
    Caddyfile
```

`app` と `realtime` は別プロセスなので、両者で共有する型やイベント契約は `app/lib` に閉じ込めず、`shared/` のようなルート直下に逃がす前提のほうが扱いやすい。

`Conversation` や `DirectMessage` を扱う実装は Phase 0 では不要だが、match ごとのチャットを追加するなら `Conversation.matchId` を起点に増設できる。

---

## 実装順序

この Phase では、レイヤーごとの大きな実装ではなく、**1 コマンド = 1 つの見える成果** を確認する極小の縦スライスで進める。

各スライスは、できるだけ以下の 4 点だけを持つ。

- フロントの操作が 1 つある
- REST または WebSocket の責務が 1 つある
- DB の変更が 1 つか最小限である
- 画面で「動いた」が確認できる

Slice 0〜2 は `app` の REST と DB 更新だけで完結するため、現在の並列構成の影響は小さい。影響が出るのは Slice 3 以降で、**購読は `realtime`、状態確定は `app`、その間の橋渡しは内部通知** という分担を前提に組み直す必要がある。

```text
Slice 0: create_match の最小疎通（完了）
  - Schema: 既存の Match / MatchParticipant を使う
  - Save: creator 用に MatchParticipant(role=PLAYER, seat=BLACK) を保存
  - Front: Create Match ボタンだけ
  - API: POST /api/matches
  - Confirm: matchId と playerId（実装上は participantId）が画面に表示される

Slice 1: list_matches を追加（完了）
  - API: GET /api/matches
  - Query: status=WAITING かつ visibility=PUBLIC の match 一覧を返す
  - Front: 作成済み match 一覧を表示
  - Confirm: 直前に作った match が一覧に見える

Slice 2: join_match を追加（完了）
  - Schema: 既存の MatchParticipant を使う
  - Save: 参加者を role=PLAYER, seat=WHITE で保存
  - Transition: 2 人揃ったら Match.status=IN_PROGRESS, nextTurnSeat=BLACK, startedAt を更新
  - Front: Join ボタンを追加
  - Confirm: 2 人の displayName / seat が画面に見える

Slice 3: subscribe_match を追加
  - WS: `realtime` で match:subscribe / match:subscribed を実装
  - Route: ブラウザは `https://localhost:8443/socket.io/*` に接続し、Caddy 経由で realtime に入る
  - Front: 購読状態を表示
  - Confirm: subscribed が画面に出る

Slice 4: submit_move の最小版
  - Schema: 既存の MatchMove を使う
  - Save: moveNumber, participantId, x, y, requestId, baseVersion, stateVersion を保存
  - API: `app` に POST /api/matches/:id/moves を追加
  - Bridge: 保存成功後に `app` から `realtime` へ内部通知する経路を追加する
  - Rule: 最初は保存できることの確認を優先する
  - Confirm: 保存後に game:update が両画面へ届く

Slice 5: not_your_turn を追加
  - Rule: `app` 側の着手 Route Handler に手番チェックを入れる
  - Confirm: 間違った人が打つと REST エラーになる

Slice 6: occupied を追加
  - Rule: `app` 側の着手 Route Handler に占有チェックを入れる
  - DB Guard: @@unique([matchId, x, y]) でも守る
  - Confirm: 既に埋まった場所に置けない

Slice 7: stateBuilder を追加
  - Logic: `app` 側で MatchMove から board を組み立てる
  - WS: `app` が構築した game:update payload を `realtime` が fan-out する
  - Confirm: 最後の一手だけでなく盤面全体が描画される
  - Confirm: status が WAITING → IN_PROGRESS に変わったことも game:update で見える

Slice 8: GET /state を追加
  - API: `app` に GET /api/matches/:id/state を追加
  - Front: 再読込時の初期同期を実装
  - Front: sessionStorage の playerId を使って自席情報も復元する
  - Note: `realtime` は再接続時の状態保存先にはせず、初期同期は REST を正とする
  - Confirm: リロード後に同じ盤面へ戻る

Slice 9: stateVersion / baseVersion を有効活用する
  - Schema: 既存の Match.stateVersion と MatchMove.baseVersion を利用する
  - Rule: `app` 側で stale_state を扱えるようにする
  - WS: realtime は確定済み stateVersion をそのまま配信する
  - Confirm: 古い状態からの着手を拒否できる

Slice 10: terminal state の入口を用意する
  - State: FINISHED / CANCELLED と winningSeat / endReason / finishedAt の更新経路を用意
  - Note: 勝敗判定そのものは Phase 1 に回してもよい
  - Note: Phase 0.5 では `CANCELLED` を状態として先に持ち、片方の離脱やタイムアウトで実際に遷移させる処理は Phase 1 に回してよい
  - WS: 終了状態の確定後は `app` から `realtime` へ `match:closed` または最終 `game:update` を流す
```

`moveValidator` は最初から全部作らない。まずは「保存できる」「配信できる」を通し、その後にルールを 1 つずつ追加する。

---

## Phase 0 完了条件

- プレイヤー1がマッチを作成できる
- プレイヤー2がマッチ一覧を見て参加できる
- `MatchParticipant.id` を `playerId` として保持し、再同期に使える
- 両者が同じ match を購読できる
- `https://localhost:8443` の単一 origin で REST と Socket.IO の両方に到達できる
- 着手は API サーバーの合法手判定と DB 保存を経由して確定する
- 不正手は REST エラーとして本人に返る
- 正式な盤面更新は realtime からの `game:update` で全員に配信される
- 着手した本人も相手も、同じイベントで盤面を更新する
- `GET /state` で再同期できる
- `userId` が `null` でもローカル対局フローが成立する
- Docker Compose で `app / realtime / caddy / database` をローカル起動できる

---

## Phase 0 → Phase 1 への移行方針

| Phase 0 の部品                         | Phase 1 での用途                         |
| -------------------------------------- | ---------------------------------------- |
| `MiniBoard.tsx`                        | `Board.tsx`（15x15）へ置き換え           |
| `move-validator.ts`                    | 五目並べの勝敗判定へ拡張                 |
| `state-builder.ts`                     | 観戦・再接続・棋譜再生に流用             |
| `Match / MatchParticipant / MatchMove` | 連珠・公開/非公開・観戦へ拡張            |
| `role / userId`                        | 認証・観戦・フレンド導線へ接続           |
| `stateVersion / baseVersion`           | 同時着手・再送・再接続対応の基礎         |
| `winningSeat / endReason`              | 対局結果表示・履歴保存の基礎             |
| `Conversation.matchId`                 | マッチチャットへ接続                     |
| `UserGameStats`                        | 戦績・レーティング・ランキングへ接続     |
| `GET /state`                           | 再接続・ページ再読込・観戦途中参加の基礎 |

Phase 0 の目的は「簡易ゲームを作ること」ではなく、**将来の Gomoku.com 風サービスでも通用する通信の芯を、現行スキーマと現行ディレクトリ構成に沿って先に作ること** とする。
