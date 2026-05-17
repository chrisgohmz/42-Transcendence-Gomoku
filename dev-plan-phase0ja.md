# 開発方針メモ：Phase 0.5 通信基盤確認

## 背景と目的

現状のリポジトリは `app / realtime / caddy / PostgreSQL` を中心にした Docker 構成と、Next.js + Socket.IO + Prisma の通信基盤に加えて、認証、15x15 盤面、合法手判定、終局処理、AI ソロ、マッチメイキング、履歴 API、リーダーボード read model まで実装が進んでいる。プロフィール本人ページの統計・履歴表示、リーダーボードの完全な実データ化、対局完了後の統計/進捗更新は Issue #36 の対象として残っている。<!-- updated: 実装済みの認証・ルール判定・履歴 API・ランキング read model と、Issue #36 で残る範囲に合わせたため -->

また、実装ディレクトリも `apps/frontend` / `apps/backend` 分離ではなく、Next.js 側の本体を `app/`、Socket.IO 側の入口を `realtime/`、公開導線を `infra/caddy/` に置く形へ移行している。

一方で、`prisma/schema.prisma` には、対局の最小構成を超えて以下まで先に入っている。

- `User / OAuthAccount / UserSession` による認証基盤
- `Friendship` によるソーシャル基盤
- `Conversation / ConversationParticipant / DirectMessage` によるチャット基盤
- `Match / MatchParticipant / MatchMove / UserGameStats / AchievementDefinition / UserAchievement` による対局・統計・進捗基盤<!-- updated: 現行 Prisma スキーマには実績定義とユーザー実績も存在するため -->

MVP は引き続き「まずオンライン五目並べを成立させる」ことに切る。ただし Phase 0.5 では、現在の Prisma スキーマと現行ディレクトリ構成に合わせて、**後でそのまま育てられる本番寄りの部品** として実装方針を整理し直す。

- サーバー権威のゲーム状態管理
- REST と WebSocket の責務分離
- DB 永続化を伴う着手確定
- `Match / MatchParticipant / MatchMove` を `User / Conversation` に接続可能なまま使う
- 再接続や拡張に耐える API 契約

UI は簡略化してよいが、API やデータ構造は最初から将来拡張しやすい形に寄せる。現行 UI は **15x15 の Gomoku 盤面** を前提にしており、座標表現は `{ x, y }` を使う。<!-- updated: 現行実装は 1x5 プロトタイプではなく 15x15 盤面を使っているため -->

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
- 内部識別: `participantId`。API 上の `participantId` は `MatchParticipant.id` の別名として扱う
- 認証連携: `userId`。ログイン済みなら `MatchParticipant.userId` と `Match.createdByUserId` に接続する
- 役割: `role` (`PLAYER` / `SPECTATOR`)
- 席情報: `seat` (`BLACK` / `WHITE` / `null`)

Phase 0 ではプレイヤー 2 人対戦だけを対象にするため、通常は `role = PLAYER`、`seat != null` の参加者だけを扱う。ただしスキーマは観戦や認証統合まで見越しているため、文書上も `MatchParticipant` 前提で揃える。

#### Phase 0 における `participantId` の保持方針

`participantId` は、マッチ作成または参加の成功時に API サーバーが返す `MatchParticipant.id` を指す。フロントエンドはこれを **`sessionStorage`** に保持する。

- 対象: `matchId`, `participantId`, `role`, `seat`, `displayName`
- アクティブセッションのポインタ: `match:session:v1:active` に現在の `matchId` を保持する。旧 `proto:matchSession:v1:*` は読み取り互換だけ残す<!-- updated: 現行の match-session-storage.ts は match:session:v1:* を正規キーにしているため -->
- 理由: タブ内リロードには耐えたいが、永続ログインの責務までは持たせないため
- スコープ: 同一タブの一時セッション

保存イメージ:

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

Phase 0 では以下の扱いとする。

