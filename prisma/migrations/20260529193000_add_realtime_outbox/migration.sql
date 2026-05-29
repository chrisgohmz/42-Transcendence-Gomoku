CREATE TABLE "RealtimeOutboxEvent" (
    "id" TEXT NOT NULL,
    "topic" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "availableAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lockedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealtimeOutboxEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RealtimeOutboxEvent_status_availableAt_idx" ON "RealtimeOutboxEvent"("status", "availableAt");
CREATE INDEX "RealtimeOutboxEvent_topic_idx" ON "RealtimeOutboxEvent"("topic");
