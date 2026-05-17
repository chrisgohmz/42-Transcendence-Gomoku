import { beforeEach, describe, expect, mock, test } from "bun:test";

import {
  FriendshipStatus,
  MatchResult,
  MatchStatus,
  MatchVisibility,
  Role,
  RuleType,
  Seat,
} from "@/../generated/prisma/enums";

const getCurrentSession = mock();
const findUser = mock();
const findFriendship = mock();
const createMatch = mock();
const transaction = mock();
const updateManyMatches = mock();
const updateManyParticipants = mock();
const publishGameUpdate = mock();
const publishChallengeReceived = mock();
const hashPassword = mock();
const verifyPassword = mock();

const tx = {
  match: {
    updateMany: updateManyMatches,
  },
  matchParticipant: {
    updateMany: updateManyParticipants,
  },
};

await mock.module("@/lib/auth", () => ({
  getCurrentSession,
}));

await mock.module("@/lib/prisma", () => ({
  prisma: {
    friendship: {
      findUnique: findFriendship,
    },
    match: {
      create: createMatch,
    },
    $transaction: transaction,
    user: {
      findUnique: findUser,
    },
  },
}));

await mock.module("@/lib/matches/realtime-publisher", () => ({
  publishChallengeReceived,
  publishGameUpdate,
}));

await mock.module("better-auth/crypto", () => ({
  hashPassword,
  verifyPassword,
}));

const route = await import("./route");

const createdAt = new Date("2026-05-12T00:00:00.000Z");
let hashByRawValue: Map<string, string>;

type ChallengePublishBody = {
  declineToken: string;
  matchId: string;
  password: string;
  senderUsername: string;
  username: string;
};

function isChallengePublishBody(body: unknown): body is ChallengePublishBody {
  return typeof body === "object" && body !== null && "declineToken" in body && "password" in body;
}

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/matches/challenge", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function creatorParticipant() {
  return {
    displayNameSnapshot: "Black",
    id: "black-player",
    joinedAt: createdAt,
    leftAt: null,
    matchId: "match-1",
    result: null,
    role: Role.PLAYER,
    seat: Seat.BLACK,
    userId: "user-black",
  };
}

function createdMatch(args: { data: Record<string, unknown> }) {
  return {
    boardSize: 15,
    createdAt,
    createdByUserId: "user-black",
    endReason: null,
    finishedAt: null,
    id: "match-1",
    metadata: args.data.metadata,
    nextTurnSeat: null,
    participants: [creatorParticipant()],
    password: args.data.password,
    ruleType: RuleType.GOMOKU,
    startedAt: null,
    stateVersion: 0,
    status: MatchStatus.WAITING,
    updatedAt: createdAt,
    visibility: args.data.visibility,
    winningSeat: null,
  };
}

beforeEach(() => {
  getCurrentSession.mockReset();
  findUser.mockReset();
  findFriendship.mockReset();
  createMatch.mockReset();
  transaction.mockReset();
  updateManyMatches.mockReset();
  updateManyParticipants.mockReset();
  publishGameUpdate.mockReset();
  publishChallengeReceived.mockReset();
  hashPassword.mockReset();
  verifyPassword.mockReset();
  hashByRawValue = new Map();

  getCurrentSession.mockResolvedValue({
    user: {
      displayName: "Black",
      id: "user-black",
      username: "black",
    },
  });
  findUser.mockResolvedValue({
    id: "user-white",
    username: "white",
  });
  findFriendship.mockResolvedValue({
    status: FriendshipStatus.ACCEPTED,
  });
  createMatch.mockImplementation((args: { data: Record<string, unknown> }) =>
    Promise.resolve(createdMatch(args)),
  );
  transaction.mockImplementation((callback: (transactionClient: typeof tx) => unknown) =>
    callback(tx),
  );
  updateManyMatches.mockResolvedValue({ count: 1 });
  updateManyParticipants.mockResolvedValue({ count: 1 });
  publishGameUpdate.mockResolvedValue(undefined);
  publishChallengeReceived.mockResolvedValue(undefined);
  hashPassword.mockImplementation((rawValue: string) => {
    const hash = `hash-${hashByRawValue.size + 1}`;
    hashByRawValue.set(rawValue, hash);
    return Promise.resolve(hash);
  });
});