- `sessionStorage` に情報があれば、その `participantId` で再接続する
- 情報がなければ、リロード後は再参加または新規作成とする
- `userId` や認証セッションとの統合は Phase 1 以降で扱う

### 4. UI は簡略、契約は汎用

Phase 0 の初期計画では 1x5 の簡易 UI を想定していたが、現行実装は 15x15 の盤面を使う。連珠・観戦・再接続に備え、以下は引き続き汎用形にする。<!-- updated: 現行 UI と state builder が 15x15 boardSize を前提に動いているため -->

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
     - participantId が match 内の有効な MatchParticipant か
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

| メソッド | パス                       | 説明                                          |
| -------- | -------------------------- | --------------------------------------------- |
| `POST`   | `/api/matches`             | 認証済みユーザーで公開 human match を作成する |
| `GET`    | `/api/matches`             | 参加可能な `WAITING` match 一覧を返す         |
| `POST`   | `/api/matches/:id/join`    | 指定 match に白番として参加する               |
| `POST`   | `/api/matches/:id/moves`   | 着手コマンドを送信する                        |
| `POST`   | `/api/matches/:id/resign`  | 投了して終局状態を確定する                    |
| `GET`    | `/api/matches/:id/state`   | 現在状態を返す。再接続や初期同期に使う        |
| `POST`   | `/api/matches/solo`        | AI ソロ match を作成する                      |
| `POST`   | `/api/matches/:id/ai-turn` | AI ソロ match の AI 着手を確定する            |
| `GET`    | `/api/matches/queue`       | matchmaking queue の現在状態を返す            |
| `POST`   | `/api/matches/queue`       | matchmaking queue に参加する                  |
| `DELETE` | `/api/matches/queue`       | matchmaking queue から退出する                |
| `GET`    | `/api/matches/history`     | 認証済みユーザーの終局済み対戦履歴を返す      |

<!-- updated: 現行 Route Handler に solo / ai-turn / resign / queue / history が追加済みのため -->

### マッチ作成 API

```ts
// POST /api/matches

// Request
// 現行実装では body は不要。ログイン中ユーザーの displayName / username を使う。
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

作成時にバックエンドは以下を行う。

- `Match` を 1 件作成する
- 作成者用の `MatchParticipant` を `role = PLAYER`, `seat = BLACK` で 1 件作成する
- `Match.createdByUserId` と `MatchParticipant.userId` はログイン中ユーザーで埋める
- `displayNameSnapshot` は `context.user.displayName || context.user.username` を保存する
- `boardSize` は `standardGomokuBoardSize`、現行では 15 を使う
- `winningSeat`, `endReason`, `startedAt`, `finishedAt` は `null` のまま始める
- 作成後、初期 `game:update` を内部通知で realtime に publish する<!-- updated: 現行 create match は認証必須・15x15・ユーザー名保存・初期 game:update publish まで実装しているため -->

### マッチ参加 API

```ts
// POST /api/matches/:id/join

// Request
{
  displayName?: string // 未指定ならログイン中ユーザーの displayName / username
}

