import { createId } from "@paralleldrive/cuid2";

import { hashPassword } from "../app/lib/auth";
import { prisma } from "../app/lib/prisma";
import {
  ConversationKind,
  FriendshipStatus,
  MatchResult,
  MatchStatus,
  MatchVisibility,
  MessageKind,
  Prisma,
  Role,
  RuleType,
  Seat,
  UserSession,
} from "../generated/prisma/client";

const directKeyForUsers = (a: string, b: string): string => [a, b].sort().join(":");

type SeededUsers = {
  alice: { id: string; displayName: string };
  bob: { id: string; displayName: string };
  carol: { id: string; displayName: string };
  sessions: Record<string, UserSession>;
};

const seedUsers = async (): Promise<SeededUsers> => {
  const hashedPassword = await hashPassword("password123");

  const [alice, bob, carol] = await Promise.all([
    prisma.user.create({
      data: {
        username: "alice",
        displayName: "Alice Demo",
        email: "alice@example.com",
        emailVerifiedAt: new Date(),
        passwordHash: hashedPassword,
        statusMessage: "Ready for ranked matches",
      },
    }),
    prisma.user.create({
      data: {
        username: "bob",
        displayName: "Bob Demo",
        email: "bob@example.com",
        emailVerifiedAt: new Date(),
        passwordHash: hashedPassword,
        statusMessage: "Send me a challenge",
      },
    }),
    prisma.user.create({
      data: {
        username: "carol",
        displayName: "Carol Demo",
        email: "carol@example.com",
        emailVerifiedAt: new Date(),
        passwordHash: hashedPassword,
        statusMessage: "Spectating and learning",
      },
    }),
  ]);

  const [aliceAvatar, bobAvatar] = await Promise.all([
    prisma.avatarMedia.create({
      data: {
        uploadedById: alice.id,
        url: "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=256&q=80",
        provider: "seed",
        storageKey: "demo/alice.jpg",
        width: 256,
        height: 256,
        blurHash: "UEP?KXj[5Qoy?wj[IUj[00WV-;xYxZofRjt7",
        contentType: "image/jpeg",
      },
    }),
    prisma.avatarMedia.create({
      data: {
        uploadedById: bob.id,
        url: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=256&q=80",
        provider: "seed",
        storageKey: "demo/bob.jpg",
        width: 256,
        height: 256,
        blurHash: "UGG9#kt7~qRj%LoKt7oLIpxuM{M{M{t7ofWB",
        contentType: "image/jpeg",
      },
    }),
  ]);

  await Promise.all([
    prisma.userProfile.create({
      data: {
        userId: alice.id,
        avatarId: aliceAvatar.id,
        tagline: "Competitive but friendly.",
        countryCode: "US",
        language: "en",
        preferences: {
          theme: "dark",
          boardSize: 15,
        } satisfies Prisma.JsonObject,
      },
    }),
    prisma.userProfile.create({
      data: {
        userId: bob.id,
        avatarId: bobAvatar.id,
        tagline: "Enjoys fast games.",
        countryCode: "GB",
        language: "en",
        preferences: { notifications: true } satisfies Prisma.JsonObject,
      },
    }),
    prisma.userProfile.create({
      data: {
        userId: carol.id,
        tagline: "Cheering from the sidelines.",
        countryCode: "SG",
        language: "en",
        preferences: { spectate: true } satisfies Prisma.JsonObject,
      },
    }),
  ]);

  const sevenDaysFromNow = () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const sessions = await Promise.all([
    prisma.userSession.create({
      data: {
        userId: alice.id,
        sessionToken: createId(),
        expiresAt: sevenDaysFromNow(),
        ipAddress: "127.0.0.1",
        userAgent: "seed/cli",
      },
    }),
    prisma.userSession.create({
      data: {
        userId: bob.id,
        sessionToken: createId(),
        expiresAt: sevenDaysFromNow(),
        ipAddress: "127.0.0.1",
        userAgent: "seed/cli",
      },
    }),
    prisma.userSession.create({
      data: {
        userId: carol.id,
        sessionToken: createId(),
        expiresAt: sevenDaysFromNow(),
        ipAddress: "127.0.0.1",
        userAgent: "seed/cli",
      },
    }),
  ]);

  return {
    alice,
    bob,
    carol,
    sessions: {
      [alice.id]: sessions[0],
      [bob.id]: sessions[1],
      [carol.id]: sessions[2],
    },
  };
};

const seedFriendship = async (aliceId: string, bobId: string) => {
  const lowId = aliceId < bobId ? aliceId : bobId;
  const highId = aliceId < bobId ? bobId : aliceId;
  const now = new Date();

  await prisma.friendship.create({
    data: {
      userLowId: lowId,
      userHighId: highId,
      requestedById: aliceId,
      status: FriendshipStatus.ACCEPTED,
      createdAt: now,
      respondedAt: now,
      acceptedAt: now,
    },
  });
};

