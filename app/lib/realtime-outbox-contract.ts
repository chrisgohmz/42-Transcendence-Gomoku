export const realtimeOutboxStatuses = {
  failed: "FAILED",
  pending: "PENDING",
  processing: "PROCESSING",
  published: "PUBLISHED",
} as const;

export const realtimeOutboxTopics = {
  challengeDeclined: "challenge:declined",
  gameUpdate: "game:update",
  queueMatched: "queue:matched",
} as const;

export type RealtimeOutboxStatus =
  (typeof realtimeOutboxStatuses)[keyof typeof realtimeOutboxStatuses];
export type RealtimeOutboxTopic = (typeof realtimeOutboxTopics)[keyof typeof realtimeOutboxTopics];

export type RealtimeOutboxPublishEvent = {
  id: string;
  payload: unknown;
  topic: RealtimeOutboxTopic;
};