// Response
{
  matchId: string,
  participantId: string, // MatchParticipant.id
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
  participantId: string,
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

<!-- updated: 現行 Route Handler は ok:false/reason ではなく error フィールドで返すため -->

`baseVersion` は「クライアントがどの状態を見て着手したか」を示す。現行スキーマでは `MatchMove.baseVersion` が nullable で用意済みなので、Phase 0.5 では「今は任意、ただし送れるなら送る」に寄せる。

`requestId` は、フロントエンドが着手のたびに生成する **冪等キー兼レスポンス照合キー** として扱う。

- フロントは送信前に `requestId` を生成する
- サーバーは `MatchMove.requestId` に保存し、レスポンスにも同じ値をそのまま返す
- 再送時に同じ `requestId` が来た場合は、二重着手を防ぎつつ「どの操作に対する応答か」をフロントが対応付けられるようにする
- 一意性は `MatchMove` の `@@unique([matchId, requestId])` を使って担保する

また、`occupied` はアプリ層で事前判定するだけでなく、`MatchMove` の `@@unique([matchId, x, y])` でも守られる想定にする。

### 状態取得 API

```ts
// GET /api/matches/:id/state?participantId=<MatchParticipant.id>

{
  matchId: string,
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED",
  visibility: "PUBLIC" | "PRIVATE",
  // ruleType は DB と履歴 API には存在するが、現行 GET /state response にはまだ含めていない
  boardSize: number,
  stateVersion: number,
  nextTurnSeat: "BLACK" | "WHITE" | null,
  winningSeat: "BLACK" | "WHITE" | null,
  endReason: string | null,
  participants: Array<{
    participantId: string,
    displayName: string, // MatchParticipant.displayNameSnapshot を返す
    role: "PLAYER" | "SPECTATOR",
    seat: "BLACK" | "WHITE" | null,
    joinedAt: string,
    leftAt: string | null
  }>,
  moves: Array<{
    moveNumber: number,
    participantId: string, // MatchMove.participantId の API 表現
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

| 方向            | イベント名                                       | 内容                                                              |
| --------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| Client → Server | `match:subscribe`                                | match の購読開始                                                  |
| Server → Client | `match:subscribed`                               | 購読完了通知                                                      |
| Server → Client | `game:update`                                    | 確定済みの最新ゲーム状態を match 全員へ配信                       |
| Server → Client | `match:error`                                    | 購読失敗や不正 payload のエラー                                   |
| Client → Server | `queue:join` / `queue:leave`                     | matchmaking queue の参加/退出                                     |
| Server → Client | `queue:status` / `queue:matched` / `queue:error` | queue 状態と成立通知                                              |
| Server → Client | `match:closed`                                   | 計画上のイベント。現行実装では終局も最終 `game:update` で表現する |

<!-- updated: 現行 realtime handlers には match:error と queue 系イベントがあり、match:closed は未実装のため -->

これらのイベントはブラウザからは `https://localhost:8443/socket.io/*` に接続して使う。`caddy` が `realtime:3001` へ転送する。

### `game:update` の例

```ts
{
  matchId: string,
  status: "WAITING" | "IN_PROGRESS" | "FINISHED" | "CANCELLED",
  visibility: "PUBLIC" | "PRIVATE",
  // ruleType は shared/match-events.ts でコメントアウトされており、現行 game:update には含めていない
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

<!-- updated: 現行 shared/match-events.ts の GameUpdatePayload は ruleType を含めず、lastMove.requestId と moves を含むため -->

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
  id                  String       @id @default(cuid(2)) // 現行 API の participantId
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

<!-- updated: 現行 Match.metadata と、Issue #36 で使う統計・実績テーブルを抜粋に追加したため -->

Phase 0 の初期 UI は 1x5 想定だったが、現行 DB と UI は 15x15 まで使っている。DB は以下を持っているため観戦や履歴再生にも伸ばせる。<!-- updated: 現行 UI が 15x15 に進んでいるため -->

- `x / y`
- `stateVersion`
- `baseVersion`
- `role`
- `seat`
- `winningSeat`
- `endReason`

---

## ファイル構成メモ

### 現在確認できる Prisma / DB 関連ファイル

```text
prisma/
  schema.prisma               ← 現行スキーマ本体
  seed.ts                     ← seed users / match / stats / achievements
  migrations/                 ← 認証・対局・統計 index・metadata などの migration
generated/
  prisma/                     ← schema.prisma から生成された client
app/
  lib/
    prisma.ts                 ← Prisma client 利用起点
```

<!-- updated: 現行には seed.ts と複数 migration、UserGameStats 用 index migration が存在するため -->

### 現在確認できる対局・リアルタイム関連ファイル

```text
app/
  [locale]/
    home/page.tsx             ← ホームダッシュボード
    human/page.tsx            ← human lobby
    game/page.tsx             ← AI / game 入口
    leaderboard/page.tsx      ← leaderboard ページ
    profile/page.tsx          ← 自分のプロフィールページ
    profile/[username]/page.tsx ← 公開プロフィールページ
  api/
    health/route.ts
    matches/
      route.ts                ← GET, POST /api/matches
      history/route.ts        ← GET /api/matches/history
      queue/route.ts          ← GET, POST, DELETE /api/matches/queue
      solo/route.ts           ← POST /api/matches/solo
      [id]/
        join/route.ts         ← POST /api/matches/:id/join
        moves/route.ts        ← POST /api/matches/:id/moves
        resign/route.ts       ← POST /api/matches/:id/resign
        state/route.ts        ← GET /api/matches/:id/state
        ai-turn/route.ts      ← POST /api/matches/:id/ai-turn
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
    useHumanLobby.ts          ← human match 作成/参加/一覧取得
    useMatchInitialize.ts     ← sessionStorage + GET state 初期同期
    useSocketGame.ts          ← match:subscribe + game:update 受信
  lib/
    leaderboard.ts            ← UserGameStats から leaderboard entries を作る
    game/state-builder.ts     ← MatchMove から board を組み立てる
    matches/
      ai-engine.ts
      ai-solo.ts
      game-update.ts          ← game:update payload 生成
      match-history.ts        ← 終局済み match の履歴 read model
      matchmaking.ts          ← queue / stale cleanup
      move-request-validation.ts
      move-rules.ts           ← 合法手・五目・draw・resign 判定
      participant-access.ts
      realtime-publisher.ts   ← app から realtime への内部通知
      submit-move.ts          ← client side move submit helper
      match-session-storage.ts
shared/
  ai-difficulty.ts
  match-events.ts             ← app / realtime / frontend 共有 payload 型
  match-events-validation.ts  ← realtime 内部通知・購読 payload の runtime validation
  realtime-internal.ts        ← internal endpoint secret / payload helper
realtime/
  server.ts                   ← Socket.IO / internal endpoint の入口
  handlers/
    match-subscription.ts     ← match:subscribe / match:subscribed / 初期 game:update
    matchmaking-queue.ts      ← queue:join / queue:leave
  lib/
    internal-game-update.ts   ← /internal/game-update で room に game:update 配信
    internal-friendship-update.ts
    presence.ts
    rooms.ts
    socket-auth.ts
infra/
  caddy/
    Caddyfile                 ← `/socket.io/*` を realtime、それ以外を app に振り分け
```

<!-- updated: app/proto と components/proto は現存せず、locale 配下の画面・matches API・hooks・shared・realtime handlers が増えているため -->

### Issue #36 で追加・更新する候補配置

```text
app/
  api/
    profile/
      stats/route.ts          ← 自分の統計・進捗・rank summary を返す REST API
    leaderboard/route.ts      ← leaderboard entries と自分の順位を返す REST API
  components/
    profile-stats-panel.tsx   ← 自分の統計カード・level/progress 表示
    match-history-list.tsx    ← 対戦相手・日時・結果の履歴表示
    progression-summary.tsx   ← 実績/進捗の軽量表示
  hooks/
    useProfileStats.ts        ← REST で profile stats を取得し、必要なら realtime refresh で再取得
    useLeaderboard.ts         ← REST で leaderboard を取得する
  lib/
    stats/
      profile-stats.ts        ← Match / MatchParticipant / UserGameStats から profile read model を作る
      progression.ts          ← level / progress / achievement signal の派生ロジック
      result-sync.ts          ← 終局済み match から UserGameStats / UserAchievement を更新する
realtime/
  lib/
    internal-stats-update.ts  ← 必要なら user room へ stats:refresh を配信
shared/
  stats-events.ts             ← stats refresh payload 型を追加する場合の共有型
```

<!-- updated: Issue #36 の追加先を現行の app/api・hooks・lib・realtime 構成に合わせたため -->

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

現行実装では Slice 0〜10 は完了扱いに更新する。購読は `realtime`、状態確定は `app`、その間の橋渡しは内部通知という分担で実装済み。加えて AI ソロ、matchmaking queue、match history API、leaderboard read model、公開プロフィールの集計表示が追加されている。Issue #36 はこの上に Slice 11 以降として、統計/進捗更新・本人プロフィール履歴・leaderboard 実データ化を積む。<!-- updated: 実ファイル確認により Slice 3〜10 相当と追加機能が実装済みだったため -->

```text
Slice 0: create_match の最小疎通（完了）
  - 目的: 認証済みユーザーが BLACK 参加者として match を作成できる
  - Files: app/api/matches/route.ts, app/hooks/useHumanLobby.ts
  - Implement: Match / MatchParticipant を作成し、初期 game:update を publish
  - Confirm: POST /api/matches が matchId / participantId / stateVersion を返す

Slice 1: list_matches を追加（完了）
  - 目的: 参加可能な WAITING match を一覧できる
  - Files: app/api/matches/route.ts, app/hooks/useHumanLobby.ts, app/components/game-lobby-table.tsx
  - Implement: status=WAITING の match と参加者 snapshot を返す
  - Confirm: 作成済み match が human lobby に表示される

Slice 2: join_match を追加（完了）
  - 目的: 2 人目が WHITE として参加し、対局を開始できる
  - Files: app/api/matches/[id]/join/route.ts, app/hooks/useHumanLobby.ts
  - Implement: MatchParticipant を追加し、IN_PROGRESS / nextTurnSeat=BLACK / startedAt / stateVersion を更新
  - Confirm: Join 後に 2 人の参加者と IN_PROGRESS 状態が見える

Slice 3: subscribe_match を追加（完了）
  - 目的: Socket.IO で match room を購読し、現行状態を受け取れる
  - Files: realtime/handlers/match-subscription.ts, app/hooks/useSocketGame.ts, shared/match-events.ts
  - Implement: match:subscribe / match:subscribed / 初期 game:update を実装
  - Confirm: 購読後に subscribed と full-state game:update が届く

Slice 4: submit_move の最小版（完了）
  - 目的: REST で着手を保存し、確定状態を realtime 配信できる
  - Files: app/api/matches/[id]/moves/route.ts, app/lib/matches/realtime-publisher.ts, realtime/lib/internal-game-update.ts
  - Implement: MatchMove を保存し、/internal/game-update 経由で room に game:update を送る
  - Confirm: 着手後に本人と相手の両方へ game:update が届く

Slice 5: not_your_turn を追加（完了）
  - 目的: サーバー権威で手番外の着手を拒否する
  - Files: app/lib/matches/move-rules.ts, app/api/matches/[id]/moves/route.ts
  - Implement: participant seat と Match.nextTurnSeat を照合する
  - Confirm: 間違った人の着手が 409 not_your_turn になる

Slice 6: occupied を追加（完了）
  - 目的: 既に埋まったマスへの二重着手を拒否する
  - Files: app/lib/matches/move-rules.ts, app/api/matches/[id]/moves/route.ts, prisma/schema.prisma
  - Implement: アプリ層の占有チェックと @@unique([matchId, x, y]) で守る
  - Confirm: 同じ座標への着手が occupied になる

Slice 7: stateBuilder を追加（完了）
  - 目的: MatchMove から盤面全体を再構築して配信できる
  - Files: app/lib/game/state-builder.ts, app/lib/matches/game-update.ts, shared/match-events.ts
  - Implement: board / lastMove / moves を含む GameUpdatePayload を生成する
  - Confirm: 最後の一手だけでなく盤面全体が描画される

Slice 8: GET /state を追加（完了）
  - 目的: リロードや再接続時に REST で初期同期できる
  - Files: app/api/matches/[id]/state/route.ts, app/hooks/useMatchInitialize.ts, app/lib/matches/match-state.ts
  - Implement: participantId を検証し、board / participants / moves を返す
  - Confirm: sessionStorage の participantId でリロード後も同じ盤面へ戻る

Slice 9: stateVersion / baseVersion を有効活用する（完了）
  - 目的: 古い状態からの着手と多重送信を拒否できる
  - Files: app/lib/matches/move-rules.ts, app/api/matches/[id]/moves/route.ts, app/lib/matches/move-request-validation.ts
  - Implement: baseVersion の stale_state、requestId の duplicate_request、updateMany による guarded transition を使う
  - Confirm: 古い stateVersion からの着手が 409 stale_state になる

Slice 10: terminal state の入口を用意する（完了）
  - 目的: 勝敗・draw・投了・queue cancel/expire/abandon を終局状態として保存できる
  - Files: app/lib/matches/move-rules.ts, app/api/matches/[id]/moves/route.ts, app/api/matches/[id]/resign/route.ts, app/api/matches/[id]/ai-turn/route.ts, app/lib/matches/matchmaking.ts
  - Implement: FINISHED / CANCELLED、winningSeat、endReason、finishedAt、MatchParticipant.result を更新し、最終 game:update を配信する
  - Confirm: 五目成立、draw、resign、queue cancel が DB と game:update に反映される

Slice 11: result_stats_sync を追加
  - 目的: 終局済み match result から UserGameStats と実績 progress を自動更新する
  - Files:
    - app/lib/stats/result-sync.ts
    - app/lib/stats/progression.ts
    - app/lib/stats/result-sync.test.ts
    - app/lib/stats/progression.test.ts
  - Implement:
    - Prisma schema は変更しない。既存の UserGameStats / AchievementDefinition / UserAchievement を使う
    - Match.status が FINISHED / CANCELLED で、MatchParticipant.result が入った match を統計更新対象にする
    - userId がある PLAYER だけを対象に、ruleType + boardSize ごとに matchesPlayed / wins / losses / draws / botMatchesPlayed / botWins / streak / lastPlayedAt を再計算または idempotent upsert する
    - level / progress は rating、wins、matchesPlayed、achievement points から派生できる純粋関数として定義する
    - 初回勝利・連勝・AI 勝利など軽量な achievement progress を既存テーブルへ upsert する
  - Confirm: fixture の終局 match から統計を再計算し、同じ sync を 2 回呼んでも値が二重加算されない

Slice 12: terminal routes に stats sync を接続
  - 目的: 対局完了後に手動修正なしで統計・進捗が更新される
  - Files:
    - app/api/matches/[id]/moves/route.ts
    - app/api/matches/[id]/resign/route.ts
    - app/api/matches/[id]/ai-turn/route.ts
    - app/lib/matches/matchmaking.ts
    - app/api/matches/[id]/rules-routes.test.ts
    - app/api/matches/[id]/ai-turn/route.test.ts
    - app/lib/matches/matchmaking.test.ts
  - Implement:
    - FINISHED / CANCELLED と MatchParticipant.result を保存した直後に、影響を受ける human userId の stats sync を呼ぶ
    - realtime publish 失敗を着手成功扱いから切り離している既存方針と同様、stats sync の失敗はログに残し、DB 終局確定そのものは壊さない方針を明記する
    - queue cancel / expire / abandoned は matchesPlayed に含めるかどうかを統一し、leaderboard 対象からは除外できるようにする
  - Confirm: 勝利・敗北・投了・AI 戦終了後に UserGameStats.updatedAt と wins/losses/draws が更新される

Slice 13: profile stats REST API を追加
  - 目的: UI が REST で自分の統計・rank・level/progress・履歴概要を取得できる
  - Files:
    - app/api/profile/stats/route.ts
    - app/lib/stats/profile-stats.ts
    - app/lib/matches/match-history.ts
    - app/api/profile/stats/route.test.ts
  - Implement:
    - 認証済みユーザーの UserGameStats、UserAchievement、終局済み Match / MatchParticipant を読み、wins / losses / rating / rank / level / progress / recentMatches を返す
    - recentMatches は opponent displayName、finishedAt、result、endReason、moveCount を含める
    - rank は leaderboard と同じ sort rule で算出し、未ランクなら null を返す
    - 既存 GET /api/matches/history は棋譜詳細用として残し、profile stats API はプロフィール表示向けの軽量 summary にする
  - Confirm: ログイン済みで GET /api/profile/stats が統計カードと最近の対戦 20 件分の summary を返す

Slice 14: profile stats / match history view を接続
  - 目的: プレイヤーが UI から自分の統計と対戦履歴を確認できる
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
    - 現在の hard-coded rating / winRate / wins / losses / recentMatches / achievements を REST 取得データに置き換える
    - 対戦履歴ビューには対戦相手、日時、結果、endReason、手数を表示する
    - level/progress と軽量 achievement signals をプロフィール右カラムに表示する
    - empty / loading / error 状態を用意し、未対局ユーザーでも崩れない表示にする
  - Confirm: /profile で DB 由来の勝敗・ランキング・レベル進捗・最近の対戦が表示される

Slice 15: leaderboard REST read model を実データ化
  - 目的: DB に保存された対戦結果から leaderboard を算出できる
  - Files:
    - app/api/leaderboard/route.ts
    - app/lib/leaderboard.ts
    - app/lib/stats/result-sync.ts
    - app/lib/leaderboard.test.ts
    - app/api/leaderboard/route.test.ts
  - Implement:
    - leaderboard の authoritative source は終局済み Match / MatchParticipant.result とし、UserGameStats は result-sync 済みの materialized read model として扱う
    - rating desc、wins desc、losses asc の既存 sort rule を維持する
    - boardSize=15、ruleType=GOMOKU、bot-only 対象外など leaderboard 対象条件を明示する
    - 現在ユーザーの rank と entries top 100 を REST で返す
  - Confirm: 終局 match を追加して stats sync 後、GET /api/leaderboard の順位・勝敗・winRate が DB 結果に合わせて変わる

Slice 16: leaderboard page を live data 表示にする
  - 目的: Leaderboard ページで preview ではなく DB 由来の順位と進捗シグナルを確認できる
  - Files:
    - app/[locale]/leaderboard/page.tsx
    - app/components/leaderboardtable.tsx
    - app/hooks/useLeaderboard.ts
    - app/i18n/messages/en.ts
    - app/i18n/messages/ja.ts
    - app/i18n/messages/zh.ts
  - Implement:
    - previewEntries fallback と hard-coded Your Rank / Top Players / distribution を実データまたは empty state に置き換える
    - current user rank、rating、wins、losses、winRate、level/progress signal を表示する
    - データが空なら「まだランキング対象の対局がない」状態を表示し、seed preview は使わない
  - Confirm: /leaderboard が DB の UserGameStats / result-sync 内容だけで描画され、空 DB では preview 名が出ない

Slice 17: stats refresh realtime signal を追加
  - 目的: 対局完了直後にプロフィール/ランキング UI が REST 再取得のきっかけを受け取れる
  - Files:
    - shared/stats-events.ts
    - shared/realtime-internal.ts
    - app/lib/stats/realtime-publisher.ts
    - realtime/lib/internal-stats-update.ts
    - realtime/server.ts
    - realtime/lib/internal-stats-update.test.ts
  - Implement:
    - app は stats sync 成功後、影響 userId / username に対して internal stats update を realtime に送る
    - realtime は既存 user room パターンに乗せて `stats:refresh` を送る
    - payload は userId、reason、matchId、updatedAt 程度の軽量情報に留め、実データは REST で再取得する
  - Confirm: 終局後に該当ユーザーの Socket.IO client が stats:refresh を受け取る

Slice 18: profile / leaderboard の realtime refetch を接続
  - 目的: 画面を開いたままでも対局完了後に統計・進捗・順位が更新される
  - Files:
    - app/hooks/useProfileStats.ts
    - app/hooks/useLeaderboard.ts
    - app/components/profile-stats-panel.tsx
    - app/components/leaderboardtable.tsx
    - app/lib/socket-client.ts
  - Implement:
    - `stats:refresh` を受けたら GET /api/profile/stats と GET /api/leaderboard を再取得する
    - 受信対象ユーザー以外の payload は無視する
    - 連続イベントに備えて軽い debounce を入れる
  - Confirm: 対局終了後、/profile と /leaderboard の勝敗・rank/progress 表示が手動更新なしで変わる
```

<!-- updated: 実装済み Slice 0〜10 を現状に合わせ、Issue #36 の新規 Slice 11〜18 を既存粒度で追記したため -->

`move-rules.ts` と `state-builder.ts` は現行で実装済み。Issue #36 ではゲームルールではなく、終局結果から統計・履歴・ランキング・進捗 read model を更新する流れに集中する。<!-- updated: moveValidator 相当の実装が完了しているため -->

---

## Phase 0 完了条件

- プレイヤー1がマッチを作成できる
- プレイヤー2がマッチ一覧を見て参加できる
- `MatchParticipant.id` を `participantId` として保持し、再同期に使える
- 両者が同じ match を購読できる
- `https://localhost:8443` の単一 origin で REST と Socket.IO の両方に到達できる
- 着手は API サーバーの合法手判定と DB 保存を経由して確定する
- 不正手は REST エラーとして本人に返る
- 正式な盤面更新は realtime からの `game:update` で全員に配信される
- 着手した本人も相手も、同じイベントで盤面を更新する
- `GET /state` で再同期できる
- human match は認証済み userId を前提に成立し、AI 参加者のみ `userId = null` を許容する<!-- updated: 現行の match 作成/参加/購読 API は認証済みユーザーを必須にしているため -->
- Docker Compose で `app / realtime / caddy / database` をローカル起動できる

---

## Phase 0 → Phase 1 への移行方針

| Phase 0 の部品                         | Phase 1 での用途                                       |
| -------------------------------------- | ------------------------------------------------------ |
| `match-board.tsx` / `gomoku-board.tsx` | 観戦・棋譜再生・レビュー表示へ拡張                     |
| `move-rules.ts`                        | 連珠や追加終局理由へ拡張                               |
| `state-builder.ts`                     | 観戦・再接続・棋譜再生に流用                           |
| `Match / MatchParticipant / MatchMove` | 連珠・公開/非公開・観戦へ拡張                          |
| `role / userId`                        | 認証・観戦・フレンド導線へ接続                         |
| `stateVersion / baseVersion`           | 同時着手・再送・再接続対応の基礎                       |
| `winningSeat / endReason`              | 対局結果表示・履歴保存の基礎                           |
| `Conversation.matchId`                 | マッチチャットへ接続                                   |
| `UserGameStats / UserAchievement`      | Issue #36 で戦績・レーティング・ランキング・進捗へ接続 |
| `GET /state`                           | 再接続・ページ再読込・観戦途中参加の基礎               |

<!-- updated: MiniBoard / move-validator ではなく現行ファイル名に合わせ、UserGameStats / UserAchievement を Issue #36 の対象として明記したため -->

Phase 0 の目的は「簡易ゲームを作ること」ではなく、**将来の Gomoku.com 風サービスでも通用する通信の芯を、現行スキーマと現行ディレクトリ構成に沿って先に作ること** とする。
