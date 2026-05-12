type ParticipantAccessSnapshot = {
  id: string;
  leftAt: Date | string | null;
  userId: string | null;
};

export function isActiveParticipantForUser(
  participants: ParticipantAccessSnapshot[],
  participantId: string,
  userId: string,
) {
  return participants.some(
    (participant) =>
      participant.id === participantId &&
      participant.userId === userId &&
      participant.leftAt === null,
  );
}
