import { createId } from "@paralleldrive/cuid2";
import { hashPassword } from "better-auth/crypto";

import { createSoloMatchMetadata } from "../app/lib/matches/ai-solo";
import { createChallengeMatchMetadata } from "../app/lib/matches/challenge-metadata";
import { prisma } from "../app/lib/prisma";
import {
  ConversationKind,
  FriendshipStatus,
  MatchResult,
  MatchStatus,
  MatchVisibility,
  MessageKind,
  Prisma,
  ProfileVisibility,
  Role,
  RuleType,
  Seat,
  UserKind,
  type Match,
  type User,
  type UserSession,
} from "../generated/prisma/client";

const demoPassword = "password123";
const dayMs = 24 * 60 * 60 * 1000;
const hourMs = 60 * 60 * 1000;
const minuteMs = 60 * 1000;
const secondMs = 1000;

const directKeyForUsers = (a: string, b: string): string => [a, b].sort().join(":");

type SeedClient = Pick<
  typeof prisma,
  | "achievementDefinition"
  | "analyticsEvent"
  | "avatarMedia"
  | "conversation"
  | "friendship"
  | "match"
  | "matchMove"
  | "matchParticipant"
  | "user"
  | "userAchievement"
  | "userGameStats"
  | "userProfile"
  | "userSession"
>;

type EnumValue<T extends Record<string, string>> = T[keyof T];
type FriendshipStatusValue = EnumValue<typeof FriendshipStatus>;
type MatchResultValue = EnumValue<typeof MatchResult>;
type MatchStatusValue = EnumValue<typeof MatchStatus>;
type MatchVisibilityValue = EnumValue<typeof MatchVisibility>;
type MessageKindValue = EnumValue<typeof MessageKind>;
type ProfileVisibilityValue = EnumValue<typeof ProfileVisibility>;
type RoleValue = EnumValue<typeof Role>;
type RuleTypeValue = EnumValue<typeof RuleType>;
type SeatValue = EnumValue<typeof Seat>;
type UserKindValue = EnumValue<typeof UserKind>;

type DemoProfileSeed = {
  countryCode: string;
  language: string;
  preferences: Prisma.JsonObject;
  tagline: string;
  timezone: string;
  visibility: ProfileVisibilityValue;
};

type DemoUserSeed = {
  avatarUrl?: string;
  bio: string;
  displayName: string;
  email?: string;
  key: string;
  kind?: UserKindValue;
  lastSeenMinutesAgo?: number | null;
  profile: DemoProfileSeed;
  statusMessage: string;
  username: string;
};

const seedAvatarUrl = (slug: string) => `/seed-avatars/${slug}.svg`;