const seedDirectConversation = async (aliceId: string, bobId: string) => {
  const now = new Date();
  const firstMessageAt = new Date(now.getTime() - 5 * 60 * 1000);
  const secondMessageAt = new Date(firstMessageAt.getTime() + 30 * 1000);

  await prisma.conversation.create({
    data: {
      kind: ConversationKind.DIRECT,
      directKey: directKeyForUsers(aliceId, bobId),
      lastMessageAt: secondMessageAt,
      participants: {
        create: [
          {
            userId: aliceId,
            joinedAt: firstMessageAt,
            lastReadAt: secondMessageAt,
          },
          {
            userId: bobId,
            joinedAt: firstMessageAt,
            lastReadAt: secondMessageAt,
          },
        ],
      },
      messages: {
        create: [
          {
            senderUserId: aliceId,
            kind: MessageKind.USER,
            body: "Hey Bob, ready for a quick match?",
            createdAt: firstMessageAt,
          },
          {
            senderUserId: bobId,
            kind: MessageKind.USER,
            body: "Always! Let's invite Carol to spectate.",
            createdAt: secondMessageAt,
          },
        ],
      },
    },
  });
};

const seedMatch = async (aliceId: string, bobId: string, carolId: string) => {
  const startedAt = new Date(Date.now() - 20 * 60 * 1000);
  const finishedAt = new Date(Date.now() - 18 * 60 * 1000);

  const match = await prisma.match.create({
    data: {
      status: MatchStatus.FINISHED,
      visibility: MatchVisibility.PUBLIC,
      ruleType: RuleType.GOMOKU,
      boardSize: 15,
      winningSeat: Seat.BLACK,
      endReason: "five_in_a_row",
      createdByUserId: aliceId,
      startedAt,
      finishedAt,
      participants: {
        create: [
          {
            userId: aliceId,
            displayNameSnapshot: "Alice Demo",
            role: Role.PLAYER,
            seat: Seat.BLACK,
            result: MatchResult.WIN,
            joinedAt: startedAt,
            leftAt: finishedAt,
          },
          {
            userId: bobId,
            displayNameSnapshot: "Bob Demo",
            role: Role.PLAYER,
            seat: Seat.WHITE,
            result: MatchResult.LOSS,
            joinedAt: startedAt,
            leftAt: finishedAt,
          },
          {
            userId: carolId,
            displayNameSnapshot: "Carol Demo",
            role: Role.SPECTATOR,
            result: MatchResult.CANCELLED,
            joinedAt: startedAt,
            leftAt: finishedAt,
          },
        ],
      },
    },
  });

  const participants = await prisma.matchParticipant.findMany({
    where: { matchId: match.id },
  });
  const black = participants.find((participant) => participant.seat === Seat.BLACK);
  const white = participants.find((participant) => participant.seat === Seat.WHITE);

  if (!black || !white) {
    throw new Error("Seed match participants were not created as expected.");
  }

  await prisma.matchMove.createMany({
    data: [
      {
        matchId: match.id,
        participantId: black.id,
        moveNumber: 1,
        x: 7,
        y: 7,
        requestId: createId(),
        baseVersion: 0,
        stateVersion: 1,
        createdAt: startedAt,
      },
      {
        matchId: match.id,
        participantId: white.id,
        moveNumber: 2,
        x: 7,
        y: 8,
        requestId: createId(),
        baseVersion: 1,
        stateVersion: 2,
        createdAt: new Date(startedAt.getTime() + 10 * 1000),
      },
      {
        matchId: match.id,
        participantId: black.id,
        moveNumber: 3,
        x: 8,
        y: 8,
        requestId: createId(),
        baseVersion: 2,
        stateVersion: 3,
        createdAt: new Date(startedAt.getTime() + 20 * 1000),
      },
      {
        matchId: match.id,
        participantId: white.id,
        moveNumber: 4,
        x: 6,
        y: 7,
        requestId: createId(),
        baseVersion: 3,
        stateVersion: 4,
        createdAt: new Date(startedAt.getTime() + 30 * 1000),
      },
      {
        matchId: match.id,
        participantId: black.id,
        moveNumber: 5,
        x: 9,
        y: 9,
        requestId: createId(),
        baseVersion: 4,
        stateVersion: 5,
        createdAt: new Date(startedAt.getTime() + 40 * 1000),
      },
      {
        matchId: match.id,
        participantId: white.id,
        moveNumber: 6,
        x: 6,
        y: 8,
        requestId: createId(),
        baseVersion: 5,
        stateVersion: 6,
        createdAt: new Date(startedAt.getTime() + 50 * 1000),
      },
    ],
  });

  return { match, startedAt, finishedAt };
};

