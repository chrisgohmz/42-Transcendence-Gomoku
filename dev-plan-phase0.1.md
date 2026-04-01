# 開発方針メモ：Phase 0 通信基盤確認

## 背景と目的

現状のリポジトリは frontend / backend / PostgreSQL の Docker 構成と、Next.js + Socket.IO + Prisma の疎通確認まで完了している。ゲーム盤面・ルール判定・マッチング・認証・履歴・ランキングはまだ未実装。

MVP は「まずオンライン五目並べを成立させる」ことに切る方針。その前段として、4 種類の通信パターンを **最終的に本番コードとして使える部品** として実装しながら確認する。

UI や DB は五目並べの完全な実装でなくてよい。**1x5 の簡易ボード**を使って通信の責務分離を確認することを優先する。

---

## 用語整理

### サーバー権威（Server Authority）とは

「ゲームの正しい状態はサーバーだけが持つ」という設計方針。Authentication（認証・ログイン）とは別の概念。

| 用語                       | 意味                             | 役割                           |
| -------------------------- | -------------------------------- | ------------------------------ |
| **サーバー権威**           | ゲームの状態判定をサーバーが行う | 不正着手の防止・全員の盤面一致 |
| **Authentication（認証）** | 「あなたは誰か」を確認する       | ログイン・セッション管理       |

#### サーバー権威がない場合の問題

- 自分の番でないのに連続で石を置ける
- 既に埋まったマスに石を置ける
- ブラウザ上で勝利判定を偽造できる
- 2 人の盤面がズレたまま対局が進む

#### Phase 0 におけるサーバー権威の実現ポイント

- 着手の合法判定は **バックエンドのロジック**が行う
- 判定が OK のときだけ **DB に保存**する
- DB 保存が確定してから初めてクライアントに結果を届ける
- クライアントは REST レスポンスや WebSocket push を受け取るまで盤面を更新しない

---

## 4 種類の通信パターンと位置づけ

計画書の 4 種類はフロント視点、今回の実装は全体フロー視点で整理する。両者を対応させると以下になる。

| フロント視点の通信パターン         | Phase 0 での対応実装                                     |
| ---------------------------------- | -------------------------------------------------------- |
| ① ブラウザ完結                     | プレイヤー名入力・1x5 盤面表示・クリック操作             |
| ② クリック → サーバー → レスポンス | 着手を REST で送信・バックエンドが合法判定後に応答       |
| ③ フェッチ → レンダリング          | GET /rooms で待機中ルーム一覧を取得して表示              |
| ④ サーバープッシュ                 | 着手確定後、相手プレイヤーへ WebSocket で位置情報を push |

---

## 全体フロー

```
プレイヤー１: 名前入力 → POST /rooms でルーム作成
プレイヤー２: 名前入力 → GET /rooms で一覧表示 → POST /rooms/:id/join で参加
両者: WebSocket で room を購読

着手時:
  プレイヤー１がマスをクリック
    → POST /rooms/:id/moves（REST）
    → バックエンドが合法手を判定（置けるか・自分の番か）
    → OK ならバックエンドが DB に着手を保存（← ここがサーバー権威）
    → プレイヤー１には REST レスポンスで結果を返す
    → プレイヤー２には WebSocket push で石の位置情報を送る
    → 両者のブラウザがそれぞれ盤面を更新
```

---

## シーケンス図

```
Player1       Frontend1      Backend         DB         Frontend2 (Player2)
  |               |              |             |               |
  | 名前入力      |              |             |               |
  |--クリック---->|              |             |               |
  |               |-POST /rooms->|             |               |
  |               |              |--INSERT room->              |
  |               |<-{ roomId }--|             |               |
  |               |              |             |               |
  |         (Player2 が GET /rooms で一覧取得・参加)            |
  |               |              |<-POST /rooms/:id/join-------|
  |               |              |-------------------応答----->|
  |               |              |             |               |
  |         (両者が WebSocket で room を購読)                   |
  |               |-WS: room:join>|             |               |
  |               |              |<------WS: room:join---------|
  |               |              |             |               |
  | マスをクリック|              |             |               |
  |--クリック---->|              |             |               |
  |               |-POST /moves->|             |               |
  |               |              |-合法手判定  |               |
  |               |              |-INSERT move->               |
  |               |              |<------------|               |
  |               |<-{ ok,state}-|             |               |
  |               |              |--WS push: game:update------>|
  | 盤面更新      |              |             | 盤面更新      |
```

---

## API 一覧

### REST

| メソッド | パス                   | 説明                                                   |
| -------- | ---------------------- | ------------------------------------------------------ |
| `POST`   | `/api/rooms`           | ルームを作成する。プレイヤー名を受け取り roomId を返す |
| `GET`    | `/api/rooms`           | 待機中のルーム一覧を返す                               |
| `POST`   | `/api/rooms/:id/join`  | 指定ルームに参加する。プレイヤー名を受け取る           |
| `POST`   | `/api/rooms/:id/moves` | 着手を送信する。マス番号とプレイヤー情報を受け取る     |
| `GET`    | `/api/rooms/:id/state` | ルームの現在状態を返す（再接続時などに使用）           |

#### 着手 API の入出力

```typescript
// POST /api/rooms/:id/moves

// Request
{ playerName: string, position: number }  // position: 0〜4（1x5 ボードのインデックス）

// Response（成功）
{ ok: true, state: { board: Cell[], nextTurn: string } }

// Response（失敗）
{ ok: false, reason: 'occupied' | 'not_your_turn' | 'invalid_position' }
```

### WebSocket イベント

