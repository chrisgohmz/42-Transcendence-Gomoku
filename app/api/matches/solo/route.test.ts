import { beforeEach, describe, expect, mock, test } from "bun:test";

import { MatchStatus, MatchVisibility, Role, RuleType, Seat } from "@/../generated/prisma/enums";
import { soloAiDisplayName } from "@/lib/matches/ai-solo";

const getCurrentSession = mock();
const transaction = mock();
const createMatch = mock();
const updateMatch = mock();
const createMove = mock();
const publishGameUpdate = mock();
const publishChallengeReceived = mock();
const chooseAiMove = mock();

const tx = {
  match: {
    create: createMatch,
    update: updateMatch,
  },
  matchMove: {
    create: createMove,
  },
};

await mock.module("@/lib/auth", () => ({
  getCurrentSession,
}));

await mock.module("@/lib/prisma", () => ({
  prisma: {
    $transaction: transaction,
  },
}));

await mock.module("@/lib/matches/realtime-publisher", () => ({
  publishChallengeReceived,
  publishGameUpdate,
}));

await mock.module("@/lib/matches/ai-engine", () => ({
  chooseAiMove,
}));

const route = await import("./route");

const createdAt = new Date("2026-05-16T00:00:00.000Z");
const startedAt = new Date("2026-05-16T00:01:00.000Z");

function request(body: unknown) {
  return new Request("http://localhost/api/matches/solo", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function participant({
  displayNameSnapshot,
  id,
  seat,
  userId,
}: {
  displayNameSnapshot: string;
  id: string;
  seat: Seat;
  userId: string | null;
}) {
  return {
    displayNameSnapshot,
    id,
    joinedAt: startedAt,
    leftAt: null,
    matchId: "solo-match",
    result: null,
    role: Role.PLAYER,
    seat,
    userId,
  };
}

function participants(playerSeat: Seat) {
  const aiSeat = playerSeat === Seat.BLACK ? Seat.WHITE : Seat.BLACK;

  return [
    participant({
      displayNameSnapshot: "Human",
      id: "human-player",
      seat: playerSeat,
      userId: "human-user",
    }),
    participant({
      displayNameSnapshot: soloAiDisplayName,
      id: "ai-player",
      seat: aiSeat,
      userId: null,
    }),
  ];
}

function matchRecord({
  difficulty = "expert",
  moves = [],
  nextTurnSeat = Seat.BLACK,
  playerSeat = Seat.BLACK,
  stateVersion = 0,
}: {
  difficulty?: string;
  moves?: unknown[];
  nextTurnSeat?: Seat | null;
  playerSeat?: Seat;
  stateVersion?: number;
} = {}) {
  return {
    boardSize: 15,
    createdAt,
    createdByUserId: "human-user",
    endReason: null,
    finishedAt: null,
    id: "solo-match",
    metadata: {
      aiDifficulty: difficulty,
      mode: "ai",
    },
    moves,
    nextTurnSeat,
    participants: participants(playerSeat),
    ruleType: RuleType.GOMOKU,
    startedAt,
    stateVersion,
    status: MatchStatus.IN_PROGRESS,
    updatedAt: createdAt,
    visibility: MatchVisibility.PRIVATE,
    winningSeat: null,
  };
}

function move(
  participantId: string,
  moveNumber: number,
  x: number,
  y: number,
  stateVersion: number,
) {
  return {
    baseVersion: stateVersion - 1,
    createdAt,
    id: `move-${moveNumber}`,
    matchId: "solo-match",
    moveNumber,
    participantId,
    requestId: null,
    stateVersion,
    x,
    y,
  };
}

beforeEach(() => {
  getCurrentSession.mockReset();
  transaction.mockReset();
  createMatch.mockReset();
  updateMatch.mockReset();
  createMove.mockReset();
  publishGameUpdate.mockReset();
  chooseAiMove.mockReset();

  getCurrentSession.mockResolvedValue({
    user: {
      displayName: "Human",
      id: "human-user",
      username: "human",
    },
  });
  transaction.mockImplementation((callback: (transactionClient: typeof tx) => unknown) =>
    callback(tx),
  );
  publishGameUpdate.mockResolvedValue(undefined);
  chooseAiMove.mockReturnValue({
    position: { x: 7, y: 7 },
    reason: "claims the center",
    score: 120,
  });
});

describe("POST /api/matches/solo", () => {
  test("requires authentication before creating a solo match", async () => {
    getCurrentSession.mockResolvedValueOnce(null);

    const response = await route.POST(request({ difficulty: "expert", playerSeat: Seat.BLACK }));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toMatchObject({ error: "unauthorized" });
    expect(transaction).not.toHaveBeenCalled();
  });

  test("creates a solo match with structured AI metadata", async () => {
    createMatch.mockResolvedValueOnce(matchRecord({ difficulty: "master" }));

    const response = await route.POST(request({ difficulty: "master", playerSeat: Seat.BLACK }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      difficulty: "master",
      matchId: "solo-match",
      participantId: "human-player",
      seat: Seat.BLACK,
      stateVersion: 0,
    });
    expect(createMatch.mock.calls[0]?.[0]).toMatchObject({
      data: {
        metadata: {
          aiDifficulty: "master",
          mode: "ai",
        },
        participants: {
          create: [
            expect.objectContaining({ seat: Seat.BLACK, userId: "human-user" }),
            expect.objectContaining({
              displayNameSnapshot: soloAiDisplayName,
              seat: Seat.WHITE,
              userId: null,
            }),
          ],
        },
      },
    });
    expect(publishGameUpdate.mock.calls[0]?.[0]).toMatchObject({
      aiDifficulty: "master",
      matchId: "solo-match",
      mode: "ai",
    });
    expect(chooseAiMove).not.toHaveBeenCalled();
  });

  test("plays and publishes an opening move when the AI has black", async () => {
    const createdMatch = matchRecord({
      difficulty: "beginner",
      playerSeat: Seat.WHITE,
    });
    const updatedMatch = {
      ...createdMatch,
      nextTurnSeat: Seat.WHITE,
      stateVersion: 1,
    };
    const createdMove = move("ai-player", 1, 7, 7, 1);

    createMatch.mockResolvedValueOnce(createdMatch);
    updateMatch.mockResolvedValueOnce(updatedMatch);
    createMove.mockResolvedValueOnce(createdMove);

    const response = await route.POST(request({ difficulty: "beginner", playerSeat: Seat.WHITE }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      aiOpening: {
        position: { x: 7, y: 7 },
        reason: "claims the center",
      },
      difficulty: "beginner",
      seat: Seat.WHITE,
      stateVersion: 1,
    });
    expect(chooseAiMove.mock.calls[0]?.[0]).toMatchObject({
      aiParticipantId: "ai-player",
      difficultyId: "beginner",
      moves: [],
    });
    expect(createMove).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchId: "solo-match",
        moveNumber: 1,
        participantId: "ai-player",
        requestId: "ai-opening:solo-match",
        stateVersion: 1,
        x: 7,
        y: 7,
      }),
    });
    expect(publishGameUpdate.mock.calls[0]?.[0]).toMatchObject({
      aiDifficulty: "beginner",
      lastMove: {
        moveNumber: 1,
        participantId: "ai-player",
      },
      mode: "ai",
      stateVersion: 1,
    });
  });
});