const seedStatsAndAchievements = async (
  aliceId: string,
  bobId: string,
  carolId: string,
  finishedAt: Date,
) => {
  await prisma.userGameStats.createMany({
    data: [
      {
        userId: aliceId,
        ruleType: RuleType.GOMOKU,
        boardSize: 15,
        matchesPlayed: 5,
        wins: 4,
        losses: 1,
        draws: 0,
        botMatchesPlayed: 2,
        botWins: 2,
        currentStreak: 3,
        bestStreak: 4,
        rating: 1200,
        averageMoveTimeMs: 900,
        totalPlayTimeSeconds: 1200,
        lastPlayedAt: finishedAt,
      },
      {
        userId: bobId,
        ruleType: RuleType.GOMOKU,
        boardSize: 15,
        matchesPlayed: 4,
        wins: 1,
        losses: 3,
        draws: 0,
        botMatchesPlayed: 1,
        botWins: 1,
        currentStreak: 0,
        bestStreak: 2,
        rating: 1080,
        averageMoveTimeMs: 1100,
        totalPlayTimeSeconds: 900,
        lastPlayedAt: finishedAt,
      },
      {
        userId: carolId,
        ruleType: RuleType.GOMOKU,
        boardSize: 15,
        matchesPlayed: 2,
        wins: 0,
        losses: 2,
        draws: 0,
        botMatchesPlayed: 0,
        botWins: 0,
        currentStreak: 0,
        bestStreak: 0,
        rating: 1020,
        averageMoveTimeMs: 1400,
        totalPlayTimeSeconds: 400,
        lastPlayedAt: finishedAt,
      },
    ],
  });

  const firstWin = await prisma.achievementDefinition.create({
    data: {
      code: "first_win",
      name: "First Victory",
      description: "Win your first public match.",
      points: 10,
    },
  });
  const socialLink = await prisma.achievementDefinition.create({
    data: {
      code: "first_friend",
      name: "Social Link",
      description: "Add your first friend.",
      points: 5,
    },
  });
  const strategist = await prisma.achievementDefinition.create({
    data: {
      code: "ten_moves",
      name: "Strategist",
      description: "Record at least 10 moves across matches.",
      points: 15,
    },
  });

  await prisma.userAchievement.createMany({
    data: [
      {
        userId: aliceId,
        achievementId: firstWin.id,
        progress: 1,
        completedAt: finishedAt,
      },
      {
        userId: aliceId,
        achievementId: socialLink.id,
        progress: 1,
        completedAt: finishedAt,
      },
      {
        userId: bobId,
        achievementId: socialLink.id,
        progress: 1,
        completedAt: finishedAt,
      },
      {
        userId: bobId,
        achievementId: strategist.id,
        progress: 10,
        completedAt: finishedAt,
      },
    ],
  });
};

const seedAnalyticsEvents = async (
  matchId: string,
  sessions: Record<string, UserSession>,
  aliceId: string,
  bobId: string,
  carolId: string,
  finishedAt: Date,
) => {
  const now = new Date();

  await prisma.analyticsEvent.createMany({
    data: [
      {
        id: createId(),
        userId: aliceId,
        sessionId: sessions[aliceId]?.id,
        matchId,
        eventType: "match.finished",
        properties: {
          winnerSeat: Seat.BLACK,
          ruleType: RuleType.GOMOKU,
          boardSize: 15,
        } satisfies Prisma.JsonObject,
        createdAt: finishedAt,
      },
      {
        id: createId(),
        userId: bobId,
        sessionId: sessions[bobId]?.id,
        matchId,
        eventType: "match.spectated",
        properties: {
          viewer: "carol",
          peakViewers: 1,
        } satisfies Prisma.JsonObject,
        createdAt: finishedAt,
      },
      {
        id: createId(),
        userId: carolId,
        sessionId: sessions[carolId]?.id,
        eventType: "friendship.accepted",
        properties: {
          accepted: true,
        } satisfies Prisma.JsonObject,
        createdAt: now,
      },
    ],
  });
};

const main = async () => {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("Database is not empty; skipping seed to avoid clobbering existing data.");
    return;
  }

  const { alice, bob, carol, sessions } = await seedUsers();
  await seedFriendship(alice.id, bob.id);
  await seedDirectConversation(alice.id, bob.id);
  const { match, finishedAt } = await seedMatch(alice.id, bob.id, carol.id);
  await seedStatsAndAchievements(alice.id, bob.id, carol.id, finishedAt);
  await seedAnalyticsEvents(match.id, sessions, alice.id, bob.id, carol.id, finishedAt);

  console.log(
    "Seed data created: users, friendship, chat, match, stats, achievements, and analytics.",
  );
};

main()
  .catch((error: unknown) => {
    console.error("Failed to seed database:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
