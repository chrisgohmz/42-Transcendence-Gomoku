import { beforeEach, describe, expect, mock, test } from "bun:test";

const findUnique = mock();
const buildBoard = mock();

await mock.module("@/lib/prisma", () => ({
  prisma: {
    match: {
      findUnique,
    },
  },
}));

await mock.module("@/lib/game/state-builder", () => ({
  buildBoard,
}));

const route = await import("./route");

function request(participantId?: string) {
  const url = new URL("http://localhost/api/matches/match-1/state");
  if (participantId) {
    url.searchParams.set("participantId", participantId);
  }

  return new Request(url);
}

function context(matchId = "match-1") {
  return {
    params: Promise.resolve({ id: matchId }),
  };
}

function matchRecord() {
  return {
    id: "match-1",
    status: "IN_PROGRESS",
    visibility: "PUBLIC",
    boardSize: 2,
    stateVersion: 2,
    nextTurnSeat: "BLACK",
    winningSeat: null,
    endReason: null,
    createdByUserId: "user-creator",
    participants: [
      {
        id: "participant-black",
        userId: "user-black",
        displayNameSnapshot: "Black",
        role: "PLAYER",
        seat: "BLACK",
        joinedAt: new Date("2026-05-07T00:00:00.000Z"),
        leftAt: null,
      },
      {
        id: "participant-white",
        userId: "user-white",
        displayNameSnapshot: "White",
        role: "PLAYER",
        seat: "WHITE",
        joinedAt: new Date("2026-05-07T00:00:01.000Z"),
        leftAt: null,
      },
    ],
    moves: [
      {
        moveNumber: 1,
        participantId: "participant-black",
        x: 0,
        y: 0,
        requestId: "request-1",
        baseVersion: 0,
        stateVersion: 1,
      },
    ],
  };
}

beforeEach(() => {
  findUnique.mockReset();
  buildBoard.mockReset();
  buildBoard.mockReturnValue([[{ occupied: false }]]);
});

describe("GET /api/matches/:id/state", () => {
  test("requires a participant id before loading match state", async () => {
    const response = await route.GET(request(), context());
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(400);
    expect(payload["error"]).toBe("missing_participant_id");
    expect(findUnique).not.toHaveBeenCalled();
  });

  test("rejects non-participants before building the board", async () => {
    findUnique.mockResolvedValueOnce(matchRecord());

    const response = await route.GET(request("participant-missing"), context());
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(403);
    expect(payload["error"]).toBe("participant_not_found");
    expect(buildBoard).not.toHaveBeenCalled();
  });

  test("returns state without user-linked identifiers", async () => {
    findUnique.mockResolvedValueOnce(matchRecord());

    const response = await route.GET(request("participant-black"), context());
    const payload = (await response.json()) as Record<string, unknown>;
    const participants = payload["participants"] as Array<Record<string, unknown>>;

    expect(response.status).toBe(200);
    expect(payload["createdByUserId"]).toBeUndefined();
    expect(participants[0]?.["userId"]).toBeUndefined();
    expect(participants[0]).toMatchObject({
      participantId: "participant-black",
      displayName: "Black",
    });
    expect(payload["board"]).toEqual([[{ occupied: false }]]);
  });
});
