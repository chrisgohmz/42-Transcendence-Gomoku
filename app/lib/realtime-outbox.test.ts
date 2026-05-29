import { describe, expect, mock, test } from "bun:test";

import type { RealtimeOutboxEvent, RealtimeOutboxPrisma } from "./realtime-outbox";

await mock.module("server-only", () => ({}));
await mock.module("./prisma", () => ({ prisma: {} }));

const {
  drainRealtimeOutbox,
  enqueueRealtimeOutboxEvent,
  realtimeOutboxStatuses,
  realtimeOutboxTopics,
} = await import("./realtime-outbox");

type CreateArgs = Parameters<RealtimeOutboxPrisma["realtimeOutboxEvent"]["create"]>[0];
type FindManyArgs = Parameters<RealtimeOutboxPrisma["realtimeOutboxEvent"]["findMany"]>[0];
type UpdateArgs = Parameters<RealtimeOutboxPrisma["realtimeOutboxEvent"]["update"]>[0];
type UpdateManyArgs = Parameters<RealtimeOutboxPrisma["realtimeOutboxEvent"]["updateMany"]>[0];

function matchesDueWhere(event: RealtimeOutboxEvent, where: FindManyArgs["where"]) {
  return where.OR.some((condition) => {
    if (condition.status !== event.status) {
      return false;
    }

    if ("availableAt" in condition) {
      return event.availableAt <= condition.availableAt.lte;
    }

    return event.lockedAt !== null && event.lockedAt <= condition.lockedAt.lte;
  });
}

function createOutboxEvent(overrides: Partial<RealtimeOutboxEvent> = {}): RealtimeOutboxEvent {
  const now = new Date("2026-05-29T00:00:00.000Z");

  return {
    attempts: 0,
    availableAt: now,
    createdAt: now,
    id: "evt-1",
    lastError: null,
    lockedAt: null,
    maxAttempts: 5,
    payload: { ok: true },
    publishedAt: null,
    status: realtimeOutboxStatuses.pending,
    topic: realtimeOutboxTopics.gameUpdate,
    updatedAt: now,
    ...overrides,
  };
}

function createFakePrisma(seed: RealtimeOutboxEvent[] = []) {
  const events = [...seed];
  const prisma: RealtimeOutboxPrisma = {
    realtimeOutboxEvent: {
      async create(args: CreateArgs) {
        const now = new Date("2026-05-29T00:00:00.000Z");
        const event = createOutboxEvent({
          availableAt: now,
          createdAt: now,
          id: `evt-${events.length + 1}`,
          lastError: args.data.lastError,
          lockedAt: null,
          payload: args.data.payload as RealtimeOutboxEvent["payload"],
          publishedAt: null,
          status: args.data.status,
          topic: args.data.topic,
          updatedAt: now,
        });

        events.push(event);
        return event;
      },
      async findMany(args: FindManyArgs) {
        return events
          .filter((event) => matchesDueWhere(event, args.where))
          .sort((left, right) => {
            const availableDelta = left.availableAt.getTime() - right.availableAt.getTime();
            return availableDelta || left.createdAt.getTime() - right.createdAt.getTime();
          })
          .slice(0, args.take);
      },
      async update(args: UpdateArgs) {
        const event = events.find((entry) => entry.id === args.where.id);

        if (!event) {
          throw new Error(`Missing outbox event ${args.where.id}`);
        }

        Object.assign(event, {
          ...args.data,
          attempts:
            args.data.attempts && "increment" in args.data.attempts
              ? event.attempts + args.data.attempts.increment
              : event.attempts,
          updatedAt: new Date("2026-05-29T00:00:01.000Z"),
        });

        return event;
      },
      async updateMany(args: UpdateManyArgs) {
        const event = events.find(
          (entry) =>
            entry.id === args.where.id &&
            entry.status === args.where.status &&
            entry.attempts === args.where.attempts &&
            entry.publishedAt === null,
        );

        if (!event) {
          return { count: 0 };
        }

        event.lockedAt = args.data.lockedAt;
        event.status = args.data.status;

        return { count: 1 };
      },
    },
  };

  return { events, prisma };
}

describe("realtime outbox", () => {
  test("enqueues pending events with bounded error text", async () => {
    const { events, prisma } = createFakePrisma();

    await enqueueRealtimeOutboxEvent({
      error: new Error("realtime down"),
      payload: { matchId: "match-1" },
      prisma,
      topic: realtimeOutboxTopics.gameUpdate,
    });

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      lastError: "realtime down",
      payload: { matchId: "match-1" },
      status: realtimeOutboxStatuses.pending,
      topic: realtimeOutboxTopics.gameUpdate,
    });
  });

  test("publishes due pending events and marks them complete", async () => {
    const now = new Date("2026-05-29T01:00:00.000Z");
    const event = createOutboxEvent({ availableAt: new Date("2026-05-29T00:59:00.000Z") });
    const { events, prisma } = createFakePrisma([event]);
    const publish = mock(async () => {});

    const summary = await drainRealtimeOutbox({ now, prisma, publish });

    expect(summary).toEqual({ failed: 0, published: 1, retried: 0, skipped: 0 });
    expect(publish).toHaveBeenCalledWith({
      id: event.id,
      payload: event.payload,
      topic: event.topic,
    });
    expect(events[0]).toMatchObject({
      attempts: 1,
      lastError: null,
      lockedAt: null,
      publishedAt: now,
      status: realtimeOutboxStatuses.published,
    });
  });

  test("backs off failed events until the retry budget is exhausted", async () => {
    const now = new Date("2026-05-29T01:00:00.000Z");
    const event = createOutboxEvent({
      attempts: 4,
      maxAttempts: 5,
      status: realtimeOutboxStatuses.pending,
    });
    const { events, prisma } = createFakePrisma([event]);
    const publish = mock(async () => {
      throw new Error("still down");
    });

    const summary = await drainRealtimeOutbox({ now, prisma, publish });

    expect(summary).toEqual({ failed: 1, published: 0, retried: 0, skipped: 0 });
    expect(events[0]).toMatchObject({
      attempts: 5,
      lastError: "still down",
      lockedAt: null,
      status: realtimeOutboxStatuses.failed,
    });
  });

  test("reclaims stale processing events", async () => {
    const now = new Date("2026-05-29T01:00:00.000Z");
    const event = createOutboxEvent({
      lockedAt: new Date("2026-05-29T00:50:00.000Z"),
      status: realtimeOutboxStatuses.processing,
    });
    const { prisma } = createFakePrisma([event]);
    const publish = mock(async () => {});

    const summary = await drainRealtimeOutbox({ now, prisma, publish });

    expect(summary.published).toBe(1);
  });

  test("skips unknown topics without claiming them", async () => {
    const { events, prisma } = createFakePrisma([
      createOutboxEvent({
        status: realtimeOutboxStatuses.pending,
        topic: "unknown:event",
      }),
    ]);

    const summary = await drainRealtimeOutbox({
      now: new Date("2026-05-29T01:00:00.000Z"),
      prisma,
      publish: mock(async () => {}),
    });

    expect(summary.skipped).toBe(1);
    expect(events[0]?.status).toBe(realtimeOutboxStatuses.pending);
  });
});