const userSeeds = [
  {
    key: "alice",
    username: "alice",
    displayName: "Alice Demo",
    email: "alice@example.com",
    avatarUrl: seedAvatarUrl("alice"),
    bio: "Warm-up specialist who likes balanced openings and short post-game reviews.",
    statusMessage: "Ready for ranked matches",
    lastSeenMinutesAgo: 3,
    profile: {
      tagline: "Competitive but friendly.",
      countryCode: "US",
      language: "en",
      timezone: "America/Los_Angeles",
      visibility: ProfileVisibility.PUBLIC,
      preferences: {
        boardSize: 15,
        theme: "dark",
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "bob",
    username: "bob",
    displayName: "Bob Demo",
    email: "bob@example.com",
    avatarUrl: seedAvatarUrl("bob"),
    bio: "Fast-player with a weakness for risky center fights.",
    statusMessage: "Send me a challenge",
    lastSeenMinutesAgo: 18,
    profile: {
      tagline: "Enjoys fast games.",
      countryCode: "GB",
      language: "en",
      timezone: "Europe/London",
      visibility: ProfileVisibility.FRIENDS,
      preferences: {
        notifications: true,
        preferredPace: "rapid",
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "carol",
    username: "carol",
    displayName: "Carol Demo",
    email: "carol@example.com",
    avatarUrl: seedAvatarUrl("carol"),
    bio: "Spectator, annotator, and occasional endgame trap enjoyer.",
    statusMessage: "Spectating and learning",
    lastSeenMinutesAgo: 45,
    profile: {
      tagline: "Cheering from the sidelines.",
      countryCode: "SG",
      language: "en",
      timezone: "Asia/Singapore",
      visibility: ProfileVisibility.PUBLIC,
      preferences: {
        spectate: true,
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "hoshi",
    username: "Hoshi",
    displayName: "Hoshi",
    email: "hoshi@example.com",
    avatarUrl: seedAvatarUrl("hoshi"),
    bio: "Current ladder leader. Prefers quiet pressure over flashy captures.",
    statusMessage: "Reading the whole board",
    lastSeenMinutesAgo: 2,
    profile: {
      tagline: "Open four hunter.",
      countryCode: "JP",
      language: "ja",
      timezone: "Asia/Tokyo",
      visibility: ProfileVisibility.PUBLIC,
      preferences: {
        analysisBoard: true,
        favoriteOpening: "star-point cross",
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "renjuMaster",
    username: "RenjuMaster",
    displayName: "RenjuMaster",
    email: "renjumaster@example.com",
    avatarUrl: seedAvatarUrl("renju-master"),
    bio: "Renju rules advocate who teaches forbidden-move patterns.",
    statusMessage: "Review room open",
    lastSeenMinutesAgo: 7,
    profile: {
      tagline: "Renju theory, one fork at a time.",
      countryCode: "KR",
      language: "en",
      timezone: "Asia/Seoul",
      visibility: ProfileVisibility.PUBLIC,
      preferences: {
        favoriteRule: "RENJU",
        reviewInvites: true,
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "kuroishi",
    username: "Kuroishi",
    displayName: "Kuroishi",
    email: "kuroishi@example.com",
    avatarUrl: seedAvatarUrl("kuroishi"),
    bio: "Defensive specialist with a taste for long forcing ladders.",
    statusMessage: "Testing Renju defenses",
    lastSeenMinutesAgo: 24,
    profile: {
      tagline: "No easy lanes.",
      countryCode: "CA",
      language: "en",
      timezone: "America/Toronto",
      visibility: ProfileVisibility.PRIVATE,
      preferences: {
        showPresence: false,
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "shirotora",
    username: "Shirotora",
    displayName: "Shirotora",
    email: "shirotora@example.com",
    avatarUrl: seedAvatarUrl("shirotora"),
    bio: "Aggressive player who rematches quickly and learns loudly.",
    statusMessage: "Looking for a rematch",
    lastSeenMinutesAgo: 31,
    profile: {
      tagline: "Attack first, annotate later.",
      countryCode: "AU",
      language: "en",
      timezone: "Australia/Sydney",
      visibility: ProfileVisibility.FRIENDS,
      preferences: {
        autoRematch: true,
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "tenkei",
    username: "Tenkei",
    displayName: "Tenkei",
    email: "tenkei@example.com",
    avatarUrl: seedAvatarUrl("tenkei"),
    bio: "Calm endgame player who likes private study rooms.",
    statusMessage: "Accepted rematch",
    lastSeenMinutesAgo: 33,
    profile: {
      tagline: "Small threats, big patience.",
      countryCode: "FR",
      language: "en",
      timezone: "Europe/Paris",
      visibility: ProfileVisibility.PUBLIC,
      preferences: {
        studyRooms: true,
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "mei",
    username: "mei",
    displayName: "Mei Tan",
    email: "mei@example.com",
    avatarUrl: seedAvatarUrl("mei"),
    bio: "Newcomer grinding puzzles before entering ranked rooms.",
    statusMessage: "Practicing double-threes",
    lastSeenMinutesAgo: 65,
    profile: {
      tagline: "Learning every fork the hard way.",
      countryCode: "MY",
      language: "en",
      timezone: "Asia/Kuala_Lumpur",
      visibility: ProfileVisibility.PUBLIC,
      preferences: {
        tutorialHints: true,
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "noah",
    username: "noah",
    displayName: "Noah Stone",
    email: "noah@example.com",
    bio: "Plays from a minimal profile and rarely uploads avatars.",
    statusMessage: "Queueing later",
    lastSeenMinutesAgo: 180,
    profile: {
      tagline: "Simple shapes first.",
      countryCode: "DE",
      language: "en",
      timezone: "Europe/Berlin",
      visibility: ProfileVisibility.PUBLIC,
      preferences: {
        compactMode: true,
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "lina",
    username: "lina",
    displayName: "Lina Park",
    email: "lina@example.com",
    avatarUrl: seedAvatarUrl("lina"),
    bio: "Methodical ladder climber with a soft spot for draw offers.",
    statusMessage: "Reviewing losses",
    lastSeenMinutesAgo: 240,
    profile: {
      tagline: "Every loss becomes a diagram.",
      countryCode: "NZ",
      language: "en",
      timezone: "Pacific/Auckland",
      visibility: ProfileVisibility.FRIENDS,
      preferences: {
        emailSummary: "weekly",
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "arun",
    username: "arun",
    displayName: "Arun Rao",
    email: "arun@example.com",
    avatarUrl: seedAvatarUrl("arun"),
    bio: "Enjoys long games, patient reads, and polite rematches.",
    statusMessage: "Studying joseki",
    lastSeenMinutesAgo: 360,
    profile: {
      tagline: "Slow moves, steady ladder.",
      countryCode: "IN",
      language: "en",
      timezone: "Asia/Kolkata",
      visibility: ProfileVisibility.PUBLIC,
      preferences: {
        preferredPace: "classical",
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "mika",
    username: "mika",
    displayName: "Mika Ito",
    email: "mika@example.com",
    avatarUrl: seedAvatarUrl("mika"),
    bio: "Occasional player who mostly follows friends' match rooms.",
    statusMessage: "Watching study games",
    lastSeenMinutesAgo: 720,
    profile: {
      tagline: "Here for the reviews.",
      countryCode: "PH",
      language: "en",
      timezone: "Asia/Manila",
      visibility: ProfileVisibility.PUBLIC,
      preferences: {
        spectate: true,
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "kataReader",
    username: "kata_reader",
    displayName: "Kata Reader",
    kind: UserKind.BOT,
    avatarUrl: seedAvatarUrl("kata-reader"),
    bio: "Seeded AI persona used by solo match demonstrations.",
    statusMessage: "Calculating candidate moves",
    lastSeenMinutesAgo: 1,
    profile: {
      tagline: "Tactical AI opponent.",
      countryCode: "SG",
      language: "en",
      timezone: "Asia/Singapore",
      visibility: ProfileVisibility.PUBLIC,
      preferences: {
        botDifficulty: "expert",
      } satisfies Prisma.JsonObject,
    },
  },
  {
    key: "ladderBot",
    username: "ladder_bot",
    displayName: "Ladder Bot",
    kind: UserKind.BOT,
    avatarUrl: seedAvatarUrl("ladder-bot"),
    bio: "Background bot account for moderation and queue examples.",
    statusMessage: "Monitoring open rooms",
    lastSeenMinutesAgo: 4,
    profile: {
      tagline: "Keeps the ladder tidy.",
      countryCode: "SG",
      language: "en",
      timezone: "Asia/Singapore",
      visibility: ProfileVisibility.PUBLIC,
      preferences: {
        botRole: "lobby",
      } satisfies Prisma.JsonObject,
    },
  },
] as const satisfies readonly DemoUserSeed[];

type SeedUserKey = (typeof userSeeds)[number]["key"];
type DemoUserFixture = DemoUserSeed & { key: SeedUserKey };
type SeededUser = Pick<User, "displayName" | "id" | "kind" | "username">;
type SeededUsers = Record<SeedUserKey, SeededUser>;

const demoUserSeeds: readonly DemoUserFixture[] = userSeeds;

type SeedHashes = {
  challengeDeclineToken: string;
  challengeRoomPassword: string;
  privateRoomPassword: string;
  userPassword: string;
};

type SeededUsersResult = {
  sessions: Record<string, UserSession>;
  users: SeededUsers;
};

function minutesAgo(now: Date, minutes: number): Date {
  return new Date(now.getTime() - minutes * minuteMs);
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * dayMs);
}

function daysFromNow(now: Date, days: number): Date {
  return new Date(now.getTime() + days * dayMs);
}

function plusMs(date: Date, milliseconds: number): Date {
  return new Date(date.getTime() + milliseconds);
}

function providerForAvatar(url: string): string {
  return url.startsWith("/seed-avatars/") ? "seed-local" : "local";
}

function contentTypeForAvatar(url: string): string {
  if (url.endsWith(".svg")) {
    return "image/svg+xml";
  }

  if (url.endsWith(".png")) {
    return "image/png";
  }

  if (url.endsWith(".webp")) {
    return "image/webp";
  }

  return "image/jpeg";
}

function storageKeyForAvatar(username: string, url: string): string {
  return url.startsWith("/") ? url.slice(1) : `demo/${username}`;
}

function getLowHighIds(id1: string, id2: string) {
  return id1 < id2 ? { userLowId: id1, userHighId: id2 } : { userLowId: id2, userHighId: id1 };
}

async function seedUsers(
  db: SeedClient,
  now: Date,
  hashes: SeedHashes,
): Promise<SeededUsersResult> {
  const users = {} as SeededUsers;
  const sessions: Record<string, UserSession> = {};

  for (const seed of demoUserSeeds) {
    const userId = createId();
    const kind = seed.kind ?? UserKind.HUMAN;
    const isBot = kind === UserKind.BOT;

    const user = await db.user.create({
      data: {
        id: userId,
        kind,
        username: seed.username,
        displayName: seed.displayName,
        email: seed.email ?? null,
        emailVerified: seed.email !== undefined,
        avatarUrl: seed.avatarUrl ?? null,
        bio: seed.bio,
        statusMessage: seed.statusMessage,
        lastSeenAt:
          seed.lastSeenMinutesAgo === null || seed.lastSeenMinutesAgo === undefined
            ? null
            : minutesAgo(now, seed.lastSeenMinutesAgo),
        ...(isBot
          ? {}
          : {
              accounts: {
                create: {
                  id: createId(),
                  accountId: userId,
                  providerId: "credential",
                  password: hashes.userPassword,
                },
              },
            }),
      },
    });

    users[seed.key] = {
      displayName: user.displayName,
      id: user.id,
      kind: user.kind,
      username: user.username,
    };

    const avatar = seed.avatarUrl
      ? await db.avatarMedia.create({
          data: {
            id: createId(),
            uploadedById: user.id,
            url: seed.avatarUrl,
            provider: providerForAvatar(seed.avatarUrl),
            storageKey: storageKeyForAvatar(seed.username, seed.avatarUrl),
            width: 256,
            height: 256,
            contentType: contentTypeForAvatar(seed.avatarUrl),
          },
        })
      : null;

    await db.userProfile.create({
      data: {
        userId: user.id,
        avatarId: avatar?.id ?? null,
        tagline: seed.profile.tagline,
        countryCode: seed.profile.countryCode,
        language: seed.profile.language,
        timezone: seed.profile.timezone,
        visibility: seed.profile.visibility,
        preferences: seed.profile.preferences,
      },
    });

    if (!isBot) {
      const session = await db.userSession.create({
        data: {
          id: createId(),
          userId: user.id,
          sessionToken: createId(),
          expiresAt: daysFromNow(now, 7),
          createdAt: minutesAgo(now, seed.lastSeenMinutesAgo ?? 10),
          ipAddress: "127.0.0.1",
          userAgent: "seed/cli",
        },
      });

      sessions[user.id] = session;
    }
  }

  return { sessions, users };
}

type FriendshipSeed = {
  createdDaysAgo: number;
  receiver: SeedUserKey;
  requester: SeedUserKey;
  status: FriendshipStatusValue;
};

const friendshipSeeds = [
  { requester: "alice", receiver: "bob", status: FriendshipStatus.ACCEPTED, createdDaysAgo: 18 },
  { requester: "alice", receiver: "carol", status: FriendshipStatus.ACCEPTED, createdDaysAgo: 12 },
  { requester: "hoshi", receiver: "alice", status: FriendshipStatus.ACCEPTED, createdDaysAgo: 8 },
  { requester: "tenkei", receiver: "alice", status: FriendshipStatus.ACCEPTED, createdDaysAgo: 6 },
  { requester: "alice", receiver: "noah", status: FriendshipStatus.PENDING, createdDaysAgo: 2 },
  { requester: "mei", receiver: "alice", status: FriendshipStatus.PENDING, createdDaysAgo: 1 },
  { requester: "alice", receiver: "kuroishi", status: FriendshipStatus.BLOCKED, createdDaysAgo: 5 },
  { requester: "bob", receiver: "carol", status: FriendshipStatus.ACCEPTED, createdDaysAgo: 20 },
  {
    requester: "hoshi",
    receiver: "renjuMaster",
    status: FriendshipStatus.ACCEPTED,
    createdDaysAgo: 42,
  },
  {
    requester: "shirotora",
    receiver: "hoshi",
    status: FriendshipStatus.ACCEPTED,
    createdDaysAgo: 15,
  },
  {
    requester: "renjuMaster",
    receiver: "kuroishi",
    status: FriendshipStatus.ACCEPTED,
    createdDaysAgo: 30,
  },
  {
    requester: "shirotora",
    receiver: "kuroishi",
    status: FriendshipStatus.DECLINED,
    createdDaysAgo: 9,
  },
  { requester: "tenkei", receiver: "mika", status: FriendshipStatus.ACCEPTED, createdDaysAgo: 11 },
  { requester: "lina", receiver: "arun", status: FriendshipStatus.ACCEPTED, createdDaysAgo: 25 },
  { requester: "bob", receiver: "mei", status: FriendshipStatus.PENDING, createdDaysAgo: 3 },
  { requester: "carol", receiver: "lina", status: FriendshipStatus.ACCEPTED, createdDaysAgo: 16 },
] as const satisfies readonly FriendshipSeed[];

async function seedFriendships(db: SeedClient, users: SeededUsers, now: Date): Promise<number> {
  await db.friendship.createMany({
    data: friendshipSeeds.map((seed) => {
      const createdAt = daysAgo(now, seed.createdDaysAgo);
      const { userLowId, userHighId } = getLowHighIds(
        users[seed.requester].id,
        users[seed.receiver].id,
      );
      const respondedAt =
        seed.status === FriendshipStatus.PENDING ? null : plusMs(createdAt, 2 * hourMs);

      return {
        userLowId,
        userHighId,
        requestedById: users[seed.requester].id,
        status: seed.status,
        createdAt,
        respondedAt,
        acceptedAt: seed.status === FriendshipStatus.ACCEPTED ? respondedAt : null,
        declinedAt: seed.status === FriendshipStatus.DECLINED ? respondedAt : null,
      };
    }),
  });

  return friendshipSeeds.length;
}

type ConversationMessageSeed = {
  body: string;
  kind?: MessageKindValue;
  minutesAgo: number;
  sender?: SeedUserKey;
};

type DirectConversationSeed = {
  lastReadMinutesAgo?: Partial<Record<SeedUserKey, number | null>>;
  messages: readonly ConversationMessageSeed[];
  users: readonly [SeedUserKey, SeedUserKey];
};

const directConversationSeeds = [
  {
    users: ["alice", "bob"],
    messages: [
      { sender: "alice", body: "Hey Bob, ready for a quick match?", minutesAgo: 76 },
      { sender: "bob", body: "Always. I want another shot at that center ladder.", minutesAgo: 73 },
      { sender: "alice", body: "Deal. Carol said she might spectate.", minutesAgo: 71 },
    ],
  },
  {
    users: ["alice", "carol"],
    lastReadMinutesAgo: { alice: 30, carol: 8 },
    messages: [
      { sender: "carol", body: "I clipped the final shape from your Bob match.", minutesAgo: 52 },
      { sender: "alice", body: "Nice. Was it actually clean or just lucky?", minutesAgo: 34 },
      { sender: "carol", body: "Clean enough for the evaluation demo.", minutesAgo: 11 },
    ],
  },
  {
    users: ["alice", "hoshi"],
    messages: [
      { sender: "hoshi", body: "Your third move gave black too much influence.", minutesAgo: 180 },
      { sender: "alice", body: "Can you show me after the ladder room?", minutesAgo: 170 },
      { sender: "hoshi", body: "Already opened a public warmup.", minutesAgo: 144 },
    ],
  },
  {
    users: ["alice", "tenkei"],
    lastReadMinutesAgo: { alice: 90, tenkei: 88 },
    messages: [
      {
        sender: "tenkei",
        body: "Private review room is up. Password is in the invite.",
        minutesAgo: 118,
      },
      {
        sender: "alice",
        body: "Thanks. I want to test the slow diagonal defense.",
        minutesAgo: 96,
      },
    ],
  },
  {
    users: ["bob", "carol"],
    messages: [
      { sender: "bob", body: "Did you see where I lost tempo?", minutesAgo: 420 },
      { sender: "carol", body: "Move six. You blocked the harmless side.", minutesAgo: 410 },
      { sender: "bob", body: "Ouch. Fair.", minutesAgo: 405 },
    ],
  },
  {
    users: ["hoshi", "renjuMaster"],
    messages: [
      { sender: "renjuMaster", body: "The Renju clinic needs one more example.", minutesAgo: 510 },
      { sender: "hoshi", body: "Use our white win from yesterday.", minutesAgo: 505 },
    ],
  },
  {
    users: ["lina", "arun"],
    messages: [
      { sender: "lina", body: "Draw offer was correct, right?", minutesAgo: 600 },
      { sender: "arun", body: "Correct and very polite.", minutesAgo: 590 },
    ],
  },
  {
    users: ["carol", "lina"],
    lastReadMinutesAgo: { carol: 500, lina: 470 },
    messages: [
      { sender: "lina", body: "Want to annotate the Mei game?", minutesAgo: 520 },
      { sender: "carol", body: "Yes, especially the endgame.", minutesAgo: 488 },
      { sender: "lina", body: "I left notes in the match chat.", minutesAgo: 472 },
    ],
  },
] as const satisfies readonly DirectConversationSeed[];

const directConversationFixtures: readonly DirectConversationSeed[] = directConversationSeeds;

async function createConversationMessages(
  db: SeedClient,
  conversationId: string,
  messages: readonly ConversationMessageSeed[],
  users: SeededUsers,
  now: Date,
): Promise<void> {
  const sortedMessages = [...messages].sort((a, b) => b.minutesAgo - a.minutesAgo);

  await db.conversation.update({
    where: { id: conversationId },
    data: {
      messages: {
        create: sortedMessages.map((message) => ({
          id: createId(),
          senderUserId: message.sender ? users[message.sender].id : null,
          kind: message.kind ?? (message.sender ? MessageKind.USER : MessageKind.SYSTEM),
          body: message.body,
          createdAt: minutesAgo(now, message.minutesAgo),
        })),
      },
    },
  });
}

async function seedDirectConversations(
  db: SeedClient,
  users: SeededUsers,
  now: Date,
): Promise<number> {
  for (const seed of directConversationFixtures) {
    const sortedMessages = [...seed.messages].sort((a, b) => b.minutesAgo - a.minutesAgo);
    const firstMessage = sortedMessages[0];
    const lastMessage = sortedMessages.at(-1);

    if (!firstMessage || !lastMessage) {
      throw new Error("Direct conversation seed requires at least one message.");
    }

    const [firstUserKey, secondUserKey] = seed.users;
    const firstMessageAt = minutesAgo(now, firstMessage.minutesAgo);
    const lastMessageAt = minutesAgo(now, lastMessage.minutesAgo);
    const conversationId = createId();

    await db.conversation.create({
      data: {
        id: conversationId,
        kind: ConversationKind.DIRECT,
        directKey: directKeyForUsers(users[firstUserKey].id, users[secondUserKey].id),
        createdAt: firstMessageAt,
        lastMessageAt,
        participants: {
          create: seed.users.map((userKey) => {
            const readMinutesAgo = seed.lastReadMinutesAgo?.[userKey];

            return {
              id: createId(),
              userId: users[userKey].id,
              joinedAt: firstMessageAt,
              lastReadAt:
                readMinutesAgo === undefined
                  ? lastMessageAt
                  : readMinutesAgo === null
                    ? null
                    : minutesAgo(now, readMinutesAgo),
            };
          }),
        },
      },
    });

    await createConversationMessages(db, conversationId, seed.messages, users, now);
  }

  return directConversationFixtures.length;
}

async function seedGroupConversation(
  db: SeedClient,
  users: SeededUsers,
  now: Date,
): Promise<number> {
  const participantKeys = ["alice", "bob", "carol", "hoshi", "tenkei"] as const;
  const messages = [
    {
      kind: MessageKind.SYSTEM,
      body: "Friday review circle created.",
      minutesAgo: 155,
    },
    {
      sender: "hoshi",
      body: "Bring one match where you missed a forcing move.",
      minutesAgo: 151,
    },
    {
      sender: "bob",
      body: "That gives me several options.",
      minutesAgo: 148,
    },
    {
      sender: "carol",
      body: "Perfect. I will annotate the cleanest one.",
      minutesAgo: 146,
    },
  ] satisfies readonly ConversationMessageSeed[];
  const firstMessageAt = minutesAgo(now, 155);
  const lastMessageAt = minutesAgo(now, 146);
  const conversationId = createId();

  await db.conversation.create({
    data: {
      id: conversationId,
      kind: ConversationKind.GROUP,
      topic: "Friday review circle",
      createdAt: firstMessageAt,
      lastMessageAt,
      participants: {
        create: participantKeys.map((userKey) => ({
          id: createId(),
          userId: users[userKey].id,
          joinedAt: firstMessageAt,
          lastReadAt: userKey === "alice" ? minutesAgo(now, 150) : lastMessageAt,
        })),
      },
    },
  });

  await createConversationMessages(db, conversationId, messages, users, now);

  return 1;
}

type MatchParticipantSeed = {
  displayName?: string;
  result?: MatchResultValue | null;
  role: RoleValue;
  seat?: SeatValue | null;
  userKey?: SeedUserKey;
};

type MoveSeed = {
  seat: SeatValue;
  secondsAfterStart: number;
  x: number;
  y: number;
};

type MatchConversationMessageSeed = ConversationMessageSeed;

type MatchSeed = {
  boardSize?: number;
  conversationMessages?: readonly MatchConversationMessageSeed[];
  createdBy?: SeedUserKey;
  createdMinutesAgo: number;
  endReason?: string | null;
  finishedMinutesAgo?: number;
  key: string;
  metadata?: (users: SeededUsers, hashes: SeedHashes) => Prisma.JsonObject;
  moves?: readonly MoveSeed[];
  name: string;
  nextTurnSeat?: SeatValue | null;
  participants: readonly MatchParticipantSeed[];
  passwordHash?: (hashes: SeedHashes) => string;
  ruleType?: RuleTypeValue;
  startedMinutesAgo?: number;
  status: MatchStatusValue;
  visibility?: MatchVisibilityValue;
  winningSeat?: SeatValue | null;
};

const aliceBobMoves = [
  { seat: Seat.BLACK, x: 3, y: 7, secondsAfterStart: 8 },
  { seat: Seat.WHITE, x: 3, y: 8, secondsAfterStart: 24 },
  { seat: Seat.BLACK, x: 4, y: 7, secondsAfterStart: 42 },
  { seat: Seat.WHITE, x: 4, y: 8, secondsAfterStart: 61 },
  { seat: Seat.BLACK, x: 5, y: 7, secondsAfterStart: 79 },
  { seat: Seat.WHITE, x: 5, y: 8, secondsAfterStart: 96 },
  { seat: Seat.BLACK, x: 6, y: 7, secondsAfterStart: 115 },
  { seat: Seat.WHITE, x: 6, y: 8, secondsAfterStart: 134 },
  { seat: Seat.BLACK, x: 7, y: 7, secondsAfterStart: 151 },
] as const satisfies readonly MoveSeed[];

const renjuClinicMoves = [
  { seat: Seat.BLACK, x: 7, y: 7, secondsAfterStart: 12 },
  { seat: Seat.WHITE, x: 8, y: 7, secondsAfterStart: 31 },
  { seat: Seat.BLACK, x: 7, y: 8, secondsAfterStart: 56 },
  { seat: Seat.WHITE, x: 8, y: 8, secondsAfterStart: 78 },
  { seat: Seat.BLACK, x: 6, y: 7, secondsAfterStart: 101 },
  { seat: Seat.WHITE, x: 9, y: 7, secondsAfterStart: 124 },
  { seat: Seat.BLACK, x: 6, y: 8, secondsAfterStart: 152 },
  { seat: Seat.WHITE, x: 10, y: 7, secondsAfterStart: 184 },
  { seat: Seat.BLACK, x: 5, y: 7, secondsAfterStart: 216 },
  { seat: Seat.WHITE, x: 11, y: 7, secondsAfterStart: 255 },
] as const satisfies readonly MoveSeed[];

const drawMoves = [
  { seat: Seat.BLACK, x: 6, y: 6, secondsAfterStart: 15 },
  { seat: Seat.WHITE, x: 7, y: 6, secondsAfterStart: 31 },
  { seat: Seat.BLACK, x: 6, y: 7, secondsAfterStart: 48 },
  { seat: Seat.WHITE, x: 7, y: 7, secondsAfterStart: 65 },
  { seat: Seat.BLACK, x: 8, y: 6, secondsAfterStart: 84 },
  { seat: Seat.WHITE, x: 8, y: 7, secondsAfterStart: 100 },
  { seat: Seat.BLACK, x: 9, y: 6, secondsAfterStart: 126 },
  { seat: Seat.WHITE, x: 9, y: 7, secondsAfterStart: 143 },
] as const satisfies readonly MoveSeed[];

const soloAiMoves = [
  { seat: Seat.BLACK, x: 7, y: 7, secondsAfterStart: 10 },
  { seat: Seat.WHITE, x: 8, y: 8, secondsAfterStart: 23 },
  { seat: Seat.BLACK, x: 7, y: 8, secondsAfterStart: 39 },
  { seat: Seat.WHITE, x: 8, y: 7, secondsAfterStart: 55 },
  { seat: Seat.BLACK, x: 7, y: 9, secondsAfterStart: 72 },
  { seat: Seat.WHITE, x: 9, y: 7, secondsAfterStart: 91 },
  { seat: Seat.BLACK, x: 7, y: 10, secondsAfterStart: 111 },
  { seat: Seat.WHITE, x: 10, y: 7, secondsAfterStart: 133 },
  { seat: Seat.BLACK, x: 7, y: 11, secondsAfterStart: 156 },
] as const satisfies readonly MoveSeed[];

const activeStudyMoves = [
  { seat: Seat.BLACK, x: 7, y: 7, secondsAfterStart: 8 },
  { seat: Seat.WHITE, x: 8, y: 7, secondsAfterStart: 22 },
  { seat: Seat.BLACK, x: 6, y: 7, secondsAfterStart: 44 },
  { seat: Seat.WHITE, x: 8, y: 8, secondsAfterStart: 67 },
  { seat: Seat.BLACK, x: 5, y: 7, secondsAfterStart: 98 },
  { seat: Seat.WHITE, x: 8, y: 9, secondsAfterStart: 129 },
] as const satisfies readonly MoveSeed[];

const matchSeeds = [
  {
    key: "aliceBobFinal",
    name: "Rooftop Ladder: Alice vs Bob",
    status: MatchStatus.FINISHED,
    visibility: MatchVisibility.PUBLIC,
    ruleType: RuleType.GOMOKU,
    createdBy: "alice",
    createdMinutesAgo: 270,
    startedMinutesAgo: 250,
    finishedMinutesAgo: 238,
    winningSeat: Seat.BLACK,
    endReason: "five_in_a_row",
    participants: [
      { userKey: "alice", role: Role.PLAYER, seat: Seat.BLACK, result: MatchResult.WIN },
      { userKey: "bob", role: Role.PLAYER, seat: Seat.WHITE, result: MatchResult.LOSS },
      { userKey: "carol", role: Role.SPECTATOR },
    ],
    moves: aliceBobMoves,
    conversationMessages: [
      { kind: MessageKind.SYSTEM, body: "Match started.", minutesAgo: 250 },
      { sender: "carol", body: "I am watching the center fight.", minutesAgo: 246 },
      { sender: "bob", body: "Good game. I missed the lane on move six.", minutesAgo: 237 },
    ],
  },
  {
    key: "renjuClinic",
    name: "Renju Clinic: Hoshi vs RenjuMaster",
    status: MatchStatus.FINISHED,
    visibility: MatchVisibility.PUBLIC,
    ruleType: RuleType.RENJU,
    createdBy: "renjuMaster",
    createdMinutesAgo: 1620,
    startedMinutesAgo: 1605,
    finishedMinutesAgo: 1588,
    winningSeat: Seat.WHITE,
    endReason: "white_line",
    participants: [
      { userKey: "hoshi", role: Role.PLAYER, seat: Seat.BLACK, result: MatchResult.LOSS },
      {
        userKey: "renjuMaster",
        role: Role.PLAYER,
        seat: Seat.WHITE,
        result: MatchResult.WIN,
      },
      { userKey: "kuroishi", role: Role.SPECTATOR },
      { userKey: "tenkei", role: Role.SPECTATOR },
    ],
    moves: renjuClinicMoves,
    conversationMessages: [
      { sender: "renjuMaster", body: "This is the forbidden-shape branch.", minutesAgo: 1599 },
      { sender: "kuroishi", body: "White gets tempo after the fourth stone.", minutesAgo: 1592 },
    ],
  },
  {
    key: "carolMeiDraw",
    name: "Fast Rematch: Carol vs Mei",
    status: MatchStatus.FINISHED,
    visibility: MatchVisibility.PUBLIC,
    ruleType: RuleType.GOMOKU,
    createdBy: "carol",
    createdMinutesAgo: 760,
    startedMinutesAgo: 744,
    finishedMinutesAgo: 731,
    winningSeat: null,
    endReason: "draw_agreement",
    participants: [
      { userKey: "carol", role: Role.PLAYER, seat: Seat.BLACK, result: MatchResult.DRAW },
      { userKey: "mei", role: Role.PLAYER, seat: Seat.WHITE, result: MatchResult.DRAW },
      { userKey: "lina", role: Role.SPECTATOR },
    ],
    moves: drawMoves,
    conversationMessages: [
      { sender: "lina", body: "This draw offer is actually disciplined.", minutesAgo: 734 },
      { sender: "mei", body: "I will take disciplined over trapped.", minutesAgo: 732 },
    ],
  },
  {
    key: "aliceSoloAi",
    name: "Solo Focus: Alice vs Kata Reader",
    status: MatchStatus.FINISHED,
    visibility: MatchVisibility.PRIVATE,
    ruleType: RuleType.GOMOKU,
    createdBy: "alice",
    createdMinutesAgo: 1080,
    startedMinutesAgo: 1070,
    finishedMinutesAgo: 1056,
    winningSeat: Seat.BLACK,
    endReason: "five_in_a_row",
    metadata: () =>
      ({
        ...createSoloMatchMetadata("expert"),
      }) satisfies Prisma.JsonObject,
    participants: [
      { userKey: "alice", role: Role.PLAYER, seat: Seat.BLACK, result: MatchResult.WIN },
      {
        displayName: "Kata Reader",
        role: Role.PLAYER,
        seat: Seat.WHITE,
        result: MatchResult.LOSS,
      },
    ],
    moves: soloAiMoves,
  },
  {
    key: "cancelledDefense",
    name: "Kuroishi vs Shirotora - Interrupted",
    status: MatchStatus.CANCELLED,
    visibility: MatchVisibility.PUBLIC,
    ruleType: RuleType.GOMOKU,
    createdBy: "shirotora",
    createdMinutesAgo: 540,
    startedMinutesAgo: 532,
    finishedMinutesAgo: 529,
    winningSeat: null,
    endReason: "player_left",
    participants: [
      { userKey: "kuroishi", role: Role.PLAYER, seat: Seat.BLACK, result: MatchResult.CANCELLED },
      { userKey: "shirotora", role: Role.PLAYER, seat: Seat.WHITE, result: MatchResult.CANCELLED },
    ],
    moves: [{ seat: Seat.BLACK, x: 7, y: 7, secondsAfterStart: 12 }],
  },
  {
    key: "activeStudy",
    name: "Live Study: Hoshi vs Kuroishi",
    status: MatchStatus.IN_PROGRESS,
    visibility: MatchVisibility.PUBLIC,
    ruleType: RuleType.GOMOKU,
    createdBy: "hoshi",
    createdMinutesAgo: 42,
    startedMinutesAgo: 36,
    nextTurnSeat: Seat.BLACK,
    participants: [
      { userKey: "hoshi", role: Role.PLAYER, seat: Seat.BLACK },
      { userKey: "kuroishi", role: Role.PLAYER, seat: Seat.WHITE },
      { userKey: "alice", role: Role.SPECTATOR },
      { userKey: "tenkei", role: Role.SPECTATOR },
    ],
    moves: activeStudyMoves,
    conversationMessages: [
      { sender: "alice", body: "This fork is spicy.", minutesAgo: 24 },
      { sender: "tenkei", body: "Black still has the cleaner extension.", minutesAgo: 20 },
    ],
  },
  {
    key: "openWarmup",
    name: "Open ladder warmup",
    status: MatchStatus.WAITING,
    visibility: MatchVisibility.PUBLIC,
    ruleType: RuleType.GOMOKU,
    createdBy: "hoshi",
    createdMinutesAgo: 14,
    participants: [{ userKey: "hoshi", role: Role.PLAYER, seat: Seat.BLACK }],
  },
  {
    key: "privateReview",
    name: "Private joseki review",
    status: MatchStatus.WAITING,
    visibility: MatchVisibility.PRIVATE,
    ruleType: RuleType.GOMOKU,
    createdBy: "tenkei",
    createdMinutesAgo: 22,
    passwordHash: (hashes) => hashes.privateRoomPassword,
    participants: [{ userKey: "tenkei", role: Role.PLAYER, seat: Seat.BLACK }],
  },
  {
    key: "aliceTenkeiChallenge",
    name: "alice vs Tenkei",
    status: MatchStatus.WAITING,
    visibility: MatchVisibility.PRIVATE,
    ruleType: RuleType.GOMOKU,
    createdBy: "alice",
    createdMinutesAgo: 9,
    passwordHash: (hashes) => hashes.challengeRoomPassword,
    metadata: (users, hashes) =>
      ({
        ...createChallengeMatchMetadata({
          declineTokenHash: hashes.challengeDeclineToken,
          targetUserId: users.tenkei.id,
          targetUsername: users.tenkei.username,
        }),
      }) satisfies Prisma.JsonObject,
    participants: [{ userKey: "alice", role: Role.PLAYER, seat: Seat.BLACK }],
  },
  {
    key: "abandonedQueue",
    name: "Abandoned queue warmup",
    status: MatchStatus.CANCELLED,
    visibility: MatchVisibility.PUBLIC,
    ruleType: RuleType.GOMOKU,
    createdBy: "noah",
    createdMinutesAgo: 980,
    finishedMinutesAgo: 960,
    winningSeat: null,
    endReason: "queue_timeout",
    participants: [
      { userKey: "noah", role: Role.PLAYER, seat: Seat.BLACK, result: MatchResult.CANCELLED },
    ],
  },
] as const satisfies readonly MatchSeed[];

type MatchSeedKey = (typeof matchSeeds)[number]["key"];
type MatchFixture = MatchSeed & { key: MatchSeedKey };
const matchFixtures: readonly MatchFixture[] = matchSeeds;

type SeededMatch = Pick<Match, "finishedAt" | "id" | "name" | "startedAt" | "status">;
type SeededMatchMap = Record<string, SeededMatch>;

async function createMatchConversation({
  db,
  matchId,
  messages,
  now,
  participantKeys,
  topic,
  users,
}: {
  db: SeedClient;
  matchId: string;
  messages: readonly MatchConversationMessageSeed[];
  now: Date;
  participantKeys: readonly SeedUserKey[];
  topic: string;
  users: SeededUsers;
}): Promise<void> {
  const sortedMessages = [...messages].sort((a, b) => b.minutesAgo - a.minutesAgo);
  const firstMessage = sortedMessages[0];
  const lastMessage = sortedMessages.at(-1);

  if (!firstMessage || !lastMessage) {
    throw new Error("Match conversation seed requires at least one message.");
  }

  const conversationId = createId();
  const firstMessageAt = minutesAgo(now, firstMessage.minutesAgo);
  const lastMessageAt = minutesAgo(now, lastMessage.minutesAgo);
  const uniqueParticipantKeys = [...new Set(participantKeys)];

  await db.conversation.create({
    data: {
      id: conversationId,
      kind: ConversationKind.MATCH,
      matchId,
      topic,
      createdAt: firstMessageAt,
      lastMessageAt,
      participants: {
        create: uniqueParticipantKeys.map((userKey) => ({
          id: createId(),
          userId: users[userKey].id,
          joinedAt: firstMessageAt,
          lastReadAt: lastMessageAt,
        })),
      },
    },
  });

  await createConversationMessages(db, conversationId, messages, users, now);
}

async function seedMatches(
  db: SeedClient,
  users: SeededUsers,
  now: Date,
  hashes: SeedHashes,
): Promise<{ conversationCount: number; matches: SeededMatchMap }> {
  const matches: SeededMatchMap = {};
  let conversationCount = 0;

  for (const seed of matchFixtures) {
    const moves = seed.moves ?? [];
    const createdAt = minutesAgo(now, seed.createdMinutesAgo);
    const startedAt =
      seed.startedMinutesAgo === undefined ? null : minutesAgo(now, seed.startedMinutesAgo);
    const finishedAt =
      seed.finishedMinutesAgo === undefined ? null : minutesAgo(now, seed.finishedMinutesAgo);

    const match = await db.match.create({
      data: {
        id: createId(),
        name: seed.name,
        password: seed.passwordHash?.(hashes) ?? null,
        status: seed.status,
        visibility: seed.visibility ?? MatchVisibility.PUBLIC,
        ruleType: seed.ruleType ?? RuleType.GOMOKU,
        boardSize: seed.boardSize ?? 15,
        stateVersion: moves.length,
        nextTurnSeat: seed.nextTurnSeat ?? null,
        winningSeat: seed.winningSeat ?? null,
        endReason: seed.endReason ?? null,
        createdByUserId: seed.createdBy ? users[seed.createdBy].id : null,
        startedAt,
        finishedAt,
        metadata: seed.metadata?.(users, hashes),
        createdAt,
        participants: {
          create: seed.participants.map((participant) => ({
            id: createId(),
            userId: participant.userKey ? users[participant.userKey].id : null,
            displayNameSnapshot:
              participant.displayName ??
              (participant.userKey ? users[participant.userKey].displayName : "Guest Player"),
            role: participant.role,
            seat: participant.seat ?? null,
            result: participant.result ?? null,
            joinedAt: startedAt ?? createdAt,
            leftAt:
              seed.status === MatchStatus.FINISHED || seed.status === MatchStatus.CANCELLED
                ? finishedAt
                : null,
          })),
        },
      },
    });

    matches[seed.key] = {
      finishedAt: match.finishedAt,
      id: match.id,
      name: match.name,
      startedAt: match.startedAt,
      status: match.status,
    };

    if (moves.length > 0) {
      if (!startedAt) {
        throw new Error(`Match "${seed.name}" has moves but no startedAt timestamp.`);
      }

      const participants = await db.matchParticipant.findMany({
        where: { matchId: match.id },
      });
      const participantBySeat = new Map(
        participants
          .filter(
            (participant) => participant.seat === Seat.BLACK || participant.seat === Seat.WHITE,
          )
          .map((participant) => [participant.seat as SeatValue, participant]),
      );

      await db.matchMove.createMany({
        data: moves.map((move, index) => {
          const participant = participantBySeat.get(move.seat);

          if (!participant) {
            throw new Error(`Missing ${move.seat} participant for match "${seed.name}".`);
          }

          const moveNumber = index + 1;

          return {
            id: createId(),
            matchId: match.id,
            participantId: participant.id,
            moveNumber,
            x: move.x,
            y: move.y,
            requestId: createId(),
            baseVersion: moveNumber - 1,
            stateVersion: moveNumber,
            createdAt: plusMs(startedAt, move.secondsAfterStart * secondMs),
          };
        }),
      });
    }

    if (seed.conversationMessages) {
      const participantKeys = seed.participants.flatMap((participant) =>
        participant.userKey ? [participant.userKey] : [],
      );

      await createMatchConversation({
        db,
        matchId: match.id,
        messages: seed.conversationMessages,
        now,
        participantKeys,
        topic: seed.name,
        users,
      });
      conversationCount += 1;
    }
  }

  return { conversationCount, matches };
}

type StatSeed = {
  averageMoveTimeMs: number;
  bestStreak: number;
  boardSize: number;
  botMatchesPlayed: number;
  botWins: number;
  currentStreak: number;
  draws: number;
  lastPlayedMinutesAgo: number;
  losses: number;
  matchesPlayed: number;
  rating: number | null;
  ruleType: RuleTypeValue;
  totalPlayTimeSeconds: number;
  user: SeedUserKey;
  wins: number;
};

const statSeeds = [
  {
    user: "hoshi",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 108,
    wins: 91,
    losses: 13,
    draws: 4,
    botMatchesPlayed: 4,
    botWins: 4,
    currentStreak: 9,
    bestStreak: 18,
    rating: 2341,
    averageMoveTimeMs: 820,
    totalPlayTimeSeconds: 42840,
    lastPlayedMinutesAgo: 36,
  },
  {
    user: "renjuMaster",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 96,
    wins: 78,
    losses: 16,
    draws: 2,
    botMatchesPlayed: 3,
    botWins: 3,
    currentStreak: 5,
    bestStreak: 14,
    rating: 2187,
    averageMoveTimeMs: 960,
    totalPlayTimeSeconds: 38220,
    lastPlayedMinutesAgo: 1588,
  },
  {
    user: "kuroishi",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 84,
    wins: 61,
    losses: 21,
    draws: 2,
    botMatchesPlayed: 2,
    botWins: 2,
    currentStreak: 0,
    bestStreak: 10,
    rating: 2042,
    averageMoveTimeMs: 1180,
    totalPlayTimeSeconds: 35980,
    lastPlayedMinutesAgo: 36,
  },
  {
    user: "shirotora",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 72,
    wins: 50,
    losses: 20,
    draws: 2,
    botMatchesPlayed: 1,
    botWins: 1,
    currentStreak: 0,
    bestStreak: 8,
    rating: 1898,
    averageMoveTimeMs: 740,
    totalPlayTimeSeconds: 29540,
    lastPlayedMinutesAgo: 529,
  },
  {
    user: "tenkei",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 58,
    wins: 38,
    losses: 17,
    draws: 3,
    botMatchesPlayed: 0,
    botWins: 0,
    currentStreak: 2,
    bestStreak: 7,
    rating: 1764,
    averageMoveTimeMs: 1340,
    totalPlayTimeSeconds: 31680,
    lastPlayedMinutesAgo: 20,
  },
  {
    user: "alice",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 41,
    wins: 27,
    losses: 12,
    draws: 2,
    botMatchesPlayed: 7,
    botWins: 5,
    currentStreak: 3,
    bestStreak: 6,
    rating: 1620,
    averageMoveTimeMs: 980,
    totalPlayTimeSeconds: 18600,
    lastPlayedMinutesAgo: 238,
  },
  {
    user: "lina",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 33,
    wins: 19,
    losses: 11,
    draws: 3,
    botMatchesPlayed: 0,
    botWins: 0,
    currentStreak: 1,
    bestStreak: 4,
    rating: 1540,
    averageMoveTimeMs: 1220,
    totalPlayTimeSeconds: 15480,
    lastPlayedMinutesAgo: 731,
  },
  {
    user: "arun",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 31,
    wins: 17,
    losses: 12,
    draws: 2,
    botMatchesPlayed: 0,
    botWins: 0,
    currentStreak: 0,
    bestStreak: 5,
    rating: 1512,
    averageMoveTimeMs: 1450,
    totalPlayTimeSeconds: 16320,
    lastPlayedMinutesAgo: 590,
  },
  {
    user: "bob",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 29,
    wins: 13,
    losses: 15,
    draws: 1,
    botMatchesPlayed: 3,
    botWins: 2,
    currentStreak: 0,
    bestStreak: 3,
    rating: 1475,
    averageMoveTimeMs: 860,
    totalPlayTimeSeconds: 11140,
    lastPlayedMinutesAgo: 238,
  },
  {
    user: "carol",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 24,
    wins: 10,
    losses: 12,
    draws: 2,
    botMatchesPlayed: 1,
    botWins: 0,
    currentStreak: 0,
    bestStreak: 3,
    rating: 1320,
    averageMoveTimeMs: 1260,
    totalPlayTimeSeconds: 9840,
    lastPlayedMinutesAgo: 731,
  },
  {
    user: "mika",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 16,
    wins: 7,
    losses: 8,
    draws: 1,
    botMatchesPlayed: 0,
    botWins: 0,
    currentStreak: 1,
    bestStreak: 2,
    rating: 1288,
    averageMoveTimeMs: 1100,
    totalPlayTimeSeconds: 6420,
    lastPlayedMinutesAgo: 1440,
  },
  {
    user: "mei",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 12,
    wins: 4,
    losses: 7,
    draws: 1,
    botMatchesPlayed: 2,
    botWins: 1,
    currentStreak: 0,
    bestStreak: 2,
    rating: 1190,
    averageMoveTimeMs: 1560,
    totalPlayTimeSeconds: 5520,
    lastPlayedMinutesAgo: 731,
  },
  {
    user: "noah",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 5,
    wins: 1,
    losses: 4,
    draws: 0,
    botMatchesPlayed: 0,
    botWins: 0,
    currentStreak: 0,
    bestStreak: 1,
    rating: 980,
    averageMoveTimeMs: 1010,
    totalPlayTimeSeconds: 2100,
    lastPlayedMinutesAgo: 960,
  },
  {
    user: "renjuMaster",
    ruleType: RuleType.RENJU,
    boardSize: 15,
    matchesPlayed: 44,
    wins: 35,
    losses: 8,
    draws: 1,
    botMatchesPlayed: 0,
    botWins: 0,
    currentStreak: 6,
    bestStreak: 12,
    rating: 2260,
    averageMoveTimeMs: 1180,
    totalPlayTimeSeconds: 19600,
    lastPlayedMinutesAgo: 1588,
  },
  {
    user: "hoshi",
    ruleType: RuleType.RENJU,
    boardSize: 15,
    matchesPlayed: 28,
    wins: 19,
    losses: 8,
    draws: 1,
    botMatchesPlayed: 0,
    botWins: 0,
    currentStreak: 0,
    bestStreak: 6,
    rating: 1984,
    averageMoveTimeMs: 1040,
    totalPlayTimeSeconds: 12840,
    lastPlayedMinutesAgo: 1588,
  },
  {
    user: "kataReader",
    ruleType: RuleType.GOMOKU,
    boardSize: 15,
    matchesPlayed: 18,
    wins: 9,
    losses: 9,
    draws: 0,
    botMatchesPlayed: 18,
    botWins: 9,
    currentStreak: 0,
    bestStreak: 4,
    rating: 1500,
    averageMoveTimeMs: 540,
    totalPlayTimeSeconds: 7200,
    lastPlayedMinutesAgo: 1056,
  },
] as const satisfies readonly StatSeed[];

async function seedStats(db: SeedClient, users: SeededUsers, now: Date): Promise<number> {
  await db.userGameStats.createMany({
    data: statSeeds.map((seed) => ({
      userId: users[seed.user].id,
      ruleType: seed.ruleType,
      boardSize: seed.boardSize,
      matchesPlayed: seed.matchesPlayed,
      wins: seed.wins,
      losses: seed.losses,
      draws: seed.draws,
      botMatchesPlayed: seed.botMatchesPlayed,
      botWins: seed.botWins,
      currentStreak: seed.currentStreak,
      bestStreak: seed.bestStreak,
      rating: seed.rating,
      averageMoveTimeMs: seed.averageMoveTimeMs,
      totalPlayTimeSeconds: seed.totalPlayTimeSeconds,
      lastPlayedAt: minutesAgo(now, seed.lastPlayedMinutesAgo),
    })),
  });

  return statSeeds.length;
}

const achievementDefinitions = [
  {
    code: "first_win",
    name: "First Victory",
    description: "Win your first public match.",
    points: 10,
  },
  {
    code: "first_friend",
    name: "Social Link",
    description: "Add your first friend.",
    points: 5,
  },
  {
    code: "ten_moves",
    name: "Strategist",
    description: "Record at least 10 moves across matches.",
    points: 15,
  },
  {
    code: "ai_win",
    name: "AI Victor",
    description: "Win a match against an AI opponent.",
    points: 10,
  },
  {
    code: "win_streak_3",
    name: "Hat Trick",
    description: "Win three matches in a row.",
    points: 20,
  },
] as const;

type AchievementCode = (typeof achievementDefinitions)[number]["code"];

type UserAchievementSeed = {
  code: AchievementCode;
  completedMinutesAgo?: number;
  progress: number;
  unlockedMinutesAgo: number;
  user: SeedUserKey;
};

const userAchievementSeeds = [
  {
    user: "alice",
    code: "first_win",
    progress: 1,
    unlockedMinutesAgo: 1056,
    completedMinutesAgo: 1056,
  },
  {
    user: "alice",
    code: "first_friend",
    progress: 1,
    unlockedMinutesAgo: 18 * 24 * 60,
    completedMinutesAgo: 18 * 24 * 60,
  },
  {
    user: "alice",
    code: "ai_win",
    progress: 1,
    unlockedMinutesAgo: 1056,
    completedMinutesAgo: 1056,
  },
  {
    user: "alice",
    code: "win_streak_3",
    progress: 3,
    unlockedMinutesAgo: 238,
    completedMinutesAgo: 238,
  },
  {
    user: "bob",
    code: "first_friend",
    progress: 1,
    unlockedMinutesAgo: 18 * 24 * 60,
    completedMinutesAgo: 18 * 24 * 60,
  },
  {
    user: "bob",
    code: "ten_moves",
    progress: 27,
    unlockedMinutesAgo: 400,
    completedMinutesAgo: 400,
  },
  {
    user: "carol",
    code: "first_friend",
    progress: 1,
    unlockedMinutesAgo: 12 * 24 * 60,
    completedMinutesAgo: 12 * 24 * 60,
  },
  {
    user: "carol",
    code: "ten_moves",
    progress: 14,
    unlockedMinutesAgo: 731,
    completedMinutesAgo: 731,
  },
  {
    user: "hoshi",
    code: "first_win",
    progress: 1,
    unlockedMinutesAgo: 60 * 24 * 60,
    completedMinutesAgo: 60 * 24 * 60,
  },
  {
    user: "hoshi",
    code: "first_friend",
    progress: 1,
    unlockedMinutesAgo: 42 * 24 * 60,
    completedMinutesAgo: 42 * 24 * 60,
  },
  {
    user: "hoshi",
    code: "ten_moves",
    progress: 210,
    unlockedMinutesAgo: 30 * 24 * 60,
    completedMinutesAgo: 30 * 24 * 60,
  },
  {
    user: "hoshi",
    code: "win_streak_3",
    progress: 9,
    unlockedMinutesAgo: 36,
    completedMinutesAgo: 36,
  },
  {
    user: "renjuMaster",
    code: "first_win",
    progress: 1,
    unlockedMinutesAgo: 1588,
    completedMinutesAgo: 1588,
  },
  {
    user: "renjuMaster",
    code: "ten_moves",
    progress: 136,
    unlockedMinutesAgo: 1588,
    completedMinutesAgo: 1588,
  },
  {
    user: "renjuMaster",
    code: "win_streak_3",
    progress: 6,
    unlockedMinutesAgo: 1588,
    completedMinutesAgo: 1588,
  },
  {
    user: "kuroishi",
    code: "ten_moves",
    progress: 120,
    unlockedMinutesAgo: 532,
    completedMinutesAgo: 532,
  },
  {
    user: "shirotora",
    code: "first_win",
    progress: 1,
    unlockedMinutesAgo: 7 * 24 * 60,
    completedMinutesAgo: 7 * 24 * 60,
  },
  {
    user: "tenkei",
    code: "first_friend",
    progress: 1,
    unlockedMinutesAgo: 11 * 24 * 60,
    completedMinutesAgo: 11 * 24 * 60,
  },
  { user: "mei", code: "first_win", progress: 0, unlockedMinutesAgo: 731 },
  {
    user: "lina",
    code: "ten_moves",
    progress: 24,
    unlockedMinutesAgo: 731,
    completedMinutesAgo: 731,
  },
  {
    user: "arun",
    code: "first_friend",
    progress: 1,
    unlockedMinutesAgo: 25 * 24 * 60,
    completedMinutesAgo: 25 * 24 * 60,
  },
] as const satisfies readonly UserAchievementSeed[];

const userAchievementFixtures: readonly UserAchievementSeed[] = userAchievementSeeds;

async function seedAchievements(
  db: SeedClient,
  users: SeededUsers,
  now: Date,
): Promise<{ definitionCount: number; unlockCount: number }> {
  const definitions = {} as Record<AchievementCode, { id: number }>;

  for (const definition of achievementDefinitions) {
    const record = await db.achievementDefinition.upsert({
      where: { code: definition.code },
      update: {
        name: definition.name,
        description: definition.description,
        points: definition.points,
      },
      create: definition,
    });

    definitions[definition.code] = { id: record.id };
  }

  await db.userAchievement.createMany({
    data: userAchievementFixtures.map((seed) => ({
      userId: users[seed.user].id,
      achievementId: definitions[seed.code].id,
      progress: seed.progress,
      unlockedAt: minutesAgo(now, seed.unlockedMinutesAgo),
      completedAt:
        seed.completedMinutesAgo === undefined ? null : minutesAgo(now, seed.completedMinutesAgo),
    })),
  });

  return {
    definitionCount: achievementDefinitions.length,
    unlockCount: userAchievementFixtures.length,
  };
}

type AnalyticsSeed = {
  eventType: string;
  matchKey?: string;
  minutesAgo: number;
  properties: Prisma.JsonObject;
  user?: SeedUserKey;
};

const analyticsSeeds = [
  {
    user: "alice",
    matchKey: "aliceBobFinal",
    eventType: "match.finished",
    minutesAgo: 238,
    properties: {
      boardSize: 15,
      ruleType: "GOMOKU",
      winnerSeat: "BLACK",
    } satisfies Prisma.JsonObject,
  },
  {
    user: "bob",
    matchKey: "aliceBobFinal",
    eventType: "match.reviewed",
    minutesAgo: 226,
    properties: {
      mistakeMove: 6,
      reviewer: "Carol",
    } satisfies Prisma.JsonObject,
  },
  {
    user: "carol",
    matchKey: "aliceBobFinal",
    eventType: "match.spectated",
    minutesAgo: 238,
    properties: {
      peakViewers: 1,
      viewer: "carol",
    } satisfies Prisma.JsonObject,
  },
  {
    user: "hoshi",
    matchKey: "activeStudy",
    eventType: "match.started",
    minutesAgo: 36,
    properties: {
      roomType: "study",
      spectators: 2,
    } satisfies Prisma.JsonObject,
  },
  {
    user: "tenkei",
    matchKey: "privateReview",
    eventType: "match.created",
    minutesAgo: 22,
    properties: {
      requiresPassword: true,
      visibility: "PRIVATE",
    } satisfies Prisma.JsonObject,
  },
  {
    user: "alice",
    matchKey: "aliceTenkeiChallenge",
    eventType: "challenge.sent",
    minutesAgo: 9,
    properties: {
      targetUsername: "Tenkei",
    } satisfies Prisma.JsonObject,
  },
  {
    user: "renjuMaster",
    matchKey: "renjuClinic",
    eventType: "match.finished",
    minutesAgo: 1588,
    properties: {
      ruleType: "RENJU",
      winnerSeat: "WHITE",
    } satisfies Prisma.JsonObject,
  },
  {
    user: "alice",
    eventType: "friendship.accepted",
    minutesAgo: 18 * 24 * 60,
    properties: {
      friendUsername: "bob",
    } satisfies Prisma.JsonObject,
  },
  {
    user: "mei",
    eventType: "friendship.requested",
    minutesAgo: 24 * 60,
    properties: {
      targetUsername: "alice",
    } satisfies Prisma.JsonObject,
  },
  {
    user: "hoshi",
    eventType: "leaderboard.viewed",
    minutesAgo: 12,
    properties: {
      scope: "all",
      sort: "rating_desc",
    } satisfies Prisma.JsonObject,
  },
  {
    user: "alice",
    eventType: "leaderboard.viewed",
    minutesAgo: 6,
    properties: {
      scope: "friends",
      sort: "rating_desc",
    } satisfies Prisma.JsonObject,
  },
  {
    user: "carol",
    eventType: "conversation.unread",
    minutesAgo: 11,
    properties: {
      unreadFor: "alice",
    } satisfies Prisma.JsonObject,
  },
] as const satisfies readonly AnalyticsSeed[];

const analyticsFixtures: readonly AnalyticsSeed[] = analyticsSeeds;

async function seedAnalyticsEvents({
  db,
  matches,
  now,
  sessions,
  users,
}: {
  db: SeedClient;
  matches: SeededMatchMap;
  now: Date;
  sessions: Record<string, UserSession>;
  users: SeededUsers;
}): Promise<number> {
  await db.analyticsEvent.createMany({
    data: analyticsFixtures.map((seed) => {
      const userId = seed.user ? users[seed.user].id : null;

      return {
        id: createId(),
        userId,
        sessionId: userId ? (sessions[userId]?.id ?? null) : null,
        matchId: seed.matchKey ? (matches[seed.matchKey]?.id ?? null) : null,
        eventType: seed.eventType,
        properties: seed.properties,
        createdAt: minutesAgo(now, seed.minutesAgo),
      };
    }),
  });

  return analyticsFixtures.length;
}

type SeedSummary = {
  achievementDefinitions: number;
  analyticsEvents: number;
  conversations: number;
  friendships: number;
  matches: number;
  statsRows: number;
  userAchievements: number;
  users: number;
};

async function seedDemoData(db: SeedClient, now: Date, hashes: SeedHashes): Promise<SeedSummary> {
  const { users, sessions } = await seedUsers(db, now, hashes);
  const friendships = await seedFriendships(db, users, now);
  const directConversations = await seedDirectConversations(db, users, now);
  const groupConversations = await seedGroupConversation(db, users, now);
  const { conversationCount: matchConversations, matches } = await seedMatches(
    db,
    users,
    now,
    hashes,
  );
  const statsRows = await seedStats(db, users, now);
  const { definitionCount, unlockCount } = await seedAchievements(db, users, now);
  const analyticsEvents = await seedAnalyticsEvents({
    db,
    matches,
    now,
    sessions,
    users,
  });

  return {
    achievementDefinitions: definitionCount,
    analyticsEvents,
    conversations: directConversations + groupConversations + matchConversations,
    friendships,
    matches: matchFixtures.length,
    statsRows,
    userAchievements: unlockCount,
    users: demoUserSeeds.length,
  };
}

const main = async () => {
  const existingUsers = await prisma.user.count();
  if (existingUsers > 0) {
    console.log("Database is not empty; skipping seed to avoid clobbering existing data.");
    return;
  }

  const [userPassword, privateRoomPassword, challengeRoomPassword, challengeDeclineToken] =
    await Promise.all([
      hashPassword(demoPassword),
      hashPassword("review-room"),
      hashPassword("challenge-room"),
      hashPassword("seed-decline-token"),
    ]);
  const now = new Date();
  const summary = await prisma.$transaction(
    (tx) =>
      seedDemoData(tx, now, {
        challengeDeclineToken,
        challengeRoomPassword,
        privateRoomPassword,
        userPassword,
      }),
    {
      timeout: 30_000,
    },
  );

  console.log(
    [
      `Seed data created with demo password "${demoPassword}":`,
      `${summary.users} users`,
      `${summary.friendships} friendships`,
      `${summary.conversations} conversations`,
      `${summary.matches} matches`,
      `${summary.statsRows} stats rows`,
      `${summary.achievementDefinitions} achievement definitions`,
      `${summary.userAchievements} user achievements`,
      `${summary.analyticsEvents} analytics events`,
    ].join(" "),
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
