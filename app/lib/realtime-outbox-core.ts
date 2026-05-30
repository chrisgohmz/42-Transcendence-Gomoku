// Standalone Bun workers import this module directly. Next app code should import
// ./realtime-outbox so the server-only boundary is still enforced by Next.
import type { Prisma } from "../../generated/prisma/client";
import { prisma as defaultPrisma } from "./prisma";
import {
  realtimeOutboxStatuses,
  realtimeOutboxTopics,
  type RealtimeOutboxPublishEvent,
  type RealtimeOutboxStatus,
  type RealtimeOutboxTopic,
} from "./realtime-outbox-contract";

export {
  realtimeOutboxStatuses,
  realtimeOutboxTopics,
  type RealtimeOutboxPublishEvent,
  type RealtimeOutboxStatus,
  type RealtimeOutboxTopic,
} from "./realtime-outbox-contract";

export type RealtimeOutboxEvent = {
  id: string;
  topic: string;
  payload: Prisma.JsonValue;
  status: string;
  attempts: number;
  maxAttempts: number;
  availableAt: Date;
  lockedAt: Date | null;
  publishedAt: Date | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

type RealtimeOutboxModel = {
  create(args: {
    data: {
      topic: string;
      payload: Prisma.InputJsonValue;
      status: RealtimeOutboxStatus;
      lastError: string | null;
    };
  }): Promise<unknown>;
  findMany(args: {
    where: {
      OR: Array<
        | {
            status: RealtimeOutboxStatus;
            availableAt: { lte: Date };
          }
        | {
            status: RealtimeOutboxStatus;
            lockedAt: { lte: Date };
          }
      >;
    };
    orderBy: Array<{ availableAt?: "asc" } | { createdAt?: "asc" }>;
    take: number;
  }): Promise<RealtimeOutboxEvent[]>;
  update(args: {
    where: { id: string };
    data: Partial<{
      attempts: { increment: number };
      availableAt: Date;
      lastError: string | null;
      lockedAt: Date | null;
      publishedAt: Date | null;
      status: RealtimeOutboxStatus;
    }>;
  }): Promise<unknown>;
  updateMany(args: {
    where: {
      attempts: number;
      id: string;
      publishedAt: null;
      status: string;
    };
    data: {
      lockedAt: Date;
      status: RealtimeOutboxStatus;
    };
  }): Promise<{ count: number }>;
};

export type RealtimeOutboxPrisma = {
  realtimeOutboxEvent: RealtimeOutboxModel;
};

export type DrainRealtimeOutboxOptions = {
  limit?: number;
  now?: Date;
  prisma?: RealtimeOutboxPrisma;
  publish: (event: RealtimeOutboxPublishEvent) => Promise<void>;
  staleProcessingMs?: number;
};

const defaultBatchLimit = 25;
const defaultStaleProcessingMs = 5 * 60 * 1000;
const maxErrorLength = 1000;

function getPrisma(prisma: RealtimeOutboxPrisma | undefined): RealtimeOutboxPrisma {
  return prisma ?? (defaultPrisma as unknown as RealtimeOutboxPrisma);
}

function truncateError(message: string) {
  return message.length > maxErrorLength ? `${message.slice(0, maxErrorLength - 1)}...` : message;
}

function getErrorMessage(error: unknown) {
  return truncateError(error instanceof Error ? error.message : "Unknown error");
}

function getRetryAvailableAt(now: Date, attempts: number) {
  const delaySeconds = Math.min(300, 2 ** Math.max(0, attempts - 1) * 5);
  return new Date(now.getTime() + delaySeconds * 1000);
}

function toOutboxTopic(topic: string): RealtimeOutboxTopic | null {
  return Object.values(realtimeOutboxTopics).includes(topic as RealtimeOutboxTopic)
    ? (topic as RealtimeOutboxTopic)
    : null;
}

export async function enqueueRealtimeOutboxEvent({
  error,
  payload,
  prisma,
  topic,
}: {
  error?: unknown;
  payload: unknown;
  prisma?: RealtimeOutboxPrisma;
  topic: RealtimeOutboxTopic;
}) {
  await getPrisma(prisma).realtimeOutboxEvent.create({
    data: {
      topic,
      payload: payload as Prisma.InputJsonValue,
      status: realtimeOutboxStatuses.pending,
      lastError: error === undefined ? null : getErrorMessage(error),
    },
  });
}

export async function drainRealtimeOutbox({
  limit = defaultBatchLimit,
  now = new Date(),
  prisma,
  publish,
  staleProcessingMs = defaultStaleProcessingMs,
}: DrainRealtimeOutboxOptions) {
  const client = getPrisma(prisma);
  const staleProcessingBefore = new Date(now.getTime() - staleProcessingMs);
  const events = await client.realtimeOutboxEvent.findMany({
    where: {
      OR: [
        {
          status: realtimeOutboxStatuses.pending,
          availableAt: {
            lte: now,
          },
        },
        {
          status: realtimeOutboxStatuses.processing,
          lockedAt: {
            lte: staleProcessingBefore,
          },
        },
      ],
    },
    orderBy: [{ availableAt: "asc" }, { createdAt: "asc" }],
    take: limit,
  });
  const summary = {
    failed: 0,
    published: 0,
    retried: 0,
    skipped: 0,
  };

  for (const event of events) {
    const topic = toOutboxTopic(event.topic);

    if (!topic || event.attempts >= event.maxAttempts) {
      summary.skipped += 1;
      continue;
    }

    const claim = await client.realtimeOutboxEvent.updateMany({
      where: {
        attempts: event.attempts,
        id: event.id,
        publishedAt: null,
        status: event.status,
      },
      data: {
        lockedAt: now,
        status: realtimeOutboxStatuses.processing,
      },
    });

    if (claim.count !== 1) {
      summary.skipped += 1;
      continue;
    }

    try {
      await publish({
        id: event.id,
        payload: event.payload,
        topic,
      });

      await client.realtimeOutboxEvent.update({
        where: { id: event.id },
        data: {
          attempts: { increment: 1 },
          lastError: null,
          lockedAt: null,
          publishedAt: now,
          status: realtimeOutboxStatuses.published,
        },
      });
      summary.published += 1;
    } catch (error) {
      const attempts = event.attempts + 1;
      const exhausted = attempts >= event.maxAttempts;

      await client.realtimeOutboxEvent.update({
        where: { id: event.id },
        data: {
          attempts: { increment: 1 },
          availableAt: exhausted ? event.availableAt : getRetryAvailableAt(now, attempts),
          lastError: getErrorMessage(error),
          lockedAt: null,
          status: exhausted ? realtimeOutboxStatuses.failed : realtimeOutboxStatuses.pending,
        },
      });

      if (exhausted) {
        summary.failed += 1;
      } else {
        summary.retried += 1;
      }
    }
  }

  return summary;
}
