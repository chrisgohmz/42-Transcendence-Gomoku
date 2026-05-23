export function matchRoomId(matchId: string): string {
  return `match: ${matchId}`;
}

export function convRoomId(conversationId: string): string {
  return `conv:${conversationId}`;
}
