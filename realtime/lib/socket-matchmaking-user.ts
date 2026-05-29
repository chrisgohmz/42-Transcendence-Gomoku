import type { Socket } from "socket.io";

import type { MatchmakingUser } from "@/lib/matches/matchmaking";

type SocketUser = Partial<MatchmakingUser> & {
  id?: string;
};

export function getMatchmakingUserFromSocket(socket: Pick<Socket, "data">): MatchmakingUser | null {
  const user = socket.data.user as SocketUser | undefined;

  if (!user?.id) {
    return null;
  }

  return {
    displayName: user.displayName ?? null,
    id: user.id,
    name: user.name ?? null,
    username: user.username ?? null,
  };
}