| 方向            | イベント名         | 内容                         |
| --------------- | ------------------ | ---------------------------- |
| Client → Server | `room:join`        | ルーム購読開始               |
| Server → Client | `game:update`      | 盤面の最新状態（全員に配信） |
| Server → Client | `game:invalidMove` | 不正着手の通知（本人のみ）   |

---

## DB テーブル設計

```prisma
model Room {
  id        String    @id @default(cuid())
  status    String    @default("waiting")  // waiting | playing | finished
  createdAt DateTime  @default(now())
  players   Player[]
  moves     Move[]
}

model Player {
  id        String   @id @default(cuid())
  name      String
  color     String   // "black" | "white"
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id])
}

model Move {
  id         String   @id @default(cuid())
  roomId     String
  room       Room     @relation(fields: [roomId], references: [id])
  playerName String
  position   Int      // 0〜4
  createdAt  DateTime @default(now())
}
```

---

## ファイル構成

### フロントエンド

```
apps/frontend/src/
  components/
    NameInput.tsx        ← プレイヤー名入力フォーム
    RoomList.tsx         ← GET /rooms で取得した一覧を表示
    MiniBoard.tsx        ← 1x5 のマス表示・クリックで着手送信
  hooks/
    useRoom.ts           ← ルーム作成・参加の REST 呼び出し
    useSocketGame.ts     ← WebSocket 購読・game:update 受信
  app/
    proto/
      page.tsx           ← 上記を組み合わせた検証ページ
```

### バックエンド

```
apps/backend/src/
  rooms/
    roomStore.ts         ← Prisma でルーム状態管理
  game/
    moveValidator.ts     ← 合法手判定ロジック（占有チェック・手番チェック）
  app/
    api/
      rooms/
        route.ts         ← GET, POST /api/rooms
        [id]/
          join/route.ts  ← POST /api/rooms/:id/join
          moves/route.ts ← POST /api/rooms/:id/moves
          state/route.ts ← GET /api/rooms/:id/state
  socket/
    gameHandler.ts       ← room:join 受付・game:update 配信
```

---

## 実装順序

```
Step 1: DB テーブル作成（Prisma migrate）
          ↓
Step 2: REST API（rooms の CRUD）と合法手判定ロジック
          ↓
Step 3: フロント NameInput + RoomList
          └─ ③「フェッチ → レンダリング」の確認
          ↓
Step 4: バックエンドの着手 API（判定 → DB 保存 → レスポンス）
          └─ ②「クリック → REST → DB → レスポンス」の確認
          ↓
Step 5: フロント MiniBoard + useSocketGame
          └─ ①「ブラウザ完結の操作」+ ④「WebSocket push」の確認
          ↓
Step 6: 2 タブで動作確認
          └─ 両者の盤面が同期されることを確認
```

Step 6 が通った時点で 4 種類の通信パターンがすべて実証され、Phase 1「対局基盤」の骨格が完成する。

---

## Phase 0 完了条件

- プレイヤー 1 が名前を入力してルームを作成できる
- プレイヤー 2 がルーム一覧を取得して参加できる
- 両者が交互にマスをクリックして着手できる
- 着手はバックエンドの合法手判定 → DB 保存を経由して確定する（サーバー権威）
- 本人には REST レスポンス、相手には WebSocket push で盤面が更新される
- Docker Compose でローカル起動できる

---

## Phase 0 → Phase 1 への移行方針

Phase 0 で作った部品は以下のように Phase 1 に引き継ぐ。

| Phase 0 の部品           | Phase 1 での用途                   |
| ------------------------ | ---------------------------------- |
| `MiniBoard.tsx`          | `Board.tsx`（15x15）に置き換え     |
| `moveValidator.ts`       | 五目並べの合法手・勝敗判定に拡張   |
| `Room` / `Move` テーブル | `GameRoom` / `Move` テーブルに拡張 |
| `useSocketGame.ts`       | そのまま継続使用                   |
| REST API のルーム管理    | ロビー画面・マッチング機能に拡張   |

---

## Phase 1 以降の検討項目

### gRPC による合法手判定サービスの分離

Phase 0 では合法手判定をバックエンド内のロジックとして実装する。Phase 1 以降では、この判定ロジックを gRPC サービスとして独立させることを検討する。

#### 分離する動機

- 連珠の禁じ手判定など、ルールごとに判定ロジックが複雑化する
- バックエンドと独立してテスト・デプロイできるようにする
- 将来的に Go や Rust など別言語で高速実装する余地を作る

#### proto 定義（案）

```proto
syntax = "proto3";

service MoveChecker {
  rpc CanPlace (CanPlaceRequest) returns (CanPlaceResponse);
}

message CanPlaceRequest {
  repeated string board = 1;  // 現在の盤面状態（"black" | "white" | ""）
  int32 position = 2;         // 置こうとしているマス番号
  string color = 3;           // "black" | "white"
  string rule = 4;            // "gomoku" | "renju"
}

message CanPlaceResponse {
  bool ok = 1;
  string reason = 2;          // 失敗時: "occupied" | "not_your_turn" | "forbidden_move"
}
```

#### Docker Compose への追加（案）

```yaml
grpc:
  build:
    context: ./apps/grpc
  ports:
    - "50051:50051"
  networks:
    - transcendence
```

#### ファイル構成（案）

```
apps/grpc/
  proto/
    move_checker.proto      ← proto 定義
  src/
    server.ts               ← gRPC サーバー本体
    moveChecker.ts          ← CanPlace の実装（gomoku / renju 両対応）

apps/backend/src/
  grpc/
    moveCheckerClient.ts    ← バックエンドから gRPC サービスへの呼び出し
```