describe("POST /api/matches/challenge", () => {
  test("requires an accepted friendship with the target user", async () => {
    findFriendship.mockResolvedValueOnce({
      status: FriendshipStatus.PENDING,
    });

    const response = await route.POST(request({ targetUsername: "white" }));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload).toMatchObject({ error: "target_not_challengeable" });
    expect(createMatch).not.toHaveBeenCalled();
    expect(publishGameUpdate).not.toHaveBeenCalled();
    expect(publishChallengeReceived).not.toHaveBeenCalled();
  });

  test("creates a private challenge room with server-owned secrets and publishes the invite", async () => {
    const response = await route.POST(
      request({
        name: "Challenge White",
        targetUsername: "white",
      }),
    );
    const payload = await response.json();
    const createArgs = createMatch.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    const challengePayload = publishChallengeReceived.mock.calls[0]?.[1];

    expect(challengePayload).toBeDefined();
    if (!isChallengePublishBody(challengePayload)) {
      throw new Error("Challenge publish payload was not emitted.");
    }

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      displayName: "Black",
      matchId: "match-1",
      participantId: "black-player",
      role: Role.PLAYER,
      seat: Seat.BLACK,
    });
    expect(findFriendship).toHaveBeenCalledWith({
      select: {
        status: true,
      },
      where: {
        userLowId_userHighId: {
          userHighId: "user-white",
          userLowId: "user-black",
        },
      },
    });
    expect(createArgs.data).toMatchObject({
      name: "Challenge White",
      password: hashByRawValue.get(challengePayload.password),
      visibility: MatchVisibility.PRIVATE,
      metadata: {
        declineTokenHash: hashByRawValue.get(challengePayload.declineToken),
        kind: "human-challenge",
        targetUserId: "user-white",
        targetUsername: "white",
      },
    });
    expect(challengePayload).toMatchObject({
      matchId: "match-1",
      senderUsername: "black",
    });
    expect(challengePayload.password).toEqual(expect.any(String));
    expect(challengePayload.declineToken).toEqual(expect.any(String));
    expect(publishGameUpdate).toHaveBeenCalledTimes(1);
    expect(publishChallengeReceived).toHaveBeenCalledWith(
      "white",
      challengePayload,
      expect.any(Number),
    );
  });

  test("cancels the room and returns an error when invite delivery fails", async () => {
    publishChallengeReceived.mockRejectedValueOnce(new Error("realtime down"));

    const response = await route.POST(request({ targetUsername: "white" }));
    const payload = await response.json();

    expect(response.status).toBe(502);
    expect(payload).toMatchObject({
      detail: "realtime down",
      error: "failed_to_deliver_challenge",
    });
    expect(updateManyMatches).toHaveBeenCalledWith({
      data: expect.objectContaining({
        endReason: "challenge_invite_failed",
        finishedAt: expect.any(Date),
        nextTurnSeat: null,
        status: MatchStatus.CANCELLED,
      }),
      where: {
        id: "match-1",
        status: MatchStatus.WAITING,
      },
    });
    expect(updateManyParticipants).toHaveBeenCalledWith({
      data: expect.objectContaining({
        leftAt: expect.any(Date),
        result: MatchResult.CANCELLED,
      }),
      where: {
        leftAt: null,
        matchId: "match-1",
        result: null,
      },
    });
    expect(publishGameUpdate).not.toHaveBeenCalled();
  });

  test("keeps a delivered challenge when the follow-up game update publish fails", async () => {
    publishGameUpdate.mockRejectedValueOnce(new Error("game update down"));

    const response = await route.POST(request({ targetUsername: "white" }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      matchId: "match-1",
      participantId: "black-player",
    });
    expect(publishChallengeReceived).toHaveBeenCalledTimes(1);
    expect(transaction).not.toHaveBeenCalled();
  });
});
